/** Valores almacenados en `profiles.activity_level` / `profiles.fitness_goal`. */
export const ACTIVITY_LEVEL_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario' },
  { value: 'ligero', label: 'Ligero' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'intenso', label: 'Intenso' },
] as const;

export const FITNESS_GOAL_OPTIONS = [
  { value: 'bajar_grasa', label: 'Bajar grasa' },
  { value: 'mantener', label: 'Mantener' },
  { value: 'ganar_musculo', label: 'Ganar músculo' },
] as const;
