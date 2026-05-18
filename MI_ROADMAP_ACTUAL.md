# MI_ROADMAP_ACTUAL — Inventario técnico (estado del repo)

Documento de **control personal**: radiografía del código **implementado hoy**, no backlog de producto. Las rutas bajo `src/` y migraciones Supabase se citan para orientar soporte y evolución.

---

## 1. Entrenamiento: `Workout.tsx` y convivencia **Modo Personal** / **Modo Gimnasio**

### 1.1 Persistencia base y filtro por fecha (`workout_date`)

- Todas las consultas principalistas usan fecha calendario **local** `YYYY-MM-DD` construido con año/mes/día del dispositivo (no `toISOString()` UTC) para evitar desfasajes: ver `formatLocalDateISO` en **`src/pages/Workout.tsx`**.
- Ejercicios de musculación: tabla **`exercises`** filtrada por **`workout_date === dateStr`** y `user_id`.
- Bloques Conditioning (CrossFit / Funcional): contenido proyectado desde **`workout_logs`** para el mismo día, según alcance Personal vs Gimnasio (ver más abajo).
- Persistencia tipo upsert desde utilidades **`src/lib/persistWorkoutLogs.ts`** y flujos de guardado locales en `Workout.tsx`, siempre declarando **`onConflict: 'user_id,workout_date,modality,gym_routine_id'`** donde aplica una sola fila canónica.

### 1.2 Unicidad flexible: más de un resultado por día (gimnasio)

Migración **`supabase/migrations/20260517180000_workout_logs_unique_include_gym_routine.sql`**:

| Antes | Ahora |
|--------|--------|
| Unicidad sólo sobre `(user_id, workout_date, modality)` | `UNIQUE NULLS NOT DISTINCT (user_id, workout_date, modality, gym_routine_id)` |

Interpretación práctica según código:

- **`gym_routine_id IS NULL`**: máximo **un** log “personal” por usuario, día calendario y modalidad (`musculacion` \| `crossfit` \| `funcional`).
- **`gym_routine_id` definido**: el mismo día puede tener **uno por rutina**, es decir un alumno registra resultado **aislado** por la combinación día + modalidad + id de rutina (`exercises`/detalles Conditioning enlazados a ese log donde corresponda).

Índices auxiliares y FK: ver **`supabase/migrations/20260528120000_gym_mode_polish.sql`** (columna **`gym_routine_id`** + índice parcial sobre rutina/fecha).

### 1.3 Detección de contexto Coach / Alumno y visibilidad del switch

Implementado en el `useEffect` inicial de **`src/pages/Workout.tsx`** leyendo **`profiles`**:

| Campo / condición | Efecto |
|-------------------|--------|
| **`is_coach === true`** y `profiles.id` | El mismo usuario usa sus **`gym_modalities`** definidos en perfil como coach (`gymSourceCoachProfileId = myProfileId`). |
| **`coach_id`** (alumno vinculado) | Obtiene etiquetas desde RPC **`get_linked_coach_gym`** y fuerza modalities permitidas mediante **`modalityIdsAllowedByGymLabels`**. |

Sólo si `coachCtxReady` y existe alumno-coach **o** el usuario es coach: **`showGymSwitch`** enseña pestañas **Personal** / **Gimnasio** y persiste alcance en `localStorage` (`fitnesspana.workout.scope`).

Si el alumno/coach pierde ese contexto, el estado fuerza **`workoutScope = 'personal'`**.

### 1.4 Carga de rutinas públicas (`gym_routines`)

En modo Gimnasio, `Workout.tsx` fetchea **`gym_routines`** con:

- **`coach_id = gymSourceCoachProfileId`** (`profiles.id` del coach dueño).
- **`modality`** igual a la pestaña Musculación / CrossFit / Funcional activa.
- Orden **`day_number`**.

Contrato BD (creación inicial): **`supabase/migrations/20260527120000_gym_routines.sql`**; pulido día 6 máx: **`supabase/migrations/20260528120000_gym_mode_polish.sql`** (rutina **por coach + modalidad + día 1–6**, columna **`workout_data` JSON**, **`coach_notes`** visible alumno).

### 1.5 Grilla semanal (UX)

