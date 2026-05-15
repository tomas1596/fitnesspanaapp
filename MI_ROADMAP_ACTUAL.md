# MI_ROADMAP_ACTUAL — Inventario técnico (estado del repo)

Documento de **control personal**: describe lo que el código ya implementa hoy (no es una lista de deseos). Rutas y archivos clave se citan para orientar futuras extensiones.

---

## 1. Módulos de Entrenamiento (lo que ya funciona)

### 1.1 Pestañas de modalidad (`Musculación` · `CrossFit` · `Funcional`)

- **Persistencia**: la modalidad activa se guarda en `localStorage` (`fitnesspana.workout.activeModalidad`) y se restaura al abrir la pantalla (`src/pages/Workout.tsx`, `src/lib/workoutModality.ts`).
- **UI**: tres botones en `src/components/WorkoutModalityTabs.tsx` con IDs `musculacion` | `crossfit` | `funcional`.
- **Comportamiento general**:
  - **Musculación**: flujo “clásico” por día — calendario, **un `workout_log` por fecha**, ejercicios en `exercises` + series en `exercise_sets`, tarjetas `ExerciseCard`, formulario inline para añadir ejercicio (grupo muscular, nombre).
  - **CrossFit**: panel único `CrossfitWodLogPanel` + bloques de movimientos adicionales debajo; persistencia en `workout_logs` con `details`/bloques derivados del borrador.
  - **Funcional**: panel `FunctionalSessionLogPanel` con fases editables; mismo esquema de guardado condicionado vía `workout_logs`.

### 1.2 CrossFit — “tipos de timer / formato de WOD”

Definido en `src/lib/crossfitWodDraft.ts` y seleccionable en `src/components/CrossfitWodLogPanel.tsx`.

Subtipos de WOD (`CrossfitWodSubtype`):

| Subtipo | Rol |
|--------|-----|
| `amrap` | AMRAP por bloque con duración; puede existir tiempo global AMRAP y vueltas completadas. |
| `emom` | Cada minuto en el minuto — tiempo EMOM total. |
| `for_time` | A tiempo — `time_cap`, tiempo final, vueltas a completar. |
| `classic_benchmark_tabata` | Clásico / benchmark / Tabata — tiempos objetivo vs tiempo real. |

Aparte: sección de **calentamiento / skill** (`warmup_skill`) fuera del subtipo principal del WOD. Los metadatos se proyectan a `block_sections` y el tiempo total del log se consolida en `deriveCrossfitTotalTimeColumn` (columna `total_time` del `workout_log` cuando aplica).

### 1.3 Funcional — estructura por fases

Modelo en `src/lib/functionalSessionDraft.ts` y UI en `src/components/FunctionalSessionLogPanel.tsx`.

- **Sesión**: nombre, tiempo total opcional, lista ordenada de **fases**.
- **Tipo de fase** (`FunctionalPhaseType`): `warmup` · `main` · `core` · `cooldown`.
- **Método de ejecución** (`FunctionalExecutionMethod`):
  - `free` — nota / libre.
  - `rounds_circuit` — cantidad de rondas.
  - `time_intervals` — trabajo / descanso / rondas.
  - `tabata` — nota Tabata (ej. intervalos 20″/10″).

Las fases se serializan a `block_sections` con subtítulos legibles (`deriveFunctionalBlockSections`, p. ej. detalle Tabata para coach).

### 1.4 Biblioteca de ejercicios — guardado automático (upsert selectivo)

Archivo central: `src/lib/exerciseLibrarySync.ts`.

- **`insertMissingExerciseLibraryEntries`**: lee nombres ya existentes en `exercises_library` para el usuario e **inserta solo los que faltan** (comparación case-insensitive). Asigna categoría y etiquetas de modalidad vía `modalityTagsForLibraryCategory` / `exerciseLibraryNaming.ts`.
- **Cuándo corre** (no es un demonio en background):
  - Tras **guardar** un bloque CrossFit o Funcional desde `Workout.tsx` (`saveConditioningWithAutoLibrary`): primero persiste el entrenamiento, luego recolecta nombres “manuales” del borrador y llama al insert faltante con grupo `'Otros'` y categoría según modalidad.
  - Tras **confirmar** un ejercicio nuevo en musculación: insert en biblioteca con el **grupo muscular** elegido.

