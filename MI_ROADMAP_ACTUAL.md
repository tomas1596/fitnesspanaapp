# MI_ROADMAP_ACTUAL — Inventario técnico (estado del repo)

Documento de **control personal**: radiografía del código **implementado hoy**, no backlog de producto. Las rutas bajo `src/` y migraciones Supabase se citan para orientar soporte y evolución.

*Actualizado desde el contenido efectivo del repositorio a **mayo de 2026** (incluye variantes A/B/C de rutinas, biometría WebAuthn, grain/glow global y refinamientos UX de Entreno). Modificar esta sección únicamente cuando el comportamiento en código cambie de forma observable.*

---

## 0. Arquitectura PWA, shell visual y UX móvil global

### 0.1 Superficie PWA

| Recurso | Ubicación | Detalle |
|---------|-----------|---------|
| Manifest | `public/site.webmanifest` | `display: standalone`, `start_url: /`, `theme_color` / `background_color: #141417` |
| Meta PWA | `index.html` | `<link rel="manifest">`, `theme-color`, favicons multi-resolución, `apple-touch-icon` |
| Service Worker | `src/main.tsx` (registro) | Mensajes SW → **`ServiceWorkerCardioBridge`** en **`src/App.tsx`** (`OPEN_CARDIO` navega a `/cardio`) |
| Run tracking SW | `src/lib/runTrackingSw.ts` | Registrado; lógica sticky en **`Cardio.tsx`** comentada pre–App Store |

### 0.2 Shell visual premium — Grain + Ambient Glow

**Archivos:** `src/App.tsx` · `src/index.css`

| Capa | Implementación | Clases / tokens |
|------|----------------|-----------------|
| Contenedor raíz | Envuelve toda la app autenticada | `.app-visual-shell.relative.isolate.min-h-dvh` |
| Ambient glow | Gradiente radial fijo arriba-derecha | `.app-ambient-glow` · `fixed -right-[10%] -top-[10%] -z-10` · `blur-[100px]` dark `blur-[120px]` |
| Fuerza glow | Variables CSS | `--app-glow-strength`: `0.09` (light) · `0.24` (dark) |
| Grain / ruido | Pseudo-elemento global | `body::after` · SVG `feTurbulence fractalNoise` · `mix-blend-mode: overlay` (light) / `soft-light` (dark) |
| Opacidad grain | `--app-grain-opacity`: `0.028` (light) · `0.036` (dark) | `pointer-events: none` · `z-index: 9999` |
| Transparencia páginas | Las vistas `min-h-screen.bg-background` dejan ver el shell | `.app-visual-shell .min-h-screen.bg-background { background-color: transparent !important; }` |

El glow hereda `--primary` (verde neón o rosa VIP vía `applyBrandTheme`).

### 0.3 Sistema de capas Light / Dark (base visual)

**`src/index.css`** — tokens `:root` / `.dark`:

| Capa (modo día) | Token / valor | Uso |
|-----------------|---------------|-----|
| Fondo página | `--background` ≈ `zinc-100` `#F4F4F5` | Base gris suave |
| Tarjetas | `--card` blanco `#FFFFFF` | Flotan sobre fondo con sombra suave en `.rounded-2xl.bg-card` |
| Hover / secondary | `--secondary` zinc-100/200 | Chips, botones secundarios |
| Acento | `--primary` verde neón `#39FF14` | Botones, anillos, glows |
| Bordes | `--border` ≈ zinc-200 | Definición sin agredir |

**Tema UI:** `ThemeProvider` · `src/hooks/useTheme.tsx` · persistencia `localStorage` clave **`pana_theme`** · valores `light` \| `dark` \| `system`.

**Marca VIP:** `BrandThemeApplier` en `App.tsx` lee `profiles.theme` → `applyBrandTheme('default'|'pink')` · `src/lib/brandTheme.ts`.

### 0.4 Comportamiento nativo en CSS global

**Archivo:** `src/index.css`

| Optimización | Implementación |
|--------------|----------------|
| Eliminar rubber-band scroll | `body { overscroll-behavior: none; }` |
| Highlight táctil | `-webkit-tap-highlight-color: transparent` |
| Área táctil mínima | `.touch-target` → `min-h-[48px] min-w-[48px]` |
| Safe area inferior | `.safe-bottom` → `calc(env(safe-area-inset-bottom) + 80px)` |
| Scrollbars ocultos | `::-webkit-scrollbar { display: none; }` + `scrollbar-width: none` |
| Fuente | Inter (Google Fonts) · `100dvh` min-height |
| WCAG light primary text | `html:not(.dark) .text-primary` → green-700 o pink-600 según `data-brand` |

**No implementado:** `touch-action: manipulation` global · hook `visualViewport` para ocultar BottomNav con teclado.