- Celas **“Día 1 … Día 6”**: clases **`workout-gym-day-cell`**, **`workout-gym-day-cell--filled`**, **`workout-gym-day-cell--viewing`** en `Workout.tsx` + estilos **Pink Mode** en **`src/index.css`** (bloque `html[data-brand='pink']` · grilla gym).
- `gymRoutineLogById`: mapa **`gym_routine_id` → último log** cargado ese día desde `workout_logs` ya filtrados por alcance Gym.
- Sheets: visor rutina (**`GymRoutineBlockViewer`**, **`Sheet`**), ranking (**`GymRoutineLeaderboard`**), alta/edición rápida (**`GymRoutineRegisterSheet`**).
- Al cambiar **fecha seleccionada** (`dateStr`) se cierran viewer/registro/reportes para evitar datos cruzados con otro día.

### 1.6 Alcance Personal: filtro en memoria

Tras cargar **`workout_logs`** del día desde Supabase (`select *` mismo `user_id` + `workout_date`), el código **parte** entre:

```text
personal  → sólo logs con gym_routine_id == null  
gimnasio  → sólo logs con gym_routine_id != null
```

Los paneles Conditioning y drafts (`crossfitDraft` / `functionalSessionDraft`) se hidratan a partir del subconjunto activo — ver bucle **`fetchExercises`** en **`Workout.tsx`**.

### 1.7 Pestañas de modalidad (además del switch Personal/Gimnasio)

- Persistencia **`fitnesspana.workout.activeModalidad`** como ya documentado (**`src/lib/workoutModality.ts`**, componente **`src/components/WorkoutModalityTabs.tsx`**).
- En modo Gym, si la modalidad activa ya no está en las permitidas por el gym, **`useEffect`** reasigna a la primera modality permitida.

### 1.8 CrossFit y Funcional — subtipos y persistencia general

Igual alcance técnico descrito antes en esta code-base:

- **`src/lib/crossfitWodDraft.ts`**, **`src/components/CrossfitWodLogPanel.tsx`** (`CrossfitWodSubtype`: AMRAP, EMOM, for_time, classic_benchmark_tabata; warm-up separado).
- **`src/lib/functionalSessionDraft.ts`**, **`src/components/FunctionalSessionLogPanel.tsx`** (fases, métodos rounds_circuit · time_intervals · tabata, etc.).
- **`src/lib/exerciseLibrarySync.ts`**: escritura diferida tras guardar Conditioning o confirmar alta musculación.
- **`src/components/ExerciseNameSuggestInput.tsx`**: sugerencias en dos consultas paralelas a **`exercises_library`**.

*(La numeración técnica de subtipos y columnas consolidadas como `deriveCrossfitTotalTimeColumn` siguen válidas desde el mismo código mencionado en versiones previas de este archivo.)*

---

## 2. Panel Coach (`/coach`), rutinas BD y Biblioteca de plantillas

### 2.1 Ruta y acceso

- **`src/App.tsx`**: **`Route path="/coach"`** dentro de **`CoachRoute`**.
- **`CoachRoute`**: consulta **`profiles.is_coach`**; si es falso → redirección a **`/`**; mientras tanto `null`.
- **`src/components/BottomNav.tsx`** **no muestra** la barra en **`/coach`** (igual que admin y detalle cardio).

Archivo pantalla principal: **`src/pages/CoachPanel.tsx`**.

### 2.2 Dashboard coach (alumnos + “pizarra semanal”)

- Lista alumnos: RPC **`get_coach_students`**; columnas de actividad reutilizan utilidades **`src/lib/lastActivityLabel.ts`** (puntos estado / “● En línea” en últimos ~3 min vía **`ADMIN_ONLINE_WINDOW_MS`**).
- **Nombre de gimnasio** y modalities: campos **`gym_name`**, **`gym_modalities`** en **`profiles`**.
- Rutinas cargadas igual que lado alumno: **`gym_routines`** donde **`coach_id === profiles.id`** del coach auth.
- Alta/edición día: **`GymRoutineCoachDialog`** (**`src/components/GymRoutineCoachDialog.tsx`**): upsert a **`gym_routines`** (incl. **`coach_notes`**, **`workout_data`** JSON con payload tipado **`GymRoutineWorkoutPayload`** en **`src/lib/gymRoutineWorkoutData.ts`**).

