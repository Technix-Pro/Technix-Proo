(function () {
  const keys = {
    published: 'technixpro:config:v1:published',
    draft: 'technixpro:config:v1:draft',
    history: 'technixpro:config:v1:history'
  };
  const fallback = window.TECHNIX_CONFIG.DEFAULT_CONFIG;
  const memory = {};

  function read(key, initial) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : initial;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : initial;
    }
  }

  function write(key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Memory fallback keeps the demo usable when browser storage is unavailable.
    }
    return value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentDraft() {
    return read(keys.draft, read(keys.published, fallback));
  }

  function updateCollection(name, id, update) {
    const config = currentDraft();
    const list = config[name];
    const index = list.findIndex(item => item.id === id);
    if (update === null) {
      if (index !== -1) list.splice(index, 1);
    } else if (index === -1) {
      list.push(update);
    } else {
      list[index] = { ...list[index], ...update };
    }
    write(keys.draft, config);
    return clone(config[name]);
  }

  window.TechnixAPI = {
    async getConfig() {
      const published = read(keys.published, fallback);
      return { published: clone(published), draft: clone(read(keys.draft, published)) };
    },
    async saveDraft(config) {
      return clone(write(keys.draft, config));
    },
    async publishConfig(config) {
      const history = read(keys.history, []);
      const published = read(keys.published, fallback);
      history.unshift(clone(published));
      write(keys.history, history.slice(0, 5));
      write(keys.published, config);
      write(keys.draft, config);
      return clone(config);
    },
    async rejectDraft() {
      const published = read(keys.published, fallback);
      write(keys.draft, published);
      return clone(published);
    },
    async rollbackConfig() {
      const history = read(keys.history, []);
      if (!history.length) throw new Error('Brak poprzedniej opublikowanej wersji.');
      const previous = history.shift();
      write(keys.history, history);
      write(keys.published, previous);
      write(keys.draft, previous);
      return clone(previous);
    },
    async getPresets() {
      return clone(currentDraft().presets || []);
    },
    async listTasks() { return clone(currentDraft().tasks); },
    async createTask(item) { return updateCollection('tasks', item.id, item); },
    async updateTask(id, item) { return updateCollection('tasks', id, item); },
    async deleteTask(id) { return updateCollection('tasks', id, null); },
    async createEvent(item) { return updateCollection('events', item.id, item); },
    async updateEvent(id, item) { return updateCollection('events', id, item); },
    async deleteEvent(id) { return updateCollection('events', id, null); },
    async createPost(item) { return updateCollection('posts', item.id, item); },
    async updatePost(id, item) { return updateCollection('posts', id, item); },
    async deletePost(id) { return updateCollection('posts', id, null); },
    async createNotification(item) { return updateCollection('notifications', item.id, item); },
    async updateNotification(id, item) { return updateCollection('notifications', id, item); },
    async deleteNotification(id) { return updateCollection('notifications', id, null); },
    async getHistory() { return clone(read(keys.history, [])); }
  };
})();