### 1.5 Autocompletado que lee la base (`ExerciseNameSuggestInput`)

`src/components/ExerciseNameSuggestInput.tsx`:

- Debounce **~180 ms**.
- Requiere usuario logueado y texto no vacío.
- **Dos consultas** en paralelo a `exercises_library`: primero la categoría alineada con la modalidad actual (`modalityToLibraryCategory`), luego el resto; `ilike` sobre `name`, `limit` 8+8, fusión priorizando categoría (**solo lectura**, no escribe al elegir una sugerencia).

### 1.6 Timer independiente (no confundir con CrossFit)

La ruta **`/timer`** (`src/pages/Timer.tsx`) es un **interval timer** tipo Tabata/rounds (fases prep / trabajo / descanso) con **presets en `localStorage`**, audio (`public/sounds/Boxeo.mp3`) y beeps — **no** persiste el WOD en `workout_logs` desde este archivo.

---

## 2. Módulo Cardio & Salud

### 2.1 Cardio — registro en carrera

`src/pages/Cardio.tsx`:

- Geolocalización en vivo, fases `idle` | `active` | `paused`, cuenta atrás, distancia, ritmo, posible **FC vía Bluetooth** (Web Bluetooth, Chrome/Edge).
- Al finalizar: insert en **`activities`** con ruta GPS (`route_data`), parciales (`splits`), calorías/steps estimados, desnivel si hay altitud en puntos, `avg_heart_rate` opcional.
- Historial: lista con mini-mapa; enlace al detalle **`/cardio/:activityId`** (legacy: **`/actividad/:id`**).

### 2.2 Detalle de actividad cardio

`src/pages/ActivityDetail.tsx`:

- Carga **`activities`** por id; verifica `user_id`.
- **Mapa** con polilínea, heat de ritmo, hitos por km; **gráfico de rendimiento** (ritmo + elevación si hay datos); **parciales por km**; calorías/steps (DB o estimados); **compartir** (`ShareSticker`); edición de **título**; **borrado** y vuelta a `/cardio`.
- Estados: carga (spinner), error de red/Supabase, “actividad no encontrada”.

### 2.3 Nutrición

`src/pages/Nutrition.tsx` + utilidades `src/lib/nutritionDay.ts`, `src/lib/calories.ts`, `src/lib/openFoodFacts.ts`:

- Objetivos a partir de **perfil** (peso, altura, edad, sexo): BMR/TDEE aproximado, proteína, macros, meta de vasos de agua.
- Pestañas típicas: **diario del día** (anillas / totales) y **alimentos personalizados** (`custom_foods`).
- **`nutrition_logs`**: consumos del día local (rango `consumed_at`).
- **`hydration_logs`**: fila por **día calendario** (`log_date`) — actualizar vasos o insertar.
- **`recovery_logs`**: calidad de sueño / energía del día.
- **API externa**: búsqueda nutricional vía **Open Food Facts** y flujo de **código de barras** (`src/components/NutritionBarcodeScanner.tsx`).

### 2.4 Registros diarios (agua, pasos, peso, “fotos”)

| Dato | Dónde en la app | Persistencia |
|------|-----------------|--------------|
| **Agua (vasos)** | Nutrición + Perfil (resumen del día) + `DailyReportSheet` | `hydration_logs` |
| **Pasos** | Perfil (meta `profiles.step_goal`, log del día) | `step_logs` + `profiles.step_goal` |
| **Peso / objetivo** | Perfil, formulario “Datos & objetivos” | Campos en **`profiles`** (`weight`, `target_weight`) — **no** hay historial diario de peso dedicado en UI |
| **Avatar / foto de perfil** | Perfil — recorte con `AvatarCropModal`, subida a storage | Bucket **`avatars`**, URL en **`profiles.avatar_url`** |