### 0.5 BottomNav — visibilidad

**Archivo:** `src/components/BottomNav.tsx`

| Condición | Efecto |
|-----------|--------|
| Path `/actividad/*`, `/cardio/<id>`, `/admin`, `/coach` | `return null` |
| Sin usuario | No monta (`App.tsx`) |
| `/paywall`, `/verificado`, `/terminos` | No monta |

**Tabs:** Entreno `/` · Timer · Cardio · Nutrición · Perfil.

**Estilos:** `fixed bottom-0 z-50` · light `border-zinc-200 bg-white` · dark `bg-zinc-950/85 backdrop-blur-xl` · tab activo `scale-110` + `--brand-glow-sm` · `active:scale-90` · haptic `navTap()` · `paddingBottom: env(safe-area-inset-bottom)`.

### 0.6 Navegación SPA

| Aspecto | Estado |
|---------|--------|
| Transiciones entre rutas | **Instantáneas** — sin `AnimatePresence` en router |
| Framer Motion | Solo **`Auth.tsx`** (cascada logo + formulario) |

---

## 1. Enrutamiento, Auth y Seguridad

### 1.1 Mapa de rutas

**Archivo:** `src/App.tsx`

| Ruta | Componente | Guardas |
|------|------------|---------|
| `/` | `Auth` (sin sesión) o `Workout` (con sesión) | `RootHomeGate` + `AppRoute` |
| `/auth`, `/onboarding` | Redirect → `/` | Legacy |
| `/timer` | `Timer` | `AppRoute` |
| `/cardio` | `Cardio` | `AppRoute` |
| `/nutrition` | `Nutrition` | `AppRoute` |
| `/profile` | `Profile` | `AppRoute` |
| `/cardio/:activityId`, `/actividad/:id` | `ActivityDetail` | `AppRoute` · sin BottomNav |
| `/coach` | `CoachPanel` | `AppRoute` + `CoachRoute` (`is_coach`) |
| `/paywall` | `Paywall` | `ProtectedRoute` (sin subscription guard) |
| `/verificado` | `VerifiedAccount` | `ProtectedRoute` |
| `/terminos` | `Terminos` | `ProtectedRoute` |
| `/admin` | `AdminPanel` | `AdminRoute` (email + `is_admin`) |
| `*` | `NotFound` | — |

**`AppRoute`:** `ProtectedRoute` + **`SubscriptionGuard`** (`expired` → `/paywall`).

### 1.2 Raíz `/` — Auth inline

```tsx
const RootHomeGate = () => {
  if (!user) return <Auth />;
  return <AppRoute><Workout /></AppRoute>;
};
```

Usuario no logueado ve **`Auth`** en `/` sin cambiar URL.

### 1.3 Pantalla Auth — formulario y animaciones

**Archivo:** `src/pages/Auth.tsx`

| Feature | Detalle |
|---------|---------|
| Login / Registro | Toggle · email · contraseña · DOB · género en registro |
| Validaciones | Email estricto · DOB 10–100 años · **`passwordMeetsPolicy`** · confirmación |
| Estilos adaptativos | **`useAuthStyles(isDark)`** |
| Tema UI | **`ThemeSegmentedControl`** flotante |
| Animación | Framer Motion cascada · `useReducedMotion()` |
| Submit loading | `Loader2 animate-spin` · `disabled` + `aria-busy` |
| Redirect holds | `signUpRedirectHold`, `biometricOfferHold` evitan flash post-login |

### 1.4 Login biométrico (Passkeys / WebAuthn)

**Archivos:** `src/lib/biometricAuth.ts` · `src/hooks/useBiometrics.ts` · `src/pages/Auth.tsx` · `src/pages/Profile.tsx`

Flujo **100% cliente**: WebAuthn platform authenticator → contraseña cifrada AES-GCM en vault local → `supabase.auth.signInWithPassword` al desbloquear. **No hay passkeys server-side en Supabase.**

#### API pública (`biometricAuth.ts`)

| Export | Rol |
|--------|-----|
| `BIOMETRIC_PROMPTED_KEY` | `'pana_biometrics_prompted'` |
| `BIOMETRIC_ENABLED_KEY` | `'pana_biometrics_enabled'` |
| `checkPasskeySupport()` | Secure context + WebAuthn + platform UV |
| `registerBiometricCredential(email, password)` | `navigator.credentials.create` + vault |
| `authenticateWithBiometric()` | `navigator.credentials.get` + decrypt |
| `isBiometricFlowEnabled()` | Flag enabled **o** credencial almacenada |
| `setBiometricFlowEnabled(bool)` | Escribe/borra flag enabled |
| `hasBiometricPromptBeenAnswered()` / `markBiometricPromptAnswered()` | Control toast post-login |
| `clearBiometricCredential()` | Borra credencial + desactiva flow |
| `getBiometricLabel()` | Face ID / Touch ID / Huella según UA |
| `BiometricAuthError` | `unsupported`, `cancelled`, `not_registered`, `session`, `unknown` |

