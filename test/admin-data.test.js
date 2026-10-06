const test = require('node:test');
const assert = require('node:assert/strict');

test('admin data layer: rig price override, audit log and backup round-trip', () => {
  const previousWindow = global.window, previousStorage = global.localStorage;
  const values = new Map();
  global.localStorage = {
    getItem(k) { return values.has(k) ? values.get(k) : null; },
    setItem(k, v) { values.set(k, v); },
    removeItem(k) { values.delete(k); },
    key(i) { return [...values.keys()][i] || null; },
    get length() { return values.size; }
  };
  global.localStorage = new Proxy(global.localStorage, { ownKeys: () => [...values.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  const config = require('../app-config.js');
  global.window = { TP_CONFIG: config, TPCore: require('../core.js'), TPAdmin: require('../admin-core.js'), crypto: require('node:crypto').webcrypto, addEventListener() {} };
  delete require.cache[require.resolve('../data.js')];
  try {
    require('../data.js');
    const data = global.window.TPData;
    assert.equal(data.rigPartsCatalog().find((p) => p.key === 'gpu').price, 40);
    const state = data.getAdminState();
    state.config = { rig_prices: { gpu: 5, desk: 50 } };
    data.saveAdminState(state);
    const catalog = data.rigPartsCatalog();
    assert.equal(catalog.find((p) => p.key === 'gpu').price, 5);
    assert.equal(catalog.find((p) => p.key === 'desk').price, 0);
    const user = data.loadUser({ id: 7 });
    user.stars = 5;
    assert.equal(data.buyRigPart(user, 'gpu').ok, true);

    data.audit(7, 'phase.deploy', 'phase', 2, { chat: true });
    assert.equal(data.getList('audit')[0].action, 'phase.deploy');

    data.savePosts([{ id: 'p1', content: 'x' }]);
    for (let i = 0; i < 7; i++) data.snapshot('s' + i);
    assert.equal(data.getList('history').length, 5);
    const backup = JSON.parse(JSON.stringify(data.exportBackup()));
    data.savePosts([]);
    assert.equal(data.importBackup({ app: 'nope' }).ok, false);
    assert.equal(data.importBackup(backup).ok, true);
    assert.deepEqual(data.getPosts().map((p) => p.id), ['p1']);
    assert.equal(data.rigPartsCatalog().find((p) => p.key === 'gpu').price, 5);
  } finally {
    delete require.cache[require.resolve('../data.js')];
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow;
    if (previousStorage === undefined) delete global.localStorage; else global.localStorage = previousStorage;
  }
});