`src/components/DailyReportSheet.tsx` consolida por fecha: `profiles`, `food_entries`, `nutrition_logs`, `hydration_logs`, `recovery_logs`, `step_logs`.

**Nota de esquema**: en `src/integrations/supabase/types.ts` existen tablas como **`body_measurements`** y **`progress_photos`**, pero **no** hay pantallas en `src/` que las usen (el borrado admin sí las limpia — ver §3.2).

---

## 3. Infraestructura y Seguridad

### 3.1 Auth (Supabase) y niveles de acceso

- **Cliente**: `src/integrations/supabase/client.ts` + **`src/hooks/useAuth.tsx`**.
- **Sesión**: `onAuthStateChange` + `getSession()` inicial; estado `user` / `loading`.
- **Alta**: `signUp` con metadatos básicos y `emailRedirectTo` hacia **`/verificado`**; comentarios indican que el **perfil** lo crea trigger en BD (`handle_new_user`), no un insert directo desde el cliente.
- **Admin a nivel app** (`isAdmin`): lectura de **`profiles.is_admin`** por usuario (`refreshIsAdmin`).

**Ruta `/admin`** (`src/App.tsx` — `AdminRoute`):

- Exige usuario autenticado, **`is_admin === true`** en perfil **y** email fijo **`ADMIN_EMAIL`** (allowlist en código). Es decir: **doble condición** para abrir el panel en el SPA.

**Funciones sensibles** (p. ej. borrado de cuenta vía Edge Function): validan **`profiles.is_admin`** del actor con el JWT, **sin** el filtro de email del front.

### 3.2 Edge Function `admin-delete-user` — limpieza manual ordenada

Archivo: **`supabase/functions/admin-delete-user/index.ts`**.

- Valida método POST, JWT en `Authorization`, UUID de `target_user_id`.
- Con cliente **anon** + JWT del llamador: comprueba que el actor tenga **`is_admin`**.
- Impide borrar **uno mismo** o un usuario con **`is_admin`** en destino.
- Con **service role**: elimina filas **tabla por tabla** en orden fijo (FKs), luego **`auth.admin.deleteUser`**.

Orden aproximado de tablas:  
`exercise_sets` → `exercises` → `workout_logs` → `nutrition_logs` → `exercises_library` → `personal_records` → `body_measurements` → `step_logs` → `hydration_logs` → `recovery_logs` → `food_entries` → `custom_foods` → `template_exercises` → `workout_templates` → `activities` → `progress_photos` → **`profiles`**.

Errores por tabla se loguean con `console.warn` y la función **continúa** (borrado “best effort” por tabla).

### 3.3 Temas: Día / Noche / VIP Rosa

Son **dos capas** que conviven:

1. **Modo claro/oscuro (UI global)** — `src/hooks/useTheme.tsx` + `ThemeProvider` en `App.tsx`:
   - Valores: `light` | `dark` | `system` (persistido en `localStorage` `pana_theme`).
   - Aplica clase `dark` en `document.documentElement` y `colorScheme`.

2. **Marca neón / VIP Rosa** — `src/lib/brandTheme.ts` + **`BrandThemeApplier`** en `App.tsx`:
   - Lee **`profiles.theme`** (`default` vs `pink`) y setea `data-brand` + variables CSS (`--brand-color`, etc.).
   - El admin puede forzar tema en otros usuarios vía RPC `set_user_theme` (ver §4).

La app combina **dark/light** con **default/pink** (muchos componentes usan selectores del estilo `[html[data-brand='pink']_&]`).

### 3.4 Suscripción y paywall

- **`SubscriptionGuard`** en `src/App.tsx`: mientras `useSubscriptionStatus` está en `loading`, no renderiza hijos; si `expired`, redirige a **`/paywall`**.
- **`useSubscriptionStatus.tsx`**: los **admins** saltan el paywall (estado premium simulado); resto: trial (~7 días desde registro), premium con expiración, testers, o expirado.

---

## 4. Panel de Administración (`/admin`)

Archivo principal: **`src/pages/AdminPanel.tsx`** (acceso vía `AdminRoute`).

Herramientas actuales:

