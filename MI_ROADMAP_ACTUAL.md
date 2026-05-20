# MI_ROADMAP_ACTUAL — Inventario técnico (estado del repo)

Documento de **control personal**: radiografía del código **implementado hoy**, no backlog de producto. Las rutas bajo `src/` y migraciones Supabase se citan para orientar soporte y evolución.

*Actualizado desde el contenido efectivo del repositorio a **mayo de 2026**. Modificar esta sección únicamente cuando el comportamiento en código cambie de forma observable.*

---

## 0. Arquitectura PWA y UX móvil global

### 0.1 Superficie PWA

| Recurso | Ubicación | Detalle |
|---------|-----------|---------|
| Manifest | `public/site.webmanifest` | `display: standalone`, `start_url: /`, `theme_color` / `background_color: #141417` |
| Meta PWA | `index.html` | `<link rel="manifest">`, `theme-color`, favicons multi-resolución, `apple-touch-icon` |
| Service Worker | `src/main.tsx` (registro) | Mensajes SW → `CardioOpenListener` en **`src/App.tsx`** (`OPEN_CARDIO` navega a `/cardio`) |

### 0.2 Comportamiento nativo en CSS global

**Archivo:** `src/index.css`

| Optimización | Implementación actual | Notas |
|--------------|----------------------|-------|
| Eliminar rebote / rubber-band del scroll | `body { overscroll-behavior: none; }` (línea ~121) | Shorthand que bloquea overscroll en ambos ejes; equivalente funcional al objetivo de `overscroll-behavior-y: contain` |
| Highlight táctil iOS/Android | `-webkit-tap-highlight-color: transparent` en `body` | Evita flash azul/gris al tocar |
| Área táctil mínima | Utilidad `.touch-target` → `min-h-[48px] min-w-[48px]` | Definida en `@layer utilities`; uso puntual |
| Safe area inferior | `.safe-bottom` → `padding-bottom: calc(env(safe-area-inset-bottom) + 80px)` | Reserva espacio bajo contenido scrollable |
| Scroll contenido interno | `overscroll-contain` en listas/modales puntuales | Ej.: **`GymRoutineLeaderboard.tsx`**, **`FAQBottomSheet.tsx`** |

**Estado del repo (mayo 2026):** no hay reglas globales con `touch-action: manipulation` ni clase Tailwind `touch-manipulation`. Tampoco existe hook `visualViewport` / listener de teclado virtual en el código fuente.

### 0.3 BottomNav — visibilidad (no ligada al teclado)

**Archivo:** `src/components/BottomNav.tsx`

La barra **no** se oculta por apertura del teclado virtual. La lógica es **por ruta y sesión**:

| Condición | Efecto |
|-----------|--------|
| Path `/actividad/*` | `return null` |
| Path `/cardio/<id>` (detalle) | `return null` |
| Path `/admin` | `return null` |
| Path `/coach` | `return null` |
| Sin usuario autenticado | No se monta (ver `App.tsx`) |
| Paths `/paywall`, `/verificado`, `/terminos` | No se monta (ver `App.tsx`) |

**Estilos:** barra fija `fixed bottom-0 z-50`; light → `border-zinc-200 bg-white`; dark → `bg-zinc-950/85 backdrop-blur-xl`; **`paddingBottom: env(safe-area-inset-bottom)`** inline.

**Archivo:** `src/App.tsx` (línea ~198):

```tsx
{user && !['/paywall', '/verificado', '/terminos'].includes(location.pathname) && <BottomNav />}
```

### 0.4 Navegación SPA — sin transiciones de ruta

| Aspecto | Estado |
|---------|--------|
| Transiciones entre rutas (`react-router-dom`) | **Instantáneas** — no hay `AnimatePresence` ni `<Routes>` envueltos en motion |
| Dependencia `framer-motion` | Usada **únicamente** en **`src/pages/Auth.tsx`** (entrada cascada del formulario) |
| Motivo técnico documentado en producto | Evitar rebote vertical / desplazamiento no deseado al cambiar de pestaña principal |

Las páginas protegidas (`Workout`, `Nutrition`, `Timer`, etc.) se montan/desmontan sin animación de layout entre siblings del router.

### 0.5 Sistema de capas Light / Dark (base visual)

**`src/index.css`** — tokens `:root` / `.dark`:

- Modo día: fondo `zinc-100`, tarjetas blancas, bordes `zinc-200`, `--primary` verde neón `#39FF14`.
- Modo noche: `--background` oscuro, `--card` elevado, mismo acento primario.
- **`ThemeProvider`**: `src/hooks/useTheme.tsx` · persistencia `localStorage` clave **`pana_theme`** · valores `light` \| `dark` \| `system`.

---

## 1. Enrutamiento y Auth

### 1.1 Raíz `/` — Auth inline sin redirect visual a `/auth`

**Archivo:** `src/App.tsx`

```tsx
const RootHomeGate = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Auth />;
  return (
    <AppRoute>
      <Workout />
    </AppRoute>
  );
};
```

| Ruta legacy | Comportamiento |
|-------------|----------------|
| `/auth` | `<Navigate to="/" replace />` |
| `/onboarding` | `<Navigate to="/" replace />` |