#### Persistencia localStorage

| Clave | Contenido |
|-------|-----------|
| `pana_biometrics_prompted` | `'true'` tras responder toast de enrolamiento |
| `pana_biometrics_enabled` | `'true'` si el usuario prefiere login biométrico |
| `pana_biometric_credential_v1` (privada) | JSON: `credentialId`, `email`, `passwordCipher`, `registeredAt` |
| `pana_biometric_vault_key_v1` (privada) | Clave AES-GCM del vault |

#### UX en Auth

| Estado | UI |
|--------|-----|
| `flowEnabled` + login | Botón primario biométrico (`signInWithBiometric`) |
| Sin flow enabled | Login email/contraseña primario; hint para activar tras primer login |
| Post-login (una vez) | Toast Activar / Ahora no si supported + sin credencial + `!hasBiometricPromptBeenAnswered()` |

#### Toggle en Profile

**Archivo:** `src/pages/Profile.tsx`

| Acción | Comportamiento |
|--------|----------------|
| Switch **Inicio con {Face ID/…}** | `Switch` id `profile-biometric-login` |
| Activar | Dialog pide contraseña → `registerWithPassword` |
| Desactivar | `revokeCredential()` → `clearBiometricCredential()` |
| Cierre sesión | Credencial persiste en dispositivo; requiere login manual o biométrico según flags |

### 1.5 Cliente Supabase y suscripción

| Pieza | Archivo |
|-------|---------|
| Cliente | `src/integrations/supabase/client.ts` |
| Auth hook | `src/hooks/useAuth.tsx` |
| Trial / premium | `src/hooks/useSubscriptionStatus.tsx` |
| Heartbeat actividad | `ProfileLastActivePing` → `profiles.last_active_at` |

---

## 2. Entrenamiento — `Workout.tsx`

### 2.1 Persistencia fecha y unicidad logs

- Fecha calendario **local** `YYYY-MM-DD` (no UTC) en consultas `workout_date`.
- Upsert conflict: **`onConflict: 'user_id,workout_date,modality,gym_routine_id'`** (`persistWorkoutLogs.ts`, `Workout.tsx`).
- Migración **`20260517180000_workout_logs_unique_include_gym_routine.sql`**: `UNIQUE NULLS NOT DISTINCT (user_id, workout_date, modality, gym_routine_id)`.
  - `gym_routine_id IS NULL` → un log personal por día+modalidad.
  - `gym_routine_id` definido → un log por rutina de gimnasio.

### 2.2 Modo Personal vs Modo Gimnasio

| Concepto | Implementación |
|----------|----------------|
| Visibilidad switch | `showGymSwitch` si coach vinculado o `is_coach` |
| Persistencia scope | `localStorage` **`fitnesspana.workout.scope`** (`personal` \| `gimnasio`) |
| Persistencia modalidad | **`fitnesspana.workout.activeModalidad`** |
| `isGymView` | `showGymSwitch && workoutScope === 'gimnasio'` |
| Sin coach | Switch oculto; scope forzado a `personal` |

**Segmented control Personal/Gimnasio:** clase `workout-gym-scope-tablist` · track `bg-zinc-100` (light) · activo `bg-primary text-zinc-950` · **`active:scale-[0.97]`** · Pink overrides en `index.css`.

**Contexto coach:** `profiles` + RPC **`get_linked_coach_gym`** · `gymSourceCoachProfileId` · `modalityIdsAllowedByGymLabels`.

### 2.3 Pestañas de modalidad

**Componente:** `src/components/WorkoutModalityTabs.tsx`

| Token | Light | Dark |
|-------|-------|------|
| Track | `bg-zinc-100 ring-1 ring-zinc-200` | `bg-zinc-900 ring-white/5` |
| Tab activo | `bg-primary text-zinc-950 shadow-[0_4px_12px_-2px_rgba(57,255,20,0.25)]` | mismo |
| Tab inactivo | `text-zinc-600 hover:bg-zinc-200/60` | `text-zinc-400` |
| Press | `active:scale-[0.97]` | — |

En gym view filtra por `allowedModalities` del gimnasio.

### 2.4 Modo Personal — musculación y conditioning