| Función | Descripción técnica |
|--------|----------------------|
| **Directorio de usuarios** | RPC **`admin_user_directory`**; si faltan campos de suscripción, hay **fallback** con lectura directa a `profiles` (código advierte con `console.warn` si el RPC no devuelve todo). |
| **Estadísticas (cards)** | **Totales** (filas), **Hoy** (registros cuyo día local de alta = hoy), **Activos** (admins siempre; testers; premium con `subscription_expires_at` o legacy `premium_until` vigente). |
| **Búsqueda** | Filtro local por **nombre** o **email**. |
| **Orden por actividad** | Ciclo: default → última actividad reciente → más tiempo sin entrar (`last_active_at`, con utilidades `src/lib/lastActivityLabel.ts`). |
| **“En línea”** | Punto/etiqueta según `last_active_at` dentro de **`ADMIN_ONLINE_WINDOW_MS` (3 minutos)**. |
| **Roles de suscripción** | Dropdown **Free / Premium / Tester** → RPC **`set_user_subscription_role`**. |
| **Tema VIP** | Botón que alterna **`pink` / `default`** en otro usuario → RPC **`set_user_theme`**; si el objetivo sos vos, llama **`applyBrandTheme`** al momento. |
| **Borrado de cuenta** | Confirmación → **`supabase.functions.invoke('admin-delete-user')`**; no disponible para **tu** usuario ni para filas **admin**. |
| **Heartbeat** | Los usuarios actualizan **`profiles.last_active_at`** periódicamente vía `ProfileLastActivePing` (aprox. cada 2 min con sesión). |

---

## 5. Detalles de pulido (UI/UX)

- **BottomNav** (`src/components/BottomNav.tsx`): fija abajo en la mayoría de rutas; **oculta** en **`/actividad/*`**, **`/cardio/*`** (detalle bajo `/cardio/<id>`), y **`/admin`**. También la barra principal del `App` no muestra nav en **`/paywall`**, **`/verificado`**, **`/terminos`**.
- **Carga global**: mientras `useAuth().loading`, **`AppRoutes` devuelve `null`** (pantalla vacía hasta hidratar sesión).
- **Carga suscripción**: `SubscriptionGuard` con `status === 'loading'` → `null`.
- **Rutas protegidas**: `ProtectedRoute` con `loading` → `null`.
- **Cardio guardando carrera**: overlay fullscreen “Guardando tu actividad…”.
- **Perfil / Nutrición**: combinación de skeletons, toasts (`use-toast`) y hojas modales (`DailyReportSheet`, PRs, plantillas).
- **Accesibilidad menor**: aria-labels en nav admin, botones de tema, etc.

---

## 6. Pendientes técnicos (detectados en código)

1. **Notificaciones persistentes de carrera (Service Worker)** en `Cardio.tsx`: imports y efectos **comentados** con nota *“re-enable before App Store launch”* — hoy no hay tick/stop al SW.
2. **Tablas `body_measurements` / `progress_photos`**: existen en tipos y en la Edge Function de borrado, **sin** flujo de usuario en `src/` (posible deuda de producto o migración futura).
3. **Coherencia Admin SPA vs API**: el panel solo abre con **email permitido + `is_admin`**, pero otras rutas podrían usar solo `is_admin`; la Edge Function usa solo **DB**. Documentar quién puede invocar qué.
4. **`admin_user_directory`**: el cliente asume distintas formas de columnas (`user_id` vs `id`) y puede **loguear advertencias** en consola — conviene alinear el contrato del RPC en Supabase y limpiar logs de depuración (`console.log` con emoji en cargas).
5. **Duplicación de caminos de nutrición**: `nutrition_logs` vs **`food_entries`** en Perfil/DailyReport — Perfil agrega ambos para “hoy”; Nutrición se centra en `nutrition_logs` + custom foods. Revisión futura de unificación.
6. **Peso corporal**: un solo valor en `profiles`, no serie temporal en UI (aunque la BD podría soportar más modelo).

---

*Generado a partir del código en el workspace; actualizá este archivo cuando cambie el comportamiento real de la app.*
