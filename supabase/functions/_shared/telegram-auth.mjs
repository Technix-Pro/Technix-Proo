// Telegram Mini App auth foundation (pure logic, Web Crypto only: runs in Deno edge functions and Node >= 18).
// Never trust client-asserted IDs: identity comes only from initData whose HMAC-SHA256 signature matches the bot token.
const enc = new TextEncoder();

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? enc.encode(data) : data));
}
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const b64url = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Returns { ok, user, authDate, error }. maxAgeSec bounds replay of captured initData.
export async function verifyInitData(initData, botToken, opts = {}) {
  const maxAgeSec = opts.maxAgeSec ?? 3600;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!initData || typeof initData !== 'string' || !botToken) return { ok: false, error: 'missing_input' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'missing_hash' };
  params.delete('hash');
  const check = [...params.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const expected = toHex(await hmac(secret, check));
  if (!safeEqual(expected, hash.toLowerCase())) return { ok: false, error: 'bad_signature' };
  const authDate = Number(params.get('auth_date'));
  if (!authDate) return { ok: false, error: 'missing_auth_date' };
  if (now - authDate > maxAgeSec || authDate - now > 300) return { ok: false, error: 'expired' };
  let user;
  try { user = JSON.parse(params.get('user') || ''); } catch (e) { return { ok: false, error: 'bad_user' }; }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return { ok: false, error: 'bad_user' };
  return { ok: true, authDate, user };
}

// HS256 JWT usable by Supabase RLS (role "authenticated"; telegram_id/tp_role claims are read by tp_uid()/is_admin()).
export async function signJwt(payload, secret) {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(enc.encode(secret), head + '.' + body));
  return head + '.' + body + '.' + sig;
}

export async function buildIdentity(user, role, jwtSecret, opts = {}) {
  const ttl = opts.ttlSec ?? 3600;
  const iat = opts.now ?? Math.floor(Date.now() / 1000);
  const exp = iat + ttl;
  const token = await signJwt({
    aud: 'authenticated', role: 'authenticated', sub: 'tg:' + user.id,
    telegram_id: user.id, tp_role: role || 'user', iat, exp
  }, jwtSecret);
  return {
    token, expires_at: exp, role: role || 'user',
    user: { id: user.id, username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null, photo_url: user.photo_url || null, language_code: user.language_code || null }
  };
}
