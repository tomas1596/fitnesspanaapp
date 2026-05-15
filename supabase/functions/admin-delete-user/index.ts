/**
 * Borrado manual de datos del usuario (sin depender de ON DELETE CASCADE)
 * y eliminación en auth con service role.
 *
 * Orden: hijos (sets) → exercises → workout_logs → … → profiles → auth.admin.deleteUser
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Orden explícito ante FKs típicas:
 * - exercise_sets → exercises → workout_logs
 * Luego el resto por user_id y al final `profiles` antes de Auth.
 */
const TABLES_DELETE_BY_USER_ORDER: readonly string[] = [
  'exercise_sets',
  'exercises',
  'workout_logs',
  'nutrition_logs',
  'exercises_library',
  'personal_records',
  'weight_logs',
  'body_measurements',
  'step_logs',
  'hydration_logs',
  'recovery_logs',
  'food_entries',
  'custom_foods',
  'template_exercises',
  'workout_templates',
  'activities',
  'progress_photos',
  'profiles',
];

async function deleteByUserIdOrContinue(
  admin: ReturnType<typeof createClient>,
  table: string,
  userId: string,
): Promise<void> {
  const { error } = await admin.from(table).delete().eq('user_id', userId);
  if (error) {
    console.warn(
      `[admin-delete-user] ${table}:`,
      error.code ?? 'unknown',
      error.message,
    );
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Missing authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('[admin-delete-user] Missing env (SUPABASE_URL / SERVICE_ROLE / ANON)');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  try {
    const body = await req.json().catch(() => null);
    const target_user_id =
      typeof body?.target_user_id === 'string' ? body.target_user_id.trim() : '';

    if (!target_user_id || !UUID_RE.test(target_user_id)) {
      return json({ error: 'Invalid target_user_id' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: actorProfile, error: actorErr } = await userClient
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (actorErr) {
      console.error('[admin-delete-user] actor profile:', actorErr);
      return json({ error: 'Could not verify admin' }, 403);
    }

    if (actorProfile?.is_admin !== true) {
      return json({ error: 'Forbidden — admin only' }, 403);
    }

    if (target_user_id === user.id) {
      return json({ error: 'No podés eliminar tu propia cuenta desde el panel.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: targetProfile, error: targetErr } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (targetErr) {
      console.error('[admin-delete-user] target profile:', targetErr);
      return json({ error: 'Could not load target profile' }, 500);
    }

    if (!targetProfile) {
      return json({ error: 'Usuario no encontrado en perfiles.' }, 404);
    }

    if (targetProfile.is_admin === true) {
      return json({ error: 'No se pueden eliminar cuentas administradoras.' }, 403);
    }

    const { data: targetPid } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (targetPid?.id) {
      const { error: grErr } = await admin.from('gym_routines').delete().eq('coach_id', targetPid.id);
      if (grErr) {
        console.warn('[admin-delete-user] gym_routines:', grErr.code ?? 'unknown', grErr.message);
      }
    }

    for (const table of TABLES_DELETE_BY_USER_ORDER) {
      await deleteByUserIdOrContinue(admin, table, target_user_id);
    }

    const { error: delAuthErr } = await admin.auth.admin.deleteUser(target_user_id);
    if (delAuthErr) {
      console.error('[admin-delete-user] auth.admin.deleteUser:', delAuthErr);
      return json(
        {
          error:
            delAuthErr.message ??
            'Fallo al borrar cuenta de autenticación (puede quedar perfil huérfano).',
        },
        502,
      );
    }

    return json({ ok: true });
  } catch (e) {
    console.error('[admin-delete-user]', e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