| Modalidad | UI vacía / carga |
|-----------|------------------|
| **Musculación** | Lista `ExerciseCard` · botón **+ Agregar ejercicio** · form inline (nombre, grupo muscular, confirmar). **Sin** texto descriptivo intermedio (*"Agrega tu primer ejercicio…"* eliminado). Contenedor vacío de cards **no se renderiza** si `strengthExerciseCards.length === 0` → alineación vertical del botón idéntica a CF/Funcional. |
| **CrossFit / Funcional** | Editor colapsado hasta **Agregar rutina de CrossFit/Funcional** · paneles `CrossfitWodLogPanel` / `FunctionalSessionLogPanel` |
| Día pasado sin datos | `showEmptyPastState` → copy + **Cargar rutina** (`enableEmptyDay`) |

**Squish táctil (lifting visual):** `active:scale-[0.97]` en celdas gym, scope tabs, modality tabs, botón reporte diario; `active:scale-[0.98]` en variant picker rows.

### 2.5 Modo Gimnasio — rutinas multi-variante (A/B/C)

#### Base de datos

**Migración:** `supabase/migrations/20260535000000_gym_routines_variants.sql`

| Cambio | Detalle |
|--------|---------|
| Columna | `variant_name text` nullable |
| Índice eliminado | `gym_routines_coach_modality_day_unique` |
| Índice nuevo | `(coach_id, modality, day_number, variant_name)` **`NULLS NOT DISTINCT`** |
| Semántica | `NULL` = rutina principal del día; nombres distintos = variantes A/B/C |

Tabla base: **`20260527120000_gym_routines.sql`** · pulido **`20260528120000_gym_mode_polish.sql`** (`coach_notes`, días 1–6, FK `workout_logs.gym_routine_id`).

#### Helpers

| Archivo | Funciones |
|---------|-----------|
| `src/lib/gymRoutineVariants.ts` | `normalizeGymVariantName`, `gymVariantDisplayLabel`, `gymRoutinesForDay`, `groupGymRoutinesByDay` |
| `src/lib/gymRoutineWorkoutData.ts` | `parseGymRoutineWorkoutData`, `serializeGymRoutinePayload`, **`gymRoutineExercisePreviewLine`** |

`gymRoutineExercisePreviewLine`: extrae nombres únicos de ejercicios (musculación / bloques CF / fases funcional) → string comma-separated.

#### Flujo alumno — grilla 6 días

**Fetch:** `gym_routines` por `coach_id`, `modality`, orden `day_number`, `variant_name` (nulls first).

| Clic en día | Comportamiento |
|-------------|----------------|
| 0 rutinas | Celda disabled · **Sin rutina** |
| 1 rutina | Abre sheet viewer directo |
| 2+ rutinas | **`GymRoutineVariantPickerSheet`** → elige variante → viewer |

**Celdas:** `workout-gym-day-cell` · `--filled` (log emerald) · `--viewing` · punto neón si rutina sin log · multi-variante: variantes apiladas + pie `N opciones` / `N registrada(s)`.

#### GymRoutineVariantPickerSheet

**Archivo:** `src/components/GymRoutineVariantPickerSheet.tsx`

| Elemento | Detalle |
|----------|---------|
| Título default | *Elige tu variante para hoy* |
| Tarjeta | Label variante · **Día N** · preview ejercicios |
| Preview CSS | `text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed` |
| Logged | Badge **Registrado** + borde emerald si `loggedRoutineIds` |
| Coach | Título *Elegí qué variante editar* · botón **Agregar otra variante** |

### 2.6 Pizarra digital — `GymRoutineBlockViewer`

**Archivo:** `src/components/GymRoutineBlockViewer.tsx`

Activación alumno: `variant="chalkboard"` en sheet `Workout.tsx`.

| Prop | Rol |
|------|-----|
| `variantName` | Etiqueta variante (Opción A, Piernas, …) |
| `title`, `dayNumber`, `coachNotes`, `payload` | Contenido rutina |
| `hideDayBanner`, `hideCoachNotesSection` | Previews plantillas |

**Encabezado chalkboard:**

```text
RUTINA DEL DÍA          ← h2 text-primary uppercase tracking-widest

        DÍA N           ← text-sm font-black text-zinc-100
     OPCIÓN A           ← si variantName: text-[10px] tracking-[0.28em] text-zinc-400 uppercase

[Instrucciones del coach — dashed border-zinc-800]
[Entrenamiento — título rutina]
[Contenido modalidad: CF / Funcional / lista musculación]
```

Panel: **`gym-chalkboard-panel`** · `bg-zinc-950` · ejercicios `text-zinc-100` · metadatos `text-zinc-400` · tiempos `font-mono font-black`.

**Preview coach en vivo:** `GymRoutineCoachDialog` incluye chalkboard preview con `variantNameDraft` al final del formulario.

### 2.7 Sheets gym (alumno)

| Sheet | Componente |
|-------|------------|
| Visor rutina | `GymRoutineBlockViewer` chalkboard + `Sheet` bottom `max-h-[88vh]` |
| Ranking CF/Func | `GymRoutineLeaderboard` |
| Registrar resultado | `GymRoutineRegisterSheet` |
| Elegir variante | `GymRoutineVariantPickerSheet` |