**Efecto UX:** usuario no logueado ve **`Auth`** en `/` sin cambio de URL ni flash de redirección a `/auth`. Usuario logueado entra directo a **Entreno** (`Workout`) bajo **`AppRoute`** (auth + suscripción).

### 1.2 Guardas de ruta

| Componente | Archivo | Lógica |
|------------|---------|--------|
| `ProtectedRoute` | `App.tsx` | Sin sesión → `<Navigate to="/" replace />` |
| `AppRoute` | `App.tsx` | `ProtectedRoute` + **`SubscriptionGuard`** |
| `SubscriptionGuard` | `App.tsx` | `useSubscriptionStatus()` · `expired` → `/paywall` |
| `AdminRoute` | `App.tsx` | Email allowlist + `is_admin` |
| `CoachRoute` | `App.tsx` | Consulta `profiles.is_coach` · no coach → `/profile` |

### 1.3 Pantalla Auth — micro-interacciones y estados de carga

**Archivo:** `src/pages/Auth.tsx`

**Animación cascada (Framer Motion):**

| Variante | Parámetros | Alcance |
|----------|------------|---------|
| `cascadeContainer` | `staggerChildren: 0.065`, `delayChildren: 0.02` | Logo + card exterior |
| `cascadeItem` | `opacity 0→1`, `y: 15→0`, `duration: 0.25`, `easeOut` | Cada bloque hijo |
| `formCascadeContainer` | `staggerChildren: 0.045`, `delayChildren: 0.08` | Campos del `<form>` |
| `useReducedMotion()` | Desactiva stagger / movimiento | Accesibilidad |

**Botón submit (Login / Registro):**

- Estado **`isLoading`** → `disabled={isLoading || !registerSubmitEnabled}` + `aria-busy={isLoading}`.
- Durante carga: **`Loader2 animate-spin`** (sin texto visible; `sr-only` con “Iniciando sesión…” / “Creando cuenta…”).
- Previene doble envío mientras `signIn` / `signUp` está en vuelo.

**Otros detalles Auth:**

- Estilos adaptativos light/dark vía **`useAuthStyles(isDark)`**.
- **`ThemeSegmentedControl`** flotante arriba a la derecha.
- Validaciones: email estricto, DOB 10–100 años, **`passwordMeetsPolicy`**, confirmación registro.
- Loading inicial auth: logo con **`animate-pulse`** centrado en pantalla completa.

### 1.4 Cliente Supabase y sesión

- Cliente: **`src/integrations/supabase/client.ts`**
- Hook: **`src/hooks/useAuth.tsx`**
- Trial/premium simulado para admins: **`src/hooks/useSubscriptionStatus.tsx`**

---

## 2. Entrenamiento: `Workout.tsx` y convivencia **Modo Personal** / **Modo Gimnasio**

### 2.1 Persistencia base y filtro por fecha (`workout_date`)

- Todas las consultas principalistas usan fecha calendario **local** `YYYY-MM-DD` construido con año/mes/día del dispositivo (no `toISOString()` UTC) para evitar desfasajes: ver **`formatLocalDateISO`** en **`src/pages/Workout.tsx`**.
- Ejercicios de musculación: tabla **`exercises`** filtrada por **`workout_date === dateStr`** y `user_id`.
- Bloques Conditioning (CrossFit / Funcional): contenido proyectado desde **`workout_logs`** para el mismo día, según alcance Personal vs Gimnasio.
- Persistencia tipo upsert desde utilidades **`src/lib/persistWorkoutLogs.ts`** y flujos de guardado locales en `Workout.tsx`, siempre declarando **`onConflict: 'user_id,workout_date,modality,gym_routine_id'`** donde aplica una sola fila canónica.

### 2.2 Unicidad flexible: más de un resultado por día (gimnasio)

Migración **`supabase/migrations/20260517180000_workout_logs_unique_include_gym_routine.sql`**:

| Antes | Ahora |
|--------|--------|
| Unicidad sólo sobre `(user_id, workout_date, modality)` | `UNIQUE NULLS NOT DISTINCT (user_id, workout_date, modality, gym_routine_id)` |

Interpretación práctica según código:

- **`gym_routine_id IS NULL`**: máximo **un** log “personal” por usuario, día calendario y modalidad (`musculacion` \| `crossfit` \| `funcional`).
- **`gym_routine_id` definido**: el mismo día puede tener **uno por rutina**, es decir un alumno registra resultado **aislado** por la combinación día + modalidad + id de rutina.

Índices auxiliares y FK: ver **`supabase/migrations/20260528120000_gym_mode_polish.sql`** (columna **`gym_routine_id`** + índice parcial sobre rutina/fecha).

### 2.3 Detección de contexto Coach / Alumno y visibilidad del switch

Implementado en el `useEffect` inicial de **`src/pages/Workout.tsx`** leyendo **`profiles`**:

| Campo / condición | Efecto |
|-------------------|--------|
| **`is_coach === true`** y `profiles.id` | El mismo usuario usa sus **`gym_modalities`** definidos en perfil como coach (`gymSourceCoachProfileId = myProfileId`). |
| **`coach_id`** (alumno vinculado) | Obtiene etiquetas desde RPC **`get_linked_coach_gym`** y fuerza modalities permitidas mediante **`modalityIdsAllowedByGymLabels`**. |

