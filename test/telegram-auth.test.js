const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const TOKEN = '123456:TEST-TOKEN';
function sign(fields, token = TOKEN) {
  const check = Object.entries(fields).map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const now = 1800000000;
const fields = (o = {}) => ({ auth_date: String(now - 10), query_id: 'AAA', user: JSON.stringify({ id: 42, username: 'bob' }), ...o });

test('verifyInitData accepts a valid signature', async () => {
  const { verifyInitData } = await import('../supabase/functions/_shared/telegram-auth.mjs');
  const r = await verifyInitData(sign(fields()), TOKEN, { now });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.user.id, 42);
});

test('verifyInitData rejects tampering, wrong token, expiry and missing input', async () => {
  const { verifyInitData } = await import('../supabase/functions/_shared/telegram-auth.mjs');
  const good = sign(fields());
  const forged = good.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":1'));
  assert.strictEqual((await verifyInitData(forged, TOKEN, { now })).error, 'bad_signature');
  assert.strictEqual((await verifyInitData(good, 'other:token', { now })).error, 'bad_signature');
  assert.strictEqual((await verifyInitData(good, TOKEN, { now: now + 7200 })).error, 'expired');
  assert.strictEqual((await verifyInitData('user=%7B%22id%22%3A1%7D', TOKEN, { now })).error, 'missing_hash');
  assert.strictEqual((await verifyInitData('', TOKEN)).ok, false);
});

test('buildIdentity returns an HS256 JWT with telegram_id and role claims', async () => {
  const { buildIdentity } = await import('../supabase/functions/_shared/telegram-auth.mjs');
  const id = await buildIdentity({ id: 42, username: 'bob' }, 'admin', 'secret', { now });
  const [h, b, s] = id.token.split('.');
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  assert.strictEqual(payload.telegram_id, 42);
  assert.strictEqual(payload.tp_role, 'admin');
  assert.strictEqual(payload.role, 'authenticated');
  assert.strictEqual(payload.exp, now + 3600);
  const expect = crypto.createHmac('sha256', 'secret').update(h + '.' + b).digest('base64url');
  assert.strictEqual(s, expect);
});