### 2.3 Biblioteca de plantillas del coach (`workout_templates`)

Pantalla integra **`CoachTemplatePickerSheet`** (**`src/components/CoachTemplatePickerSheet.tsx`**):

| Columna / concepto | Uso |
|--------------------|-----|
| **`routine_category`** | Valores válidos **`musculacion` \| `crossfit` \| `funcional`** (constraint en migración **`20260515103000_workout_templates_conditioning.sql`**). |
| **`structured_payload`** | JSON (snapshot del WOD/session o rutina gym serializada para rehidratar el editor). |
| **`coach_notes`** | Migración **`20260531120000_workout_templates_coach_notes.sql`**; visible al elegir plantilla y al copiar a rutina (`CoachTemplatePickerSheet` + dialogs). |

Inserción programática cuando el coach guarda rutina gym como plantilla reusable: **`src/lib/coachWorkoutTemplates.ts`** → **`insertCoachGymSnapshotTemplate`** (`user_id` = auth.uid del coach, categoría inferida desde modalidad).

*(Las plantillas de usuario “Mis rutinas” del flujo alumno siguen pasando también por **`TemplatesSheet.tsx`** usando las mismas columnas.)*

### 2.4 Desvincular alumno

- Confirmación **`AlertDialog`**; RPC **`coach_remove_student`** (`CoachPanel.tsx`).

---

## 3. Ranking (leaderboard) aislado por “gym” del coach

### 3.1 Componente frontal

**`src/components/GymRoutineLeaderboard.tsx`**:

- Visible sólo modalidad **`crossfit`** o **`funcional`** (Musculación no lista ranking desde este widget).
- RPC **`get_gym_routine_leaderboard`** pasando **`p_gym_routine_id`** y **`p_workout_date`** (misma fecha local soberbia que usa `Workout.tsx`).
- Orden/visualización tras **`sortGymLeaderboardRows`** y deduplicación “mejor fila por usuario”: **`src/lib/gymRoutineQuickResult.ts`**.
- Copy UX: ranking del día entre quienes comparten rutina/coach (**texto literal en UI**).

### 3.2 Aislamiento en base de datos (`SECURITY DEFINER`)

Implementación oficial: función en **`supabase/migrations/20260528120000_gym_mode_polish.sql`**:

1. Obtiene **`v_coach = gym_routines.coach_id`** de la rutina solicitada.
2. Comprueba que **`auth.uid()`** corresponda a perfil alumno (**`profiles.coach_id = v_coach`**) **o** al propio coach (**`profiles.id = v_coach`**); si no → excepción **forbidden**.
3. **`RETURN QUERY`** filtra **`workout_logs`** con **`gym_routine_id`** y fecha exactos, modalidad Conditioning, y **`profiles`** pegado donde **`coach_id`** del participante coincide con **`v_coach`** **o** el participante es el coach (`profiles.id = v_coach`).

Resultado: la competencia queda **acotada al “grupo coach” derivado del `coach_id`** de esa rutina, sin mezcla de otros gyms.

---

## 4. **Timer.tsx** (`/timer`) — UI modernizada (lógica Tabata preservada)

**`src/pages/Timer.tsx`** (independiente de `workout_logs`; presets en **`localStorage`** `pana_arena_presets_v1`):

| Aspecto | Comportamiento en código actual |
|---------|---------------------------------|
| Fases temporales | `prep` · `work` · `rest` · `idle` · `done` con interval `setInterval` 1 Hz (no alterado conceptualmente por la UI). |
| Colores de fondo pantalla completa | Pausado → **`#DC2626`**; Prep → **`#FACC15`**; Work → **`var(--brand-color)`**; Rest → **`#38BDF8`**; Idle/done → `hsl(var(--background))`. |
| Estado principal (titular grande, mayúsculas) | Prep / Work / Rest con copys **PREPARATE** / **¡A ENTRENAR!** / **DESCANSÁ**; si **`paused`** en fase activa → siempre **`EN PAUSA`** (**`text-white`**) sustituye cualquier otro mensaje. |
| Digitos tiempo | **`font-black`**, **`tabular-nums`**, escala **`clamp`** grande; tinte dígitos coherentes por fase (incluido modo pausa sobre rojo). |
| Badge | **RONDA n / total** tipo pill tras el reloj; estado final **COMPLETADO**. |
| Controles Play/Pausa | Botón disco **blanco**, iconos **`text-[color:var(--brand-color)]`** (variable de marca aplicada desde **`applyBrandTheme`**), halo **`shadow-white/20`** + **`shadow-lg`**; **`Reiniciar`** secundario tipo pill textual. |
| Audio | Sintético cuenta atrás (`AudioContext` compartido) + **`public/sounds/Boxeo.mp3`** entre fases; priming táctil en primer play. |