**Renderizado condicional del switch Personal/Gimnasio:**

```tsx
const isLinkedToGymOrCoach = Boolean(studentCoachProfileId) || isCoachUser;
const showGymSwitch = coachCtxReady && !!user && isLinkedToGymOrCoach;
const isGymView = showGymSwitch && workoutScope === 'gimnasio';
```

| Condición | Comportamiento |
|-----------|----------------|
| Usuario **sin** `coach_id` y **no** `is_coach` | **`showGymSwitch === false`** — el segmented control **no se renderiza** |
| Mismo caso | `useEffect` fuerza **`workoutScope = 'personal'`** si el scope persistido era `gimnasio` |
| Alumno o coach vinculado | Muestra switch; persiste alcance en `localStorage` clave **`fitnesspana.workout.scope`** |

Sólo si `coachCtxReady` y existe alumno-coach **o** el usuario es coach: **`showGymSwitch`** enseña pestañas **Personal** / **Gimnasio**.

### 2.4 Segmented control Personal / Gimnasio (Light + Dark)

**Clase contenedora:** `workout-gym-scope-tablist`

| Token / clase | Light | Dark |
|---------------|-------|------|
| Track | `border-zinc-200 bg-zinc-100 shadow-inner` | `dark:border-zinc-800 dark:bg-zinc-900` |
| Tab activo | `bg-primary text-zinc-950 shadow-md` | Misma clase (contraste sobre verde neón) |
| Tab inactivo | `text-zinc-600 hover:text-zinc-800` | `dark:text-zinc-400 dark:hover:text-zinc-200` |
| Forma | `rounded-full p-1` · cada botón `w-1/2 rounded-full py-2` | — |
| Transición | `transition-all duration-300` | — |

**Pink Mode:** overrides en **`src/index.css`** bajo `html[data-brand='pink'] .workout-gym-scope-tablist` (sin glow; acentos fucsia).

### 2.5 Carga de rutinas públicas (`gym_routines`)

En modo Gimnasio, `Workout.tsx` fetchea **`gym_routines`** con:

- **`coach_id = gymSourceCoachProfileId`** (`profiles.id` del coach dueño).
- **`modality`** igual a la pestaña Musculación / CrossFit / Funcional activa.
- Orden **`day_number`**.

Contrato BD: **`supabase/migrations/20260527120000_gym_routines.sql`**; pulido día 6 máx: **`supabase/migrations/20260528120000_gym_mode_polish.sql`** (rutina **por coach + modalidad + día 1–6**, columna **`workout_data` JSON**, **`coach_notes`** visible alumno).

### 2.6 Grilla semanal (UX limpia)

**Grid:** `grid-cols-2 sm:grid-cols-4` · días **1–6**.

**Clases por celda:** `workout-gym-day-cell`, modificadores `--filled`, `--viewing`.

| Estado celda | Visual |
|--------------|--------|
| Sin rutina (`!row`) | Borde dashed, opacidad reducida, icono calendario, texto **“Sin rutina”** |
| Rutina cargada, **sin log** ese día | Borde `primary/35`, **punto verde neón** (`h-2 w-2 rounded-full bg-primary` + glow `--brand-glow-sm`), título de rutina, pie **“Rutina”** |
| Rutina con log registrado | Clase `--filled`, borde/fondo **emerald**, pie con **`subtitleForGymRoutineLog(...)`** |
| Sheet viewer/registro abierto en ese día | `--viewing` (borde reforzado en Pink Mode) |

**Limpieza de copy:** se eliminó texto redundante de estado intermedio; la jerarquía queda **Día N** → **título** (`row.title` o “Ver rutina”) → **indicador mínimo** (punto / estado emerald / “Sin rutina”).

**Mapa de logs:** `gymRoutineLogById`: **`gym_routine_id` → último log** del día desde `workout_logs` filtrados por alcance Gym.

**Sheets del detalle:**

| Sheet | Componente |
|-------|------------|
| Visor rutina | **`GymRoutineBlockViewer`** + **`Sheet`** bottom |
| Ranking | **`GymRoutineLeaderboard`** (CF/Funcional) |
| Registrar resultado | **`GymRoutineRegisterSheet`** |

Al cambiar **fecha seleccionada** (`dateStr`) se cierran viewer/registro/reportes para evitar datos cruzados.

### 2.7 Pizarra Digital — visor inmersivo de rutina del coach

**Archivo:** `src/components/GymRoutineBlockViewer.tsx`

Activado **solo** en el sheet de detalle del gimnasio vía prop:

```tsx
<GymRoutineBlockViewer variant="chalkboard" ... />
```

(`Workout.tsx` ~1872; plantillas en **`TemplatesSheet`** / **`CoachTemplatePickerSheet`** mantienen **`variant` default**.)