Al cambiar `dateStr` se cierran viewer, registro, variant picker, reportes.

### 2.8 Alcance Personal — filtro logs

```text
personal  → workout_logs con gym_routine_id == null
gimnasio  → workout_logs con gym_routine_id != null
```

Drafts CF/Func se hidratan del subconjunto activo en `fetchExercises`.

### 2.9 CrossFit, Funcional, biblioteca

| Área | Archivos |
|------|----------|
| Drafts CF | `src/lib/crossfitWodDraft.ts` · subtipos AMRAP/EMOM/For Time/Clásico |
| Drafts Func | `src/lib/functionalSessionDraft.ts` · fases + métodos |
| Paneles UI | `CrossfitWodLogPanel.tsx` · `FunctionalSessionLogPanel.tsx` |
| Persistencia | `src/lib/persistWorkoutLogs.ts` |
| Sugerencias nombres | `ExerciseNameSuggestInput.tsx` → `exercises_library` |
| Sync biblioteca | `src/lib/exerciseLibrarySync.ts` |
| Plantillas usuario | `TemplatesSheet.tsx` |
| PRs | `PersonalRecordsSheet.tsx` |
| Informe día | `DailyReportSheet.tsx` |
| Header quick actions | EJERCICIOS / PR en `PageScreenHeader` |

---

## 3. Panel Coach (`/coach`)

**Archivo:** `src/pages/CoachPanel.tsx` · ruta **`CoachRoute`** · sin BottomNav.

### 3.1 Biblioteca de rutinas

| Feature | Detalle |
|---------|---------|
| Modalidades | Pills filtradas por `gym_modalities` del perfil |
| Grilla 6 días | Variantes apiladas si >1 · click ≤1 → editor directo · >1 → `GymRoutineVariantPickerSheet` |
| Nueva rutina | Botón abre `GymRoutineCoachDialog` |
| Plantillas | `CoachTemplatePickerSheet` → prefill editor |

### 3.2 GymRoutineCoachDialog

**Archivo:** `src/components/GymRoutineCoachDialog.tsx`

| Campo | Detalle |
|-------|---------|
| Título | Texto libre |
| Día | Select 1–6 (solo rutina nueva) |
| **Variante / Opción (Opcional)** | Placeholder *Ej: Opción A, Piernas, Nivel Avanzado* → `normalizeGymVariantName` → `variant_name` NULL si vacío |
| Notas coach | `coach_notes` → visible en pizarra alumno |
| Payload | `workout_data` JSON tipado `GymRoutineWorkoutPayload` |
| Guardar | `update` por `id` si edición · `insert` si nueva · error `23505` → toast variante duplicada |
| Checkbox | Guardar también en `workout_templates` vía `insertCoachGymSnapshotTemplate` |
| Preview | Chalkboard en vivo al pie del dialog |
| Eliminar | `delete` por `id` |

### 3.3 Alumnos

- RPC **`get_coach_students`** · actividad **`lastActivityLabel.ts`**
- Desvincular: **`coach_remove_student`**
- Código invitación en **`Profile.tsx`** (lado alumno: **`link_student_to_coach`**)

### 3.4 Plantillas coach

| Columna | Uso |
|---------|-----|
| `routine_category` | `musculacion` \| `crossfit` \| `funcional` |
| `structured_payload` | Snapshot JSON |
| `coach_notes` | Migración `20260531120000` |

Inserción: **`src/lib/coachWorkoutTemplates.ts`**.

---

## 4. Ranking gym (leaderboard)

**Archivo:** `src/components/GymRoutineLeaderboard.tsx`

- Solo **crossfit** y **funcional**.
- RPC **`get_gym_routine_leaderboard(p_gym_routine_id, p_workout_date)`** — SECURITY DEFINER · aislamiento por `coach_id` de la rutina.
- Sort/dedup: **`src/lib/gymRoutineQuickResult.ts`**
- Clases: `workout-gym-leaderboard`, `workout-gym-lb-row`, `workout-gym-lb-own`

---

## 5. Timer — `Timer.tsx` (`/timer`)

| Concepto | Detalle |
|----------|---------|
| Presets | `localStorage` **`pana_arena_presets_v1`** |
| Fases | `idle` \| `prep` \| `work` \| `rest` \| `setRest` \| `done` |
| Jerarquía | Sets → Rondas → work ↔ rest |
| UI colores | prep amarillo · work `--brand-color` · rest celeste · setRest rojo · pausa rojo |
| Audio | `/sounds/Boxeo.mp3` + Web Audio bips + TTS |
| Haptics | `src/lib/haptics.ts` |