---

## 5. Perfil — cambio de contraseña (`src/pages/Profile.tsx`)

Modal **“Cambiar contraseña”** (componentes **`Dialog`**, **`Input`**) exige:

- Campo **nueva contraseña** (`newPassword`).
- Segundo campo **confirmar** (`confirmPassword`) sincronizado.
- Estado **`passwordsMatch = newPassword === confirmPassword`**; si falsas → **`toast`** con título tipo *Las contraseñas no coinciden* sin llamar Supabase.
- Políticas de complejidad: **`passwordMeetsPolicy`** (**`src/lib/passwordPolicy.ts`**) renderizadas como **`PasswordRequirementsList`** en el mismo diálogo.
- **`disabled`** en el botón **Actualizar contraseña** si `!passwordsMatch` ó `!newPasswordOk` ó `changingPassword`.
- Spinner **`Loader2 animate-spin`** durante **`supabase.auth.updateUser({ password })`**.

Esta UX es una **capa cliente** sobre Supabase Auth; no reemplaza la política de contraseña del proveedor configurada en el proyecto.

---

## 6. Identidad **Pink Mode** (`data-brand=pink`)

### 6.1 Aplicación de variables desde React

**`src/lib/brandTheme.ts`**: función **`applyBrandTheme`** al hidratar perfil (**`BrandThemeApplier`** en **`src/App.tsx`**) establece:

- `document.documentElement.dataset.brand === 'pink' | implícito default`
- clase **`pink-mode`** sólo cuando el tema VIP es rosado.
- Overrides de **`--brand-color`**, **`--primary`**, glows (`--brand-glow*`).

### 6.2 CSS puro y convivencia con Light / Dark

**`src/index.css`**:

| Mecánica | Descripción |
|----------|-------------|
| **Modo día** acentos legibles sobre blanco | Reglas **`html:not(.dark):not([data-brand="pink"]) .text-primary`** (verde `green-700`) vs **`html:not(.dark)[data-brand="pink"] .text-primary`** (rosa `#ff007f`). Rings/borders paralelos sin tocar **`--card`/`--background`**. |
| **Bloque gym rosa VIP** | Bajo **`html[data-brand='pink']`** (usando comillas aptas también en algunos tokens Tailwind dentro de JSX como `[html[data-brand='pink']_&]`), estiliza **solo** overlays de marca: **`workout-gym-scope-tablist`**, **`workout-modality-tabs`**, celdas **`workout-gym-day-*`**, CTA registrar, ranking **`workout-gym-lb-own`**, badges pizarra **`.gym-routine-block-badge`**, **`workout-coach-notes-panel`**. |

Resultado práctico: **Light/Dark** siguen aplicados desde **`ThemeProvider`** (clase `dark` global); Pink **solo reemplaza tintes de marca** donde el equipo colocó selectores conscientes (`[data-brand]` + clases nominadas tipo `workout-gym-*`) — **los fondos sistema (`--background`, `--card`) no se aplastan por el VIP rosa.**

---

## 7. Cardio y salud (resumen)

| Área | Archivos / tabla |
|------|-------------------|
| Corrida en vivo + guardado GPX | **`src/pages/Cardio.tsx`** · **`activities`** |
| Detalle trayecto compartibles | **`src/pages/ActivityDetail.tsx`** |
| Nutrición y diario consumo hidratación recuperación pasos consolidado DailyReportSheet | **`src/pages/Nutrition.tsx`**, utilidades **`src/lib/nutritionDay.ts`**, **`src/components/DailyReportSheet.tsx`**, **`food_entries`** / **`nutrition_logs`** / **`hydration_logs`** / **`recovery_logs`** / **`step_logs`** |