| Elemento | Estilo chalkboard (`variant="chalkboard"`) |
|----------|---------------------------------------------|
| Contenedor | Clase **`gym-chalkboard-panel`**: `bg-zinc-950`, `p-5 sm:p-6`, `rounded-2xl`, `border-zinc-800/50`, `shadow-lg` |
| Encabezado | **PIZARRÓN DEL DÍA** — `text-primary`, `font-black`, `uppercase`, `tracking-widest`, centrado |
| Nombres ejercicios/bloques/WOD | `text-zinc-100` |
| Notas coach, descansos, detalle | `text-zinc-400` |
| Datos duros (AMRAP 15 MIN, tiempos, prescripciones musculación) | `font-mono font-black` |
| Separadores entre partes | `border-b border-dashed border-zinc-800` (sin tarjetas con borde sólido) |
| Badges AMRAP/EMOM (modo default) | Clase **`gym-routine-block-badge`** — en chalkboard se sustituyen por texto mono blanco |

**Ranking:** **`GymRoutineLeaderboard`** permanece **debajo** del pizarrón, sin cambios de layout ni lógica RPC.

### 2.8 Alcance Personal: filtro en memoria

Tras cargar **`workout_logs`** del día desde Supabase (`select *` mismo `user_id` + `workout_date`), el código **parte** entre:

```text
personal  → sólo logs con gym_routine_id == null
gimnasio  → sólo logs con gym_routine_id != null
```

Los paneles Conditioning y drafts (`crossfitDraft` / `functionalSessionDraft`) se hidratan a partir del subconjunto activo — ver bucle **`fetchExercises`** en **`Workout.tsx`**.

### 2.9 Pestañas de modalidad

- Persistencia **`fitnesspana.workout.activeModalidad`** — **`src/lib/workoutModality.ts`**, componente **`src/components/WorkoutModalityTabs.tsx`**.
- En modo Gym, si la modalidad activa ya no está en las permitidas por el gym, **`useEffect`** reasigna a la primera modality permitida.

### 2.10 CrossFit y Funcional — subtipos y persistencia

- **`src/lib/crossfitWodDraft.ts`**, **`src/components/CrossfitWodLogPanel.tsx`** (`CrossfitWodSubtype`: AMRAP, EMOM, for_time, classic_benchmark_tabata; warm-up separado).
- **`src/lib/functionalSessionDraft.ts`**, **`src/components/FunctionalSessionLogPanel.tsx`** (fases, métodos rounds_circuit · time_intervals · tabata, etc.).
- **`src/lib/exerciseLibrarySync.ts`**: escritura diferida tras guardar Conditioning o confirmar alta musculación.
- **`src/components/ExerciseNameSuggestInput.tsx`**: sugerencias en dos consultas paralelas a **`exercises_library`**.

*(La numeración técnica de subtipos y columnas consolidadas como `deriveCrossfitTotalTimeColumn` siguen válidas desde el mismo código mencionado en versiones previas de este archivo.)*

---

## 3. Panel Coach (`/coach`), rutinas BD y Biblioteca de plantillas

### 3.1 Ruta y acceso

- **`src/App.tsx`**: **`Route path="/coach"`** dentro de **`CoachRoute`**.
- **`CoachRoute`**: consulta **`profiles.is_coach`**; si es falso → redirección a **`/`** o **`/profile`**; mientras tanto `null`.
- **`src/components/BottomNav.tsx`** **no muestra** la barra en **`/coach`** (igual que admin y detalle cardio).

Archivo pantalla principal: **`src/pages/CoachPanel.tsx`**.

### 3.2 Dashboard coach (alumnos + “pizarra semanal”)

- Lista alumnos: RPC **`get_coach_students`**; columnas de actividad reutilizan utilidades **`src/lib/lastActivityLabel.ts`** (puntos estado / “● En línea” en últimos ~3 min vía **`ADMIN_ONLINE_WINDOW_MS`**).
- **Nombre de gimnasio** y modalities: campos **`gym_name`**, **`gym_modalities`** en **`profiles`**.
- Rutinas cargadas igual que lado alumno: **`gym_routines`** donde **`coach_id === profiles.id`** del coach auth.
- Alta/edición día: **`GymRoutineCoachDialog`** (**`src/components/GymRoutineCoachDialog.tsx`**): upsert a **`gym_routines`** (incl. **`coach_notes`**, **`workout_data`** JSON con payload tipado **`GymRoutineWorkoutPayload`** en **`src/lib/gymRoutineWorkoutData.ts`**).

### 3.3 Biblioteca de plantillas del coach (`workout_templates`)

Pantalla integra **`CoachTemplatePickerSheet`** (**`src/components/CoachTemplatePickerSheet.tsx`**):

| Columna / concepto | Uso |
|--------------------|-----|
| **`routine_category`** | Valores válidos **`musculacion` \| `crossfit` \| `funcional`** (constraint en migración **`20260515103000_workout_templates_conditioning.sql`**). |
| **`structured_payload`** | JSON (snapshot del WOD/session o rutina gym serializada para rehidratar el editor). |
| **`coach_notes`** | Migración **`20260531120000_workout_templates_coach_notes.sql`**; visible al elegir plantilla y al copiar a rutina. |

Inserción programática: **`src/lib/coachWorkoutTemplates.ts`** → **`insertCoachGymSnapshotTemplate`**.

*(Las plantillas de usuario “Mis rutinas” del flujo alumno siguen pasando también por **`TemplatesSheet.tsx`** usando las mismas columnas.)*

### 3.4 Desvincular alumno

