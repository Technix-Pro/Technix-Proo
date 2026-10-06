(function () {
  let published = null;
  let draft = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, value) {
    return {
      ...clone(base),
      ...clone(value),
      features: { ...base.features, ...(value.features || {}) },
      animations: { ...base.animations, ...(value.animations || {}) },
      statusBanner: { ...base.statusBanner, ...(value.statusBanner || {}) },
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
      const changes = preset.config || {};
      if (changes.features || changes.animations || changes.activePhase || changes.statusBanner) {
        draft = merge(draft, changes);
      } else {
        draft = merge(draft, changes);
      }
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