**Cardio overlay guardado**: bloque JSX con texto *“Guardando tu actividad…”* + **spinner Tailwind** (`animate-spin` + bordes `border-primary`).

---

## 8. Infraestructura, Auth, Admin, suscripción

### 8.1 Auth y guardas

- Cliente Supabase **`src/integrations/supabase/client.ts`**, hook **`src/hooks/useAuth.tsx`**.
- Rutas protegidas **`ProtectedRoute`**, paywall **`SubscriptionGuard`**, trial/premium en **`src/hooks/useSubscriptionStatus.tsx`** (admins simulan premium).
- Panel admin **`AdminRoute`**: doble condición email allowlist + **`is_admin`** (`App.tsx`).

### 8.2 Edge Function borrado usuario

**`supabase/functions/admin-delete-user/index.ts`**: borrado **best-effort** secuencial sobre tablas con columna **`user_id`** (orden fijo en código: `exercise_sets` → `exercises` → `workout_logs` → `nutrition_logs` → `exercises_library` → `personal_records` → `weight_logs` → `body_measurements` → `step_logs` → `hydration_logs` → `recovery_logs` → `food_entries` → `custom_foods` → `template_exercises` → **`workout_templates`** → `activities` → `progress_photos` → **`profiles`**) y luego **`auth.admin.deleteUser`**. **`gym_routines`** no aparece en ese array (vínculo principal al coach vía **`profiles.id`** / políticas RLS); revisar impacto si el coach se da de baja desde producto.

### 8.3 Temas y BottomNav (ocultación rutas)

- **`src/hooks/useTheme.tsx`**: `light` \| `dark` \| `system` · `localStorage` `pana_theme`.
- **`BottomNav`**: oculta en `/actividad/*`, `/cardio/<id>`, `/admin`, **`/coach`**, y el layout raíz evita nav en paywall/verificado/términos (ver `App.tsx`).

---

## 9. Panel Admin (`/admin`)

**`src/pages/AdminPanel.tsx`**: sin cambio funcional de la versión previa inventariada aquí salvo evoluciones puntuales de UI — siguen vigentes **RPC directory**, **heartbeat** `profiles.last_active_at`, **themes** **`set_user_theme`**, **`set_user_subscription_role`**, invocaciones Edge **`admin-delete-user`** (detalle tabular similar al documento anterior; actualizar sólo cuando exista diff real en ese archivo).

---

## 10. Inventario de **UI**, **UX** y **Animaciones**

Este apartado existe para mantener coherentes futuros rediseños: la app usa **principalmente Tailwind + Radix primitives envueltos en shadcn**, sin motor de navegación animado tipo Framer a nivel rutas.

### 10.1 Estándar tecnológico

| Pieza | Origen código |
|-------|---------------|
| Primitivas accesibles (focus trap, escape, portals) | **Radix** (`@radix-ui/react-dialog`, etc.) como en **`src/components/ui/dialog.tsx`** y **`src/components/ui/sheet.tsx`** (el Sheet está implementado sobre **Radix Dialog** también). |
| Estilización | **Tailwind** + **`tailwind-merge`/`cn`** en casi todas las vistas. |
| Variantes declarativas (botón, navegación) | **class-variance-authority (`cva`)** en algunos primitives (`sheet.tsx`). |
| Plugins animación entrada/salida | Utilidades **`data-[state=open]:animate-in`**, **`slide-in-from-*`**, **`fade-in`** provistas habitualmente por el preset **tailwindcss-animate** (dependencia estándar del stack shadcn). |

### 10.2 Hojas modales y diálogos

| Patrón | Archivo | Comportamiento observado |
|--------|---------|--------------------------|
| **Dialog centrado** | `ui/dialog.tsx` | Overlay `bg-black/80` con **fade**; contenido **zoom + slide** leve (`zoom-in-95`, `slide-in-from-left-1/2`, `slide-in-from-top-[48%]`, `duration-200`). |
| **Sheet lateral / bottom** | `ui/sheet.tsx` | Variantes `side`: **right** (default), **left**, **top**, **bottom** con slides `slide-in-from-*` / `slide-out-to-*`, **duration** 300 ms cierre / 500 ms apertura; overlay idéntico al Dialog. |
| Uso en producto | Varios | Ej.: **`DailyReportSheet`**, **`GymRoutineRegisterSheet`**, **`CoachTemplatePickerSheet`**, modales configuración **`Timer.tsx`**. |

