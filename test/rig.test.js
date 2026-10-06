const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../app-config.js');
const rig = require('../rig-builder.js');

test('RIG catalog has the seven assembly parts in order', () => {
  assert.deepStrictEqual(config.RIG_PARTS.map((part) => part.key), [
    'desk', 'case', 'ram', 'gpu', 'monitor', 'keyboard', 'mouse'
  ]);
});

test('RIG progress is a percentage of seven installed parts', () => {
  assert.deepStrictEqual(rig.progress(['desk', 'case', 'ram', 'gpu', 'monitor']), {
    count: 5, total: 7, percent: 71
  });
  assert.strictEqual(rig.progress([]).percent, 0);
});

test('RIG purchases update stars and persist owned parts', () => {
  const previousWindow = global.window;
  const previousStorage = global.localStorage;
  const values = new Map();
  global.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
  global.window = {
    TP_CONFIG: config,
    TPCore: require('../core.js'),
    crypto: require('node:crypto').webcrypto,
    addEventListener() {}
  };
  delete require.cache[require.resolve('../data.js')];
  try {
    const data = require('../data.js') && global.window.TPData;
    const user = data.loadUser({ id: 42, username: 'builder' });
    user.stars = 25;
    assert.strictEqual(data.buyRigPart(user, 'case').ok, true);
    assert.strictEqual(user.stars, 0);
    assert.deepStrictEqual(data.rigParts(42), ['desk', 'case']);
    assert.strictEqual(values.has('technixpro:v2:rig:42'), true);
    assert.strictEqual(data.buyRigPart(user, 'case').reason, 'owned');
    assert.strictEqual(data.buyRigPart(user, 'gpu').reason, 'insufficient_stars');
    assert.deepStrictEqual(data.loadUser({ id: 42 }).rig_parts, ['desk', 'case']);
  } finally {
    delete require.cache[require.resolve('../data.js')];
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
});
