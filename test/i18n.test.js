const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../i18n.js');
const CFG = require('../app-config.js');
const Core = require('../core.js');

const { pl, en } = I18N.dictionaries;

test('pl and en dictionaries have identical key sets', () => {
  const plKeys = Object.keys(pl).sort(), enKeys = Object.keys(en).sort();
  assert.deepEqual(plKeys.filter((k) => !(k in en)), [], 'keys missing in en');
  assert.deepEqual(enKeys.filter((k) => !(k in pl)), [], 'keys missing in pl');
  assert.deepEqual(plKeys, enKeys);
});

test('every translation is a non-empty string with the same {params} in both languages', () => {
  const params = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  Object.keys(pl).forEach((k) => {
    assert.equal(typeof pl[k], 'string', k);
    assert.equal(typeof en[k], 'string', k);
    assert.ok(pl[k].length && en[k].length, k);
    assert.equal(params(pl[k]), params(en[k]), 'params differ for ' + k);
  });
});

test('t() translates and falls back en -> pl -> key', () => {
  assert.equal(I18N.t('nav.rig', null, 'pl'), 'Warsztat');
  assert.equal(I18N.t('nav.rig', null, 'en'), 'Workshop');
  assert.equal(I18N.t('nav.rig', null, 'de'), 'Warsztat');
  assert.equal(I18N.t('no.such.key', null, 'en'), 'no.such.key');
  pl['test.only_pl'] = 'tylko pl';
  try {
    assert.equal(I18N.t('test.only_pl', null, 'en'), 'tylko pl');
  } finally { delete pl['test.only_pl']; }
});

test('t() interpolates params and leaves unknown placeholders intact', () => {
  assert.equal(I18N.t('ref.milestone', { count: 10, cur: 3 }, 'en'), 'Invite 10 people (3/10)');
  assert.equal(I18N.t('ref.milestone', { count: 10, cur: 3 }, 'pl'), 'Zaproś 10 osób (3/10)');
  assert.equal(I18N.t('ref.milestone', { count: 10 }, 'en'), 'Invite 10 people ({cur}/10)');
  assert.equal(I18N.t('chat.online', { n: 0 }, 'en'), '0 online');
  assert.equal(I18N.t('nav.home'), 'Home');
});

test('setLang/getLang use the current language and ignore unsupported values', () => {
  I18N.setLang('en');
  assert.equal(I18N.getLang(), 'en');
  assert.equal(I18N.t('nav.rig'), 'Workshop');
  assert.equal(I18N.locale(), 'en-GB');
  I18N.setLang('xx');
  assert.equal(I18N.getLang(), 'pl');
  assert.equal(I18N.locale(), 'pl-PL');
});

test('detect() maps Telegram language_code: pl stays pl, others become en, missing defaults to pl', () => {
  assert.equal(I18N.detect('pl'), 'pl');
  assert.equal(I18N.detect('pl-PL'), 'pl');
  assert.equal(I18N.detect('en'), 'en');
  assert.equal(I18N.detect('de'), 'en');
  assert.equal(I18N.detect(undefined), 'pl');
  assert.equal(Core.newUser({ id: 1 }).settings.language, 'pl');
  assert.equal(Core.newUser({ id: 1, language_code: 'pl' }).settings.language, 'pl');
  assert.equal(Core.newUser({ id: 1, language_code: 'en' }).settings.language, 'en');
});

test('content() translates built-in values but leaves admin-edited values untouched', () => {
  I18N.setLang('en');
  try {
    assert.equal(I18N.content('task.earn_xp', 'Zdobądź 50 XP', 'Zdobądź 50 XP'), 'Earn 50 XP');
    assert.equal(I18N.content('task.earn_xp', 'My custom title', 'Zdobądź 50 XP'), 'My custom title');
    assert.equal(I18N.content('task.custom_1', 'Custom task', undefined), 'Custom task');
  } finally { I18N.setLang('pl'); }
});

test('config-driven titles (levels, tasks, events, rig parts, achievements) all have translations', () => {
  CFG.LEVELS.forEach((l) => assert.ok(I18N.has('level.' + l.level), 'level.' + l.level));
  CFG.TASKS.forEach((x) => assert.ok(I18N.has('task.' + x.id), 'task.' + x.id));
  CFG.RIG_PARTS.forEach((p) => assert.ok(I18N.has('rig.part.' + p.key), 'rig.part.' + p.key));
  CFG.EVENTS.forEach((e) => ['title', 'desc'].forEach((f) => assert.ok(I18N.has('event.' + e.id + '.' + f), e.id + '.' + f)));
  const user = Core.newUser({ id: 5 });
  Core.achievements(user, { rank: 1 }).forEach((a) => {
    assert.ok(a.titleKey && I18N.has(a.titleKey), a.id);
    assert.ok(!I18N.t(a.titleKey, a.params, 'en').includes('{'), 'unresolved param in ' + a.id);
  });
});

test('static t()/tr() keys used in the UI sources exist in the dictionaries', () => {
  const root = path.join(__dirname, '..');
  const sources = [['app.js', '', /\btr\('([\w.\-]+)'\s*[,)]/g], ['admin-ui.js', 'admin.', /\bt\('([\w.\-]+)'\)/g],
    ['admin-monetization.js', 'monet.', /\bt\('([\w.\-]+)'\)/g], ['engagement-ui.js', 'eng.', /\bt\('([\w.\-]+)'\)/g]];
  sources.forEach(([file, prefix, re]) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    let m;
    while ((m = re.exec(src))) assert.ok(I18N.has(prefix + m[1], 'pl'), file + ': missing key ' + prefix + m[1]);
  });
});

test('validateAmount error codes map to wallet.err.* keys', () => {
  [Core.validateAmount('abc'), Core.validateAmount('5', 1)].forEach((r) => {
    assert.equal(r.ok, false);
    assert.ok(I18N.has('wallet.err.' + r.code), 'wallet.err.' + r.code);
  });
});