Independiente de `workout_logs`.

---

## 6. Nutrición — `Nutrition.tsx`

**Tablas:** `nutrition_logs`, `food_entries` (legacy), `custom_foods`, `hydration_logs`, `step_logs`, `recovery_logs`, `profiles.step_goal`.

| Pestaña | Features |
|---------|----------|
| **Diario** | Anillo calorías SVG + **`CountUpSpan`** · barras macros · comidas 4 tipos · hidratación · **`StepsRing`** compact (migrado desde Perfil) · bienestar sueño/energía → `recovery_logs` |
| **Mis alimentos** | CRUD `custom_foods` · escáner **`NutritionBarcodeScanner`** · Open Food Facts **`openFoodFacts.ts`** · macros bidireccionales per-100g ↔ consumido |

Inputs numéricos modal: draft string + **`sanitizeFreeDecimalTyping`** (no bloqueo en 0).

---

## 7. Cardio y actividades

| Área | Archivo / tabla |
|------|-----------------|
| Corrida GPS live | `Cardio.tsx` · `activities` |
| Detalle + mapa | `ActivityDetail.tsx` |
| Pace heatmap | `paceHeatmap.ts` · `PaceHeatPolylines.tsx` |
| HR Bluetooth | `hrBluetooth.ts` |
| Análisis ruta | `runAnalysis.ts` |
| SW notificaciones | Comentado en `Cardio.tsx` |

Overlay guardado: *Guardando tu actividad…* + spinner.

---

## 8. Compartir actividad — `ShareSticker.tsx`

- Export PNG vía `html-to-image` · temas day/night · logo Pana · distancia grande · **`ActivityDetail.tsx`** panel share · Web Share API + fallback download.

---

## 9. Perfil — `Profile.tsx`

| Bloque | Detalle |
|--------|---------|
| Identidad | Nombre, avatar crop/upload Supabase `avatars`, altura/peso/meta |
| Stats | IMC, TDEE, proteína, hidratación |
| Tema UI | `ThemeSegmentedControl` |
| Marca VIP | Banner Modo Rosita si `profiles.theme === 'pink'` |
| **Biometría** | Switch + dialog contraseña (§1.4) |
| Coach alumno | Link/unlink coach · código · `/coach` si `is_coach` |
| Suscripción | Badges trial/premium/tester · modals |
| FAQ | Abre **`FAQBottomSheet`** |
| Admin | Botón `/admin` si allowlist |
| Contraseña | Modal confirmación + **`PasswordRequirementsList`** |
| Peso histórico | **`WeightEvolutionSheet`** |
| WhatsApp | **`supportWhatsApp.ts`** |
| Términos | Link `/terminos` |
| Logout | Confirm dialog |

---

## 10. FAQ, Paywall y flujos legales

### 10.1 FAQBottomSheet

**Archivo:** `src/components/FAQBottomSheet.tsx` · Drawer accordion · abierto desde Perfil.

| # | Tema | Contenido codificado |
|---|------|----------------------|
| 1 | Suscripción | 7 días trial gratis → mensual |
| 2 | **Métodos de pago** | Transferencia Mercado Pago alias **`tomaspanadeiro.mp`** + botón copiar (`CopyAliasButton` / Clipboard API) |
| 3 | Confirmar pago | Comprobante por WhatsApp |
| 4 | Activación | Manual por admin · horas |
| 5 | Vencimiento | Datos conservados · bloqueo carga nueva hasta renovar |

Footer: **Contacto directo** → `getSupportWhatsAppUrl()`.

**Nota factual:** el FAQ **no** incluye copy sobre Modo Personal vs Gimnasio; esa distinción vive en **`Workout.tsx`** (switch scope + copy de grilla gym).

### 10.2 Paywall — `Paywall.tsx`

- Trial vencido · pasos Mercado Pago manual · alias copy · **Ya pagué · Verificar acceso** · sign out.

### 10.3 Términos — `Terminos.tsx`

Secciones estáticas: disclaimer salud, privacidad, uso.

### 10.4 Verificado — `VerifiedAccount.tsx`

Post-confirmación email · mensaje trial 7 días.

---

## 11. Pink Mode (`data-brand=pink`)

**`src/lib/brandTheme.ts`:** `--brand-color #ff007f` · `--primary` HSL fucsia · `dataset.brand = 'pink'` · clase `pink-mode`.

**`src/index.css` overrides gym:** scope tabs, modality tabs, day cells, register CTA, leaderboard own row, coach notes panel — sin glows agresivos en modo día.

Chalkboard (`gym-chalkboard-panel`) mantiene estética zinc oscura independiente del pink en badges internos.

---

## 12. Panel Admin (`/admin`)

**Archivo:** `AdminPanel.tsx` · email **`thomzonlyskills@gmail.com`** + `is_admin`.