- Confirmación **`AlertDialog`**; RPC **`coach_remove_student`** (`CoachPanel.tsx`).

---

## 4. Ranking (leaderboard) aislado por “gym” del coach

### 4.1 Componente frontal

**`src/components/GymRoutineLeaderboard.tsx`**:

- Visible sólo modalidad **`crossfit`** o **`funcional`** (Musculación no lista ranking desde este widget).
- RPC **`get_gym_routine_leaderboard`** pasando **`p_gym_routine_id`** y **`p_workout_date`** (misma fecha local soberbia que usa `Workout.tsx`).
- Orden/visualización tras **`sortGymLeaderboardRows`** y deduplicación “mejor fila por usuario”: **`src/lib/gymRoutineQuickResult.ts`**.
- Clases: **`workout-gym-leaderboard`**, filas **`workout-gym-lb-row`**, fila propia **`workout-gym-lb-own`**.
- Copy UX: **“Ranking del día”** — misma rutina entre quienes comparten coach.

### 4.2 Aislamiento en base de datos (`SECURITY DEFINER`)

Implementación oficial: función en **`supabase/migrations/20260528120000_gym_mode_polish.sql`**:

1. Obtiene **`v_coach = gym_routines.coach_id`** de la rutina solicitada.
2. Comprueba que **`auth.uid()`** corresponda a perfil alumno (**`profiles.coach_id = v_coach`**) **o** al propio coach (**`profiles.id = v_coach`**); si no → excepción **forbidden**.
3. **`RETURN QUERY`** filtra **`workout_logs`** con **`gym_routine_id`** y fecha exactos, modalidad Conditioning, y **`profiles`** pegado donde **`coach_id`** del participante coincide con **`v_coach`** **o** el participante es el coach.

Resultado: la competencia queda **acotada al “grupo coach”** derivado del `coach_id` de esa rutina.

---

## 5. **Timer.tsx** (`/timer`) — jerarquía Sets → Rondas → Trabajo/Descanso

**Archivo:** `src/pages/Timer.tsx` (independiente de `workout_logs`).

### 5.1 Modelo de datos preset

```tsx
type Preset = {
  id: string;
  name: string;
  prep: number;
  work: number;
  rest: number;
  rounds: number;
  sets: number;      // ≥ 1
  setRest: number;   // descanso entre sets (seg); 0 = omitir fase
};
```

**Persistencia:** `localStorage` clave **`pana_arena_presets_v1`** · helpers **`loadPresets`** / **`savePresets`** · preset por defecto **`DEFAULT_PRESET`**.

### 5.2 Máquina de estados (`Phase`)

```text
'idle' | 'prep' | 'work' | 'rest' | 'setRest' | 'done'
```

**Jerarquía temporal:**

```text
Set 1..N
  └─ Ronda 1..R  →  prep (opcional al inicio) → work ↔ rest
Entre sets (si setRest > 0 y quedan sets): fase setRest → vuelta a work del set siguiente
```

**Función clave:** **`advancePhase()`**

| Desde | Hacia | Condición |
|-------|-------|-----------|
| `prep` | `work` | Inicio primer round |
| `work` | `rest` | `round < rounds` |
| `work` | `done` | Última ronda del último set |
| `work` | `setRest` | Última ronda del set, hay más sets, `setRest > 0` |
| `work` | `work` | Última ronda del set, `setRest === 0`, siguiente set |
| `rest` | `work` | Incrementa round |
| `setRest` | `work` | TTS “Comienza”, reset round a 1 del nuevo set |

Refs sincronizados: **`roundRef`**, **`currentSetRef`** (evitan stale closures en intervalo 1 Hz).

### 5.3 UI de fases y badges

| Fase | Fondo pantalla | Titular |
|------|----------------|---------|
| Pausado (cualquier fase activa) | `#DC2626` | **EN PAUSA** |
| `prep` | `#FACC15` | PREPARATE |
| `work` | `var(--brand-color)` | ¡A ENTRENAR! |
| `rest` | `#38BDF8` | DESCANSÁ |
| `setRest` | `#DC2626` | **DESCANSO LARGO** |
| `idle` / `done` | `hsl(var(--background))` | — |

**Badges bajo el reloj:**

- **Set X / Y** — pill uppercase; visible solo si **`totalSets > 1`**.
- **Ronda n / total** — pill adyacente.
- Estado final: **COMPLETADO**.

### 5.4 Modal de configuración

Campos numéricos en editor de preset:

- **Sets** (`editing.sets`, mínimo 1).
- **Descanso entre sets (s)** (`editing.setRest`, mínimo 0).

Listado de presets muestra resumen: `· N sets` · `Entre sets Xs` cuando aplica.

### 5.5 Audio / haptics (sin cambio conceptual)

- Cuenta atrás sintética (`AudioContext`) + **`public/sounds/Boxeo.mp3`** entre fases.
- Priming táctil en primer play.
- Controles: disco blanco play/pausa, **`Reiniciar`** secundario pill.

---

## 6. Nutrición y hábitos — `Nutrition.tsx`

**Archivo principal:** `src/pages/Nutrition.tsx`

**Tablas:** `food_entries`, `nutrition_logs`, `hydration_logs`, `recovery_logs`, `step_logs`, `custom_foods`, `profiles.step_goal`.

