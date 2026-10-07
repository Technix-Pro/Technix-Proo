// Edge Function: POST { initData } -> { token, expires_at, role, user }. See DEPLOYMENT.md.
// Secrets: TELEGRAM_BOT_TOKEN, APP_JWT_SECRET (= project JWT secret). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected.
import { buildIdentity, verifyInitData } from '../_shared/telegram-auth.mjs';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const jwtSecret = Deno.env.get('APP_JWT_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!botToken || !jwtSecret || !url || !svc) return json({ error: 'server_not_configured' }, 500);

  let initData = '';
  try { initData = String((await req.json()).initData || ''); } catch (_) { /* handled below */ }
  const v = await verifyInitData(initData, botToken);
  if (!v.ok) return json({ error: v.error }, 401);

  const headers = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
  const u = v.user;
  // Upsert only identity columns; xp/stars/balance are never touched here.
  const up = await fetch(url + '/rest/v1/users?on_conflict=telegram_id', {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ telegram_id: u.id, username: u.username || null, first_name: u.first_name || null, last_name: u.last_name || null, language_code: u.language_code || null, last_seen_at: new Date().toISOString() }])
  });
  if (!up.ok) return json({ error: 'user_upsert_failed' }, 502);

  const ar = await fetch(url + '/rest/v1/admins?select=role&telegram_id=eq.' + u.id, { headers });
  const rows = ar.ok ? await ar.json() : [];
  const role = rows[0]?.role || 'user';
  return json(await buildIdentity(u, role, jwtSecret));
});
