## `admin-delete-user`

Elimina todos los registros públicos conocidos (`user_id`) en orden seguro ante FK (p. ej. `exercise_sets` → `exercises` → `workout_logs`), luego **`profiles`** y **`auth.admin.deleteUser`**.

Si alguna tabla no existe en el proyecto o falla por RLS/schema, la función registra el aviso **y sigue con el resto**.

```bash
supabase functions deploy admin-delete-user
```

Variables disponibles automáticamente en el Edge Runtime: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.