**Utilidades:** `src/lib/nutritionDay.ts`, `src/lib/openFoodFacts.ts`.

### 6.1 Círculo central de calorías (pestaña Diario)

Rediseño con **SVG inline** (no componente externo en esta vista):

| Parámetro | Valor |
|-----------|-------|
| Radio anillo | `R = 52` |
| Trazo | `strokeWidth="10"`, track `stroke-border/50`, progreso `stroke-primary` + glow `--brand-glow-sm` |
| Centro | **`CountUpSpan`** valor entero grande (`text-5xl font-black`) |
| Subtítulo | **“kcal consumidas”** (`text-[10px] uppercase tracking-wider`) |
| Meta | Separador `h-px` + bloque **“N restantes”** / **“meta: X”** (`text-xs text-zinc-500`) |
| Animación fill | `ringFillPct` + `stroke-dashoffset` · easing `900ms cubic-bezier` · respeta **`prefersReducedMotion`** |

Barras de macros (**`MacroBar`**) al lado derecho del anillo en layout flex.

### 6.2 Modal “Nuevo alimento” — inputs numéricos sin bloqueo en 0

**Problema resuelto:** al borrar un campo, el estado puede quedar **`''`** sin forzar `0` visualmente ni bloquear la edición.

| Pieza | Detalle |
|-------|---------|
| Tipo draft | **`MacroConsumedDraft`** — campos `calories`, `protein`, `carbs`, `fat` como **`string`** |
| Vacío inicial | **`MACRO_CONSUMED_DRAFT_EMPTY`** — todos `''` |
| Sanitizado | **`sanitizeFreeDecimalTyping`** — solo dígitos y un separador decimal |
| Parse al guardar | **`parseScaledConsumptionDraft`**: `''` → **`0`** al persistir |
| Ref 100 g | **`ref100MacrosFromConsumedDraft`** — escala desde cantidad consumida |
| Inputs UI | `type="text"` (no `type="number"`) enlazados al draft |
| Handlers | **`onConsumedMacroDraftChange`**, **`finalizeConsumedMacroDraftField`** |

### 6.3 Open Food Facts — expectativas y disclaimers

| Ubicación | Copy / comportamiento |
|-----------|----------------------|
| Subtítulo modal alimento | Menciona datos **por 100 g/ml** desde OFF al escanear |
| **`handleOpenFoodFactsBarcode`** | Fetch vía **`fetchOpenFoodFactsProduct`** · toast “Macros por 100 cargados desde Open Food Facts.” |
| **`NutritionBarcodeScanner.tsx`** | Bloque **`role="note"`** amarillo: **“Nota sobre productos”** — base global, productos nacionales pueden no aparecer; crear manualmente |
| Overlay carga | **`NutritionBarcodeScanLoadingOverlay`** — **`Loader2`** + “Buscando producto…” |

### 6.4 Widget Pasos — migrado desde Perfil a Nutrición

| Aspecto | Detalle |
|---------|---------|
| Estado previo | **`Profile.tsx`** no referencia `StepsRing`, `step_logs` ni copy “Pasos” |
| Ubicación actual | Pestaña **Diario** en **`Nutrition.tsx`**, bloque horizontal compacto bajo hidratación |
| Componente anillo | **`src/components/StepsRing.tsx`** · prop **`variant="compact"`** · **`compactCenter="percent"`** · `size={76}` |
| Layout | Icono **`Footprints`** + título + **`StepsRing`** + contador grande + meta + botones **±1k** |
| Datos | Lectura/escritura tabla **`step_logs`**; meta en **`profiles.step_goal`** |
| Diálogo meta | **`saveStepGoalFromDialog`** — mínimo 1000 pasos |

### 6.5 Otros bloques Diario

- Hidratación (vasos / litros).
- **`WellbeingScale`**: sueño y energía → **`recovery_logs`**.
- **`DailyReportSheet`**: informe consolidado del día (referencia cruzada).

---

## 7. Cardio y salud (resumen operativo)

| Área | Archivos / tabla |
|------|-------------------|
| Corrida en vivo + guardado GPX | **`src/pages/Cardio.tsx`** · **`activities`** |
| Detalle trayecto | **`src/pages/ActivityDetail.tsx`** |
| Nutrición (§6) | **`src/pages/Nutrition.tsx`** |

**Cardio overlay guardado:** bloque JSX con texto *“Guardando tu actividad…”* + spinner Tailwind (`animate-spin` + bordes `border-primary`).

**Service Worker notificaciones carrera** en `Cardio.tsx`: lógica comentada — re-habilitar antes de release app store (ver §14 pendientes).

---

## 8. Compartir actividad — sticker Premium estilo widget iOS

**Archivos:** `src/components/ShareSticker.tsx` · panel en **`src/pages/ActivityDetail.tsx`** (`panel === 'share'`).

### 8.1 Diseño del asset exportado