Las animaciones están **del lado del contenido montado**, no hay transiciones de página SPA entre vistas hermanas.

### 10.3 Navegación inferior (`BottomNav`)

**`src/components/BottomNav.tsx`**:

- **No** existe transición declarada sobre `Routes`/`Outlet` (`react-router-dom` muestra nueva vista instantánea).
- Micro-interacciones en cada tab: **`transition-all duration-300`**.
- Ítem activo: **`scale-110`**, fondo **`bg-primary/10`**, icono tamaño aumentado **`h-6 w-6`** vs `h-5 w-5` inactivo, **stroke más grueso** activo (**`strokeWidth`** 2.5 vs 1.8), color **`text-primary`**, halo inline **`style={{ boxShadow: '0 0 12px var(--brand-glow-sm)' }}`** sólo cuando activo.
- Pulso físico táctil: **`active:scale-90`** en el `<button>` contenedor tab.

Patrón reutilizable también en otros botones grandes: combinación **`active:scale-95`** / **`active:scale-[0.96]`**, **`transition-all duration-300`**.

### 10.4 Micro-interacciones frecuentes (Tailwind)

Clases vistas de forma repetida en la app fitness:

```text
transition-all duration-200|300
hover:brightness-[1.0x]
hover:bg-accent hover:text-accent-foreground
active:scale-90 active:scale-95 active:scale-[0.96]
active:opacity-90 / active:brightness
drop-shadow aplicado a elementos neón donde se busca halo controlado
```

Muchas tarjetas del feed entrenamiento usan también **bordes semitransparentes** y **shadow-sm** coherente con tokens `bg-card` / `border-border`.

### 10.5 Estados de carga

| Tipo | Dónde |
|------|-------|
| **Skeleton** genérico | **`src/components/ui/skeleton.tsx`** — `animate-pulse` implícito de la clase base. Usos: **`AdminPanel.tsx`**, **`CoachPanel.tsx`**, **`WeightEvolutionSheet.tsx`**, menú sidebar (`sidebar.tsx`). |
| **Spinner Lucide** | **`Loader2` + `animate-spin`** en **`Profile.tsx`**, **`AvatarCropModal.tsx`**, **`NutritionBarcodeScanner.tsx`**, etc. |
| **Pantalla vacía global** | `AppRoutes` retorna `null` mientras `useAuth().loading` o suscripción `loading` (sin skeleton explícito — negro “flash” mínimo). |
| **Cardio post-carrera** | Overlay circular border spinner (ver §7). |
| **Leaderboard gym** | Texto *“Cargando…”* simple (no skeleton) en **`GymRoutineLeaderboard.tsx`**. |

### 10.6 Toasts y feedback no animado

**`use-toast`** / componente **`Toaster`** (`src/components/ui/toaster.tsx`) para confirmaciones y errores de formularios (perfil, coach, guardados).

---

## 11. Pendientes técnicos (observados en código)

1. **Service Worker notificaciones carrera** en `Cardio.tsx`: lógica comentada con nota de re-habilitar antes de release app store.
2. **Tablas `body_measurements` / `progress_photos`**: presentes en tipos y limpieza admin; **sin** flujo usuario dedicado en `src/pages` (posible deuda).
3. **Coherencia Admin SPA vs Edge**: panel admin exige email + flag; otras APIs podrían asumir sólo `is_admin` — documentar invocaciones sensibles al extender permisos.
4. **RPC `admin_user_directory`**: resiliente a formas de columnas; si el contrato estabiliza, limpiar `console.warn` residual.
5. **Nutrición duplicando fuentes día** (`nutrition_logs` vs `food_entries`): consolidaciones en Perfil siguen coexistiendo — eventual unificación modelo producto.

---

*Actualizado desde el contenido efectivo del repositorio a **mayo de 2026**. Modificar esta sección únicamente cuando el comportamiento en código cambie de forma observable.*