| Feature | RPC / acción |
|---------|--------------|
| Directorio usuarios | `admin_user_directory` |
| Roles suscripción | `set_user_subscription_role` · Free / Premium +30d / Tester ∞ |
| Extender premium | +30 días botón |
| Tema VIP | `set_user_theme` |
| Coach | `admin_set_coach_profile` · código `PANA-XXXX` |
| Borrado | Edge **`admin-delete-user`** |

Badges: admin verde · tester ∞ · premium · trial amarillo · vencido rojo.

---

## 13. Infraestructura compartida

### 13.1 Edge Function borrado

**`supabase/functions/admin-delete-user`:** borrado secuencial tablas `user_id` → `auth.admin.deleteUser`.

### 13.2 UI stack

| Pieza | Ubicación |
|-------|-----------|
| Radix primitives | `src/components/ui/*` |
| Tailwind + `cn()` | `src/lib/utils.ts` |
| Toasts | `use-toast` / `Toaster` |
| Sheets/Dialogs | `animate-in` tailwindcss-animate |

### 13.3 Estados de carga

Skeleton (Admin/Coach) · `Loader2` (Auth, Perfil, Cardio, escáner) · gates `null` mientras `loading` · leaderboard texto simple.

---

## 14. Inventario `src/lib/*.ts`

| Archivo | Propósito |
|---------|-----------|
| `age.ts` | Edad desde DOB |
| `avatarCrop.ts` | Crop circular → JPEG 512px |
| **`biometricAuth.ts`** | WebAuthn + vault local + flags localStorage |
| `brandTheme.ts` | Tema marca default/pink |
| `calories.ts` | Calorías/pasos estimados carrera |
| `coachWorkoutTemplates.ts` | Snapshot plantilla coach |
| `crossfitWodDraft.ts` | Modelo + serialize CF |
| `exerciseLibraryNaming.ts` | Categorías biblioteca |
| `exerciseLibrarySync.ts` | Sync entries faltantes |
| `functionalSessionDraft.ts` | Modelo + serialize Funcional |
| `gymRoutineQuickResult.ts` | Leaderboard + quick result |
| **`gymRoutineVariants.ts`** | Variantes A/B/C helpers |
| **`gymRoutineWorkoutData.ts`** | Payload JSON rutinas + **preview ejercicios** |
| `haptics.ts` | Vibración nav/timer/success |
| `hrBluetooth.ts` | Sensor FC BLE |
| `lastActivityLabel.ts` | Labels actividad admin/coach |
| `nutritionDay.ts` | Fechas locales nutrición |
| `openFoodFacts.ts` | API barcode OFF |
| `paceHeatmap.ts` | Colores ritmo mapa |
| `passwordPolicy.ts` | Reglas contraseña |
| `persistWorkoutLogs.ts` | Upsert logs conditioning/gym |
| `runAnalysis.ts` | GPS splits/elevación |
| `runFormat.ts` | fmtTime/fmtPace |
| `runTrackingSw.ts` | SW carrera |
| `supportWhatsApp.ts` | Link WhatsApp soporte |
| `weightProfileSync.ts` | Sync peso perfil |
| `workoutModality.ts` | IDs modalidades + bloques |
| `workoutNumericInput.ts` | Sanitize inputs WOD |
| `workoutPanelSemantics.ts` | Tokens Tailwind paneles CF/Func |
| `workoutTemplatesConditioning.ts` | Plantillas conditioning |
| `zxingCenterCropReader.ts` | Barcode center crop |
| `utils.ts` | `cn()` |

---

## 15. Inventario componentes clave (no-ui shell)

| Componente | Rol |
|------------|-----|
| `BottomNav.tsx` | Nav inferior 5 tabs |
| `PageScreenHeader.tsx` | Header páginas con slot derecho |
| `ExerciseCard.tsx` | Tarjeta set musculación / conditioning |
| `ExerciseNameSuggestInput.tsx` | Autocomplete ejercicios |
| `DailyReportSheet.tsx` | Informe consolidado día |
| `TemplatesSheet.tsx` | Plantillas + biblioteca ejercicios |
| `CoachTemplatePickerSheet.tsx` | Picker plantillas coach |
| **`GymRoutineCoachDialog.tsx`** | Editor rutina coach + variantes |
| **`GymRoutineVariantPickerSheet.tsx`** | Selector variante + preview ejercicios |
| **`GymRoutineBlockViewer.tsx`** | Visor rutina + chalkboard + **variantName header** |
| `GymRoutineRegisterSheet.tsx` | Registro resultado gym |
| `GymRoutineLeaderboard.tsx` | Ranking día |
| `CrossfitWodLogPanel.tsx` | Editor WOD CF |
| `FunctionalSessionLogPanel.tsx` | Editor sesión funcional |
| `WorkoutModalityTabs.tsx` | Tabs Musculación/CF/Func |
| `FAQBottomSheet.tsx` | FAQ suscripción + alias MP |
| `NutritionBarcodeScanner.tsx` | Cámara barcode |
| `ShareSticker.tsx` | Sticker compartir carrera |
| `PersonalRecordsSheet.tsx` | PRs usuario |
| `WeightEvolutionSheet.tsx` | Historial peso |
| `ThemeSegmentedControl.tsx` | Light/dark/system |
| `PasswordRequirementsList.tsx` | Checklist contraseña |
| `ProfileLastActivePing.tsx` | Ping `last_active_at` |
| `AvatarCropModal.tsx` | Crop avatar |
| `CaloriesRing.tsx` / `StepsRing.tsx` | Anillos progreso |
| `PaceHeatPolylines.tsx` / `KmMilestoneMarkers.tsx` | Mapa carrera |
| `SwipeToDelete.tsx` | Gestos borrado listas |
| `CountUpSpan.tsx` | Animación números |