| Elemento | Implementación |
|----------|----------------|
| Canvas export | **`html-to-image.toPng`** · `pixelRatio: 3` · ref **`stickerRef`** |
| Dimensiones preview | `450×174px`, **`rounded-3xl`**, blur + sombra |
| Temas | **`night`** (negro translúcido) / **`day`** (blanco) — toggle Sol/Luna |
| Logo marca | **`<img src="/android-chrome-192x192.png">`** · `rounded-md` · ring sutil — etiqueta **`alt="Logo Pana Fitness"`** |
| Wordmark | **PANA FITNESS** · `text-[9px] font-extrabold uppercase tracking-[0.14em]` |
| Ruta GPS | Panel lateral **`RouteTrace`** SVG 80×80 · inicio verde · fin rojo |
| Jerarquía tipográfica | Distancia **`text-6xl font-black`** centrada · Tiempo/Ritmo **`text-xl font-black tabular-nums`** · labels **`tracking-[0.22em] uppercase`** |
| Color acento distancia | Label **“Kilómetros”** en **`text-primary`** |

### 8.2 Flujo de salida

1. Usuario abre **“Compartir actividad”** desde detalle.
2. **`handleShare`**: genera PNG → **`File`** `pana-run.png`.
3. Si **`navigator.canShare({ files })`**: **`navigator.share`** (Instagram / apps nativas).
4. Fallback: descarga directa vía `<a download>`.

---

## 9. Perfil — cambio de contraseña (`src/pages/Profile.tsx`)

Modal **“Cambiar contraseña”** (componentes **`Dialog`**, **`Input`**) exige:

- Campo **nueva contraseña** (`newPassword`).
- Segundo campo **confirmar** (`confirmPassword`) sincronizado.
- Estado **`passwordsMatch = newPassword === confirmPassword`**; si falsas → **`toast`** sin llamar Supabase.
- Políticas: **`passwordMeetsPolicy`** (**`src/lib/passwordPolicy.ts`**) + **`PasswordRequirementsList`**.
- **`disabled`** en botón si `!passwordsMatch` ó `!newPasswordOk` ó `changingPassword`.
- Spinner **`Loader2 animate-spin`** durante **`supabase.auth.updateUser({ password })`**.

*(El widget de pasos ya no vive en Perfil — ver §6.4.)*

---

## 10. Identidad **Pink Mode** (`data-brand=pink`)

### 10.1 Aplicación de variables desde React

**`src/lib/brandTheme.ts`**: función **`applyBrandTheme`** al hidratar perfil (**`BrandThemeApplier`** en **`src/App.tsx`**) establece:

- `document.documentElement.dataset.brand === 'pink' | implícito default`
- clase **`pink-mode`** sólo cuando el tema VIP es rosado.
- Overrides de **`--brand-color`**, **`--primary`**, glows (`--brand-glow*`).

### 10.2 CSS puro y convivencia con Light / Dark

**`src/index.css`**:

| Mecánica | Descripción |
|----------|-------------|
| **Modo día** acentos legibles sobre blanco | Reglas `html:not(.dark):not([data-brand="pink"]) .text-primary` (verde) vs rosa `#ff007f` en pink |
| **Bloque gym rosa VIP** | Bajo **`html[data-brand='pink']`**: **`workout-gym-scope-tablist`**, **`workout-modality-tabs`**, celdas **`workout-gym-day-*`**, CTA **`workout-gym-register-cta`**, ranking **`workout-gym-lb-own`**, badges pizarra **`.gym-routine-block-badge`**, **`workout-coach-notes-panel`** |
| **Chalkboard gym** | Variante oscura **`gym-chalkboard-panel`** no depende de overrides pink en badges (usa tipografía mono zinc) |

Resultado: **Light/Dark** siguen desde **`ThemeProvider`**; Pink **solo reemplaza tintes de marca** en selectores conscientes.

---

## 11. Panel Admin (`/admin`) — suscripciones y roles

**Archivo:** `src/pages/AdminPanel.tsx`

**Acceso:** **`AdminRoute`** — email allowlist + **`profiles.is_admin`**.

### 11.1 Badges visuales de suscripción

Función **`resolveDirectorySubscriptionStatus(row)`** → **`SubscriptionFinancialRow`**.

| Kind | Badge | Clases típicas |
|------|-------|----------------|
| `admin` | **Al día** | `bg-green-500/20 text-green-500` |
| `tester` | **Tester ∞** | Verde |
| `premium` (activo) | **Premium** | Verde + fecha vencimiento |
| `trial` | **Trial (Quedan N día(s))** | **`bg-yellow-500/20 text-yellow-500`** |
| `expired` | **Vencido** | **`bg-red-500/20 text-red-500`** |

Constantes: **`TRIAL_DAYS = 7`**, **`LIFETIME_ACCESS_EXPIRES_ISO = '2049-12-31T23:59:59.999Z'`**.

### 11.2 Recálculo de fechas al cambiar rol (efectos secundarios)

**Función:** **`computeExpiryForRoleChange(newRole, row)`**

| Rol destino | Fecha calculada |
|-------------|-----------------|
| **`tester`** | **`2049-12-31T23:59:59.999Z`** (acceso “∞”) |
| **`free`** | **`registered_at + 7 días`** vía **`trialEndFromRegisteredAt`** |
| **`premium`** (asignación nueva) | **`now + 30 días`** |

**Aplicación:** RPC **`set_user_subscription_role`** con **`new_expires_at`** + sync columnas **`subscription_expires_at`** / **`premium_until`** en **`profiles`**.

