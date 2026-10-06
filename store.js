(function () {
  let published = null;
  let draft = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, value) {
    const flags = (defaults, incoming) => Object.keys(defaults).reduce((result, key) => {
      result[key] = incoming && typeof incoming[key] === 'boolean' ? incoming[key] : defaults[key];
      return result;
    }, {});
    const status = value.statusBanner || {};
    return {
      ...clone(base),
      ...clone(value),
      features: flags(base.features, value.features),
      animations: flags(base.animations, value.animations),
      statusBanner: {
        text: typeof status.text === 'string' ? status.text : base.statusBanner.text,
        level: ['info', 'warn', 'ok'].includes(status.level) ? status.level : base.statusBanner.level,
        visible: typeof status.visible === 'boolean' ? status.visible : base.statusBanner.visible
      },
      tasks: Array.isArray(value.tasks) ? value.tasks : clone(base.tasks),
      events: Array.isArray(value.events) ? value.events : clone(base.events),
      posts: Array.isArray(value.posts) ? value.posts : clone(base.posts),
      notifications: Array.isArray(value.notifications) ? value.notifications : clone(base.notifications),
      presets: Array.isArray(value.presets) ? value.presets : clone(base.presets)
    };
  }

  function validate(config) {
    if (!config || ![1, 2, 3].includes(Number(config.activePhase))) throw new Error('Wybierz fazę 1, 2 lub 3.');
    for (const collection of ['tasks', 'events', 'posts', 'notifications']) {
      if (!Array.isArray(config[collection])) throw new Error(`Nieprawidłowa lista: ${collection}.`);
    }
    for (const task of config.tasks) {
      if (!String(task.title || '').trim() || !Number.isFinite(Number(task.reward)) || Number(task.reward) < 0) {
        throw new Error('Każde zadanie musi mieć nazwę i nieujemną nagrodę.');
      }
      if (task.order !== undefined && (!Number.isFinite(Number(task.order)) || Number(task.order) < 0)) {
        throw new Error('Kolejność zadania nie może być ujemna.');
      }
    }
    for (const event of config.events) {
      if (!String(event.title || '').trim() || !Number.isFinite(Number(event.reward)) || Number(event.reward) < 0) {
        throw new Error('Każdy event musi mieć nazwę i nieujemną nagrodę.');
      }
    }
    return config;
  }

  window.TechnixStore = {
    async init() {
      const state = await window.TechnixAPI.getConfig();
      const defaults = window.TECHNIX_CONFIG.DEFAULT_CONFIG;
      published = merge(defaults, state.published || {});
      draft = merge(published, state.draft || {});
      return { published: clone(published), draft: clone(draft) };
    },
    getPublished() { return clone(published); },
    getDraft() { return clone(draft); },
    getVisible(preview) { return clone(preview ? draft : published); },
    async save(config) {
      draft = merge(published, validate(config));
      await window.TechnixAPI.saveDraft(draft);
      return clone(draft);
    },
    async publish() {
      draft = merge(published, validate(draft));
      draft.version = Number(published.version || 0) + 1;
      published = await window.TechnixAPI.publishConfig(draft);
      return clone(published);
    },
    async reject() {
      published = await window.TechnixAPI.rejectDraft();
      draft = clone(published);
      return clone(draft);
    },
    async rollback() {
      published = await window.TechnixAPI.rollbackConfig();
      draft = clone(published);
      return clone(draft);
    },
    async replaceDraft(config) {
      draft = merge(published, validate(config));
      await window.TechnixAPI.saveDraft(draft);
      return clone(draft);
    },
    async loadPreset(id) {
      const preset = draft.presets.find(item => item.id === id);
      if (!preset) throw new Error('Nie znaleziono presetu.');
      const changes = clone(preset.config || {});
      const defaultsByPhase = {
        1: { clicker: true, rigBuilder: true, wallet: false, referrals: false, leaderboard: false, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true },
        2: { clicker: true, rigBuilder: true, wallet: false, referrals: true, leaderboard: true, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true },
        3: { clicker: true, rigBuilder: true, wallet: true, referrals: true, leaderboard: true, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true }
      };
      if (changes.activePhase && !changes.features) {
        changes.features = defaultsByPhase[changes.activePhase];
      }
      draft = merge(draft, changes);
      validate(draft);
      await window.TechnixAPI.saveDraft(draft);
      return clone(draft);
    },
    async savePreset(name) {
      if (!String(name || '').trim()) throw new Error('Podaj nazwę presetu.');
      draft.presets.push({
        id: `preset-${Date.now()}`,
        name: String(name).trim(),
        config: clone({
          activePhase: draft.activePhase,
          features: draft.features,
          animations: draft.animations,
          statusBanner: draft.statusBanner,
          tasks: draft.tasks,
          events: draft.events,
          posts: draft.posts,
          notifications: draft.notifications
        })
      });
      await window.TechnixAPI.saveDraft(draft);
      return clone(draft);
    },
    validate
  };
})();