**Shell ui/:** ~40 primitivos Radix (button, dialog, sheet, drawer, select, switch, tabs, …).

---

## 16. Supabase — tablas y RPCs (migraciones)

### Tablas principales

`profiles` · `exercises` · `exercise_sets` · `workout_logs` · `workout_templates` · `template_exercises` · `exercises_library` · **`gym_routines`** (+ `variant_name`, `coach_notes`, `workout_data`) · `activities` · `custom_foods` · `nutrition_logs` · `food_entries` · `hydration_logs` · `step_logs` · `recovery_logs` · `weight_logs` · `personal_records` · `body_measurements` · `progress_photos`

### RPCs en migraciones

| RPC | Rol |
|-----|-----|
| `get_coach_students` | Lista alumnos coach |
| `link_student_to_coach` / `unlink_student_from_coach` | Vínculo alumno-coach |
| `get_linked_coach_gym` | Info gym para alumno |
| `coach_remove_student` | Desvincular alumno |
| `get_gym_routine_leaderboard` | Ranking rutina gym |
| `admin_user_directory` | Directorio admin |
| `admin_set_coach_profile` | Alta coach |

### RPCs referenciadas en app (sin SQL en repo)

`set_user_subscription_role` · `set_user_theme`

### Migraciones clave (orden funcional)

| Archivo | Tema |
|---------|------|
| `20260527120000_gym_routines.sql` | Tabla rutinas coach |
| `20260528120000_gym_mode_polish.sql` | coach_notes, FK logs, leaderboard RPC, días 1–6 |
| **`20260535000000_gym_routines_variants.sql`** | **variant_name + unique multi-variante** |
| `20260517180000_workout_logs_unique_include_gym_routine.sql` | Unicidad logs gym |
| `20260516100000_workout_logs.sql` | Tabla workout_logs |
| `20260517140000` / `18100000` | crossfit_details / functional_details |
| `20260523120000_profiles_coach_mode.sql` | Modo coach |
| `20260524100000_link_student_coach_rpcs.sql` | RPCs vínculo |
| `20260531120000_workout_templates_coach_notes.sql` | Notas plantillas |

---

## 17. Animaciones y micro-interacciones (resumen)

| Patrón | Dónde |
|--------|-------|
| `active:scale-[0.97]` | Scope gym tabs, modality tabs, celdas día gym, reporte día |
| `active:scale-[0.98]` | Filas variant picker, algunos botones |
| `active:scale-90` | BottomNav tabs |
| `transition-all duration-200\|300` | Botones, tabs, cards |
| Framer Motion cascada | Solo Auth |
| `animate-in` / `slide-in` | Dialogs/Sheets Radix |
| Ring calorías stroke-dashoffset | Nutrition 900ms easing |
| Grain overlay | Siempre visible (body::after) |
| Ambient glow | Fixed blur primary en App shell |

---

## 18. Pendientes técnicos (observados en código)

1. **SW notificaciones carrera** en `Cardio.tsx`: comentado — re-habilitar pre–App Store.
2. **BottomNav + teclado virtual:** no implementado (`visualViewport`).
3. **`touch-action: manipulation` global:** ausente.
4. **`body_measurements` / `progress_photos`:** en schema/admin delete; sin UI usuario dedicada.
5. **RPCs suscripción/tema:** usadas en app; migraciones SQL no incluidas en repo.
6. **Nutrición dual:** `nutrition_logs` + `food_entries` coexisten en informes.
7. **FAQ:** no documenta Modo Personal (solo alias/pago); scope gym documentado en código Workout.

---

*Fin del inventario. Mantener sincronizado con diffs reales en `src/` y `supabase/migrations/`.*