**Nota:** usuarios **`is_admin`** se gestionan aparte del selector Free/Premium/Tester; badge propio **“Al día”** sin pasar por `computeExpiryForRoleChange`.

### 11.3 Botón acción rápida +30 días Premium

**Función:** **`handleExtendPremium30`**

- Suma **30 días** desde la fecha de vencimiento actual (si futura) o desde **now**.
- Helper **`computePremiumExpiryPlus30Days`**.
- UI: botón ámbar con icono tarjeta y texto **“+30”** (columna acciones del directorio).
- Omitido para filas **`is_admin`** o **`subscription_role === 'tester'`**.

### 11.4 Directorio y operaciones auxiliares

- Carga: RPC **`admin_user_directory`** (fallback query directa a **`profiles`** si faltan columnas).
- Heartbeat: **`profiles.last_active_at`**.
- Temas usuario: RPC **`set_user_theme`**.
- Borrado: Edge **`admin-delete-user`** (ver §12.2).
- Coach: RPCs **`admin_set_coach_profile`**, etc.

---

## 12. Infraestructura compartida

### 12.1 Edge Function borrado usuario

**`supabase/functions/admin-delete-user/index.ts`**: borrado **best-effort** secuencial sobre tablas con columna **`user_id`** (orden fijo: `exercise_sets` → `exercises` → `workout_logs` → `nutrition_logs` → `exercises_library` → `personal_records` → `weight_logs` → `body_measurements` → `step_logs` → `hydration_logs` → `recovery_logs` → `food_entries` → `custom_foods` → `template_exercises` → **`workout_templates`** → `activities` → `progress_photos` → **`profiles`**) y luego **`auth.admin.deleteUser`**.

**`gym_routines`** no aparece en ese array (vínculo principal al coach vía **`profiles.id`** / políticas RLS).

### 12.2 BottomNav — resumen técnico

Ver §0.3. Micro-interacciones tab: **`transition-all duration-300`**, activo **`scale-110`**, halo **`var(--brand-glow-sm)`**, **`active:scale-90`**.

---

## 13. Inventario de **UI**, **UX** y **Animaciones**

### 13.1 Estándar tecnológico

| Pieza | Origen código |
|-------|---------------|
| Primitivas accesibles | **Radix** — **`src/components/ui/dialog.tsx`**, **`sheet.tsx`** |
| Estilización | **Tailwind** + **`cn`** / **`tailwind-merge`** |
| Variantes | **class-variance-authority (`cva`)** en primitives |
| Animaciones entrada modales | **`data-[state=open]:animate-in`**, **`slide-in-from-*`**, preset **tailwindcss-animate** |

### 13.2 Hojas modales y diálogos

| Patrón | Archivo | Comportamiento |
|--------|---------|----------------|
| **Dialog centrado** | `ui/dialog.tsx` | Overlay fade + zoom/slide ~200 ms |
| **Sheet bottom** | `ui/sheet.tsx` | Usado en rutina gym, registro resultado, informes |
| **Sheet gym rutina** | `Workout.tsx` | `max-h-[88vh]`, `rounded-t-3xl`, pizarrón + ranking + CTA registrar |

### 13.3 Micro-interacciones frecuentes (Tailwind)

```text
transition-all duration-200|300
hover:brightness-[1.0x]
active:scale-90 | active:scale-95 | active:scale-[0.98]
motion-safe:active:scale-[0.98]  (celdas día gym)
drop-shadow + --brand-glow-sm     (elementos neón)
```

### 13.4 Estados de carga

| Tipo | Dónde |
|------|-------|
| **Skeleton** | **`src/components/ui/skeleton.tsx`** — Admin, Coach, sheets |
| **Spinner Lucide** | Auth, Perfil, escáner nutrición, Cardio guardado |
| **Pantalla vacía global** | `AppRoutes` / gates retornan `null` mientras `loading` |
| **Leaderboard gym** | Texto “Cargando…” simple |

### 13.5 Toasts

**`use-toast`** / **`Toaster`** — confirmaciones formularios, admin, guardados.

---

## 14. Pendientes técnicos (observados en código)

1. **Service Worker notificaciones carrera** en `Cardio.tsx`: lógica comentada — re-habilitar antes de release app store.
2. **Ocultar BottomNav con teclado virtual**: no implementado; candidato futuro vía `visualViewport` API.
3. **`touch-action: manipulation` global**: no presente; evaluar si se necesita además de `-webkit-tap-highlight-color`.
4. **Tablas `body_measurements` / `progress_photos`**: presentes en tipos y limpieza admin; **sin** flujo usuario dedicado en `src/pages`.
5. **Coherencia Admin SPA vs Edge**: panel admin exige email + flag; revisar invocaciones sensibles al extender permisos.
6. **RPC `admin_user_directory`**: resiliente a formas de columnas; `console.warn` residual si falta `subscription_role`.
7. **Nutrición duplicando fuentes día** (`nutrition_logs` vs `food_entries`): consolidaciones coexisten — eventual unificación modelo producto.

---

*Fin del inventario. Mantener sincronizado con diffs reales en `src/` y migraciones Supabase.*
