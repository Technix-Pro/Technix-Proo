/**
 * TechnixPro Admin Panel - Complete Frontend Logic
 * Pełna logika panelu administratora z localStorage
 * Frontend-only (backend integracja nastąpi później)
 */

(function () {
  'use strict';

  const ADMIN_ID = (window.TECHNIX_CONFIG && window.TECHNIX_CONFIG.ADMIN_IDS && window.TECHNIX_CONFIG.ADMIN_IDS[0]) || '';
  const CONFIG = {
    storagePrefix: 'tp_',
    maxPostsDisplay: 50,
    maxNotificationsDisplay: 100,
    maxTasksDisplay: 50
  };

  // ============================================
  // STORAGE LAYER
  // ============================================
  const Storage = {
    keys: {
      admin_config: CONFIG.storagePrefix + 'admin_config',
      live_events: CONFIG.storagePrefix + 'live_events',
      public_posts: CONFIG.storagePrefix + 'public_posts',
      user_tasks: CONFIG.storagePrefix + 'user_tasks',
      notifications: CONFIG.storagePrefix + 'notifications',
      user_stats: CONFIG.storagePrefix + 'user_stats',
      current_user: CONFIG.storagePrefix + 'current_user_id'
    },

    get(key, defaultVal = null) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
      } catch (e) {
        console.error('Storage.get error:', e);
        return defaultVal;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('Storage.set error:', e);
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.error('Storage.remove error:', e);
        return false;
      }
    },

    clear() {
      Object.values(this.keys).forEach(key => this.remove(key));
    }
  };

  // ============================================
  // AUTH & USER MANAGEMENT
  // ============================================
  const Auth = {
    getCurrentUserId() {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        return String(window.Telegram.WebApp.initDataUnsafe.user.id);
      }
      const stored = Storage.get(Storage.keys.current_user);
      return stored || 'guest_' + Date.now();
    },

    isAdmin() {
      return this.getCurrentUserId() === String(ADMIN_ID);
    },

    setCurrentUser(userId) {
      Storage.set(Storage.keys.current_user, String(userId));
    }
  };

  // ============================================
  // LIVE EVENTS MANAGER
  // ============================================
  const LiveEvents = {
    getAll() {
      return Storage.get(Storage.keys.live_events, []);
    },

    create(title, description, reward, duration = 'week') {
      const events = this.getAll();
      const newEvent = {
        id: Date.now(),
        title,
        description,
        reward: Number(reward) || 0,
        duration,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      events.unshift(newEvent);
      Storage.set(Storage.keys.live_events, events);
      return newEvent;
    },

    update(eventId, data) {
      const events = this.getAll();
      const idx = events.findIndex(e => e.id === eventId);
      if (idx !== -1) {
        events[idx] = { ...events[idx], ...data, updated_at: new Date().toISOString() };
        Storage.set(Storage.keys.live_events, events);
        return events[idx];
      }
      return null;
    },

    delete(eventId) {
      const events = this.getAll();
      const filtered = events.filter(e => e.id !== eventId);
      Storage.set(Storage.keys.live_events, filtered);
    },

    getActive() {
      const events = this.getAll();
      return events.find(e => e.active === true);
    },

    setActive(eventId) {
      const events = this.getAll();
      events.forEach(e => e.active = (e.id === eventId));
      Storage.set(Storage.keys.live_events, events);
    }
  };

  // ============================================
  // POSTS & MATERIALS MANAGER
  // ============================================
  const Posts = {
    getAll() {
      return Storage.get(Storage.keys.public_posts, []);
    },

    create(title, content, options = {}) {
      const posts = this.getAll();
      const post = {
        id: Date.now(),
        title: title || 'Bez tytułu',
        content,
        author: options.author || 'Administrator',
        type: options.type || 'post', // post, image, file, link
        media: options.media || [], // URL(s) of images/files
        attachment_urls: options.attachments || [],
        tags: options.tags || [],
        visible: options.visible !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        views: 0,
        likes: 0
      };
      posts.unshift(post);
      Storage.set(Storage.keys.public_posts, posts.slice(0, CONFIG.maxPostsDisplay));
      return post;
    },

    update(postId, data) {
      const posts = this.getAll();
      const idx = posts.findIndex(p => p.id === postId);
      if (idx !== -1) {
        posts[idx] = { ...posts[idx], ...data, updated_at: new Date().toISOString() };
        Storage.set(Storage.keys.public_posts, posts);
        return posts[idx];
      }
      return null;
    },

    delete(postId) {
      const posts = this.getAll();
      const filtered = posts.filter(p => p.id !== postId);
      Storage.set(Storage.keys.public_posts, filtered);
    },

    getPublic() {
      return this.getAll().filter(p => p.visible);
    },

    incrementViews(postId) {
      const posts = this.getAll();
      const post = posts.find(p => p.id === postId);
      if (post) {
        post.views = (post.views || 0) + 1;
        Storage.set(Storage.keys.public_posts, posts);
      }
    }
  };

  // ============================================
  // TASKS MANAGER (ZADANIA BONUSOWE)
  // ============================================
  const Tasks = {
    getAll() {
      return Storage.get(Storage.keys.user_tasks, []);
    },

    create(title, description, reward, category = 'general') {
      const tasks = this.getAll();
      const task = {
        id: Date.now(),
        title,
        description,
        reward: Number(reward) || 0,
        category, // general, daily, weekly, monthly, special
        completed_by: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true
      };
      tasks.unshift(task);
      Storage.set(Storage.keys.user_tasks, tasks.slice(0, CONFIG.maxTasksDisplay));
      return task;
    },

    update(taskId, data) {
      const tasks = this.getAll();
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        tasks[idx] = { ...tasks[idx], ...data, updated_at: new Date().toISOString() };
        Storage.set(Storage.keys.user_tasks, tasks);
        return tasks[idx];
      }
      return null;
    },

    delete(taskId) {
      const tasks = this.getAll();
      const filtered = tasks.filter(t => t.id !== taskId);
      Storage.set(Storage.keys.user_tasks, filtered);
    },

    markCompleted(taskId, userId) {
      const tasks = this.getAll();
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (!task.completed_by) task.completed_by = [];
        if (!task.completed_by.includes(userId)) {
          task.completed_by.push(userId);
          Storage.set(Storage.keys.user_tasks, tasks);
        }
      }
      return task;
    },

    isCompletedBy(taskId, userId) {
      const task = this.getAll().find(t => t.id === taskId);
      return task && task.completed_by && task.completed_by.includes(userId);
    }
  };

  // ============================================
  // NOTIFICATIONS MANAGER
  // ============================================
  const Notifications = {
    getAll() {
      return Storage.get(Storage.keys.notifications, []);
    },

    create(title, body, options = {}) {
      const notifs = this.getAll();
      const notif = {
        id: Date.now(),
        title,
        body,
        icon: options.icon || '📢',
        type: options.type || 'info', // info, success, warning, error
        action_url: options.action_url || null,
        read: false,
        sent_to: options.sent_to || 'all', // all, specific_users
        created_at: new Date().toISOString()
      };
      notifs.unshift(notif);
      Storage.set(Storage.keys.notifications, notifs.slice(0, CONFIG.maxNotificationsDisplay));
      return notif;
    },

    markAsRead(notifId) {
      const notifs = this.getAll();
      const notif = notifs.find(n => n.id === notifId);
      if (notif) {
        notif.read = true;
        Storage.set(Storage.keys.notifications, notifs);
      }
    },

    getUnread() {
      return this.getAll().filter(n => !n.read);
    },

    deleteOld(daysOld = 30) {
      const notifs = this.getAll();
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const filtered = notifs.filter(n => new Date(n.created_at) > cutoff);
      Storage.set(Storage.keys.notifications, filtered);
    }
  };

  // ============================================
  // USER STATISTICS
  // ============================================
  const Statistics = {
    getAll() {
      return Storage.get(Storage.keys.user_stats, {
        total_users: 1,
        total_posts: 0,
        total_tasks: 0,
        total_events: 0,
        total_stars_distributed: 0,
        active_users_today: 0,
        engagement_rate: 0
      });
    },

    update(data) {
      const stats = this.getAll();
      Object.assign(stats, data);
      Storage.set(Storage.keys.user_stats, stats);
      return stats;
    },

    calculateStats() {
      const stats = {
        total_users: 1,
        total_posts: Posts.getAll().length,
        total_tasks: Tasks.getAll().length,
        total_events: LiveEvents.getAll().length,
        total_notifications: Notifications.getAll().length,
        total_stars_distributed: Tasks.getAll().reduce((sum, t) => sum + (t.reward || 0), 0),
        active_tasks: Tasks.getAll().filter(t => t.active).length,
        active_events: LiveEvents.getAll().filter(e => e.active).length,
        last_updated: new Date().toISOString()
      };
      this.update(stats);
      return stats;
    }
  };

  // ============================================
  // UI RENDERING
  // ============================================
  const UI = {
    injectStyles() {
      if (document.getElementById('tp-admin-styles')) return;
      const style = document.createElement('style');
      style.id = 'tp-admin-styles';
      style.textContent = `
        .tp-admin-container { display: grid; gap: 14px; }
        .tp-admin-section { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 14px; }
        .tp-admin-header { font-size: 12px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: #a78bfa; margin-bottom: 12px; }
        .tp-admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
        .tp-admin-input, .tp-admin-textarea, .tp-admin-select {
          width: 100%;
          background: #050b13;
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s;
        }
        .tp-admin-input:focus, .tp-admin-textarea:focus { border-color: #8b5cf6; }
        .tp-admin-btn {
          background: linear-gradient(135deg, #8b5cf6, #22d3ee);
          color: white;
          border: 0;
          border-radius: 12px;
          font-weight: 700;
          font-size: 11px;
          padding: 10px 14px;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .tp-admin-btn:active { transform: scale(0.96); }
        .tp-admin-card { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 10px; }
        .tp-stat-box { text-align: center; padding: 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; }
        .tp-stat-label { font-size: 10px; color: #94a3b8; font-weight: 600; }
        .tp-stat-value { font-size: 20px; font-weight: 900; margin-top: 6px; }
        .tp-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; }
        .tp-post-item { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
        .tp-post-title { font-size: 12px; font-weight: 700; color: #f8fafc; }
        .tp-post-meta { font-size: 10px; color: #94a3b8; margin-top: 6px; }
        .tp-post-media { width: 100%; margin-top: 8px; border-radius: 10px; max-height: 200px; object-fit: cover; }
        .tp-task-item { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; padding: 10px; margin-bottom: 8px; }
        .tp-task-info { display: grid; gap: 4px; }
        .tp-task-title { font-size: 11px; font-weight: 700; color: #f8fafc; }
        .tp-task-reward { font-size: 10px; color: #fbbf24; }
        .tp-event-highlight { background: linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(139, 92, 246, 0.12)); border: 1px solid rgba(34, 211, 238, 0.3); }
        .tp-tab-btn { padding: 8px 12px; border: none; background: transparent; color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tp-tab-btn.active { color: #a78bfa; border-bottom-color: #8b5cf6; }
      `;
      document.head.appendChild(style);
    },

    renderAdminPanel(containerSelector) {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      container.innerHTML = `
        <div class="tp-admin-container">
          <!-- SEKCJA: OVERVIEW -->
          <div class="tp-admin-section">
            <div class="tp-admin-header">📊 Panel Administratora</div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
              <span class="tp-badge" style="background: rgba(139, 92, 246, 0.12); color: #d8b4fe; border: 1px solid rgba(139, 92, 246, 0.3)">ID: ${ADMIN_ID}</span>
              <span class="tp-badge" style="background: rgba(34, 211, 238, 0.12); color: #a5f3fc; border: 1px solid rgba(34, 211, 238, 0.3)">ADMIN</span>
            </div>
            <div class="tp-admin-grid">
              <div class="tp-stat-box">
                <div class="tp-stat-label">Posty</div>
                <div class="tp-stat-value" style="color: #67e8f9;" id="tp-stat-posts">0</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Zadania</div>
                <div class="tp-stat-value" style="color: #c4b5fd;" id="tp-stat-tasks">0</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Eventy Live</div>
                <div class="tp-stat-value" style="color: #6ee7b7;" id="tp-stat-events">0</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Powiadomienia</div>
                <div class="tp-stat-value" style="color: #fbbf24;" id="tp-stat-notifs">0</div>
              </div>
            </div>
          </div>

          <!-- SEKCJA: POSTY I MATERIAŁY -->
          <div class="tp-admin-section">
            <div class="tp-admin-header">📝 Posty i Materiały (Przegląd)</div>
            <div style="display: grid; gap: 10px; margin-bottom: 12px;">
              <input id="tp-post-title" class="tp-admin-input" placeholder="Tytuł posta" />
              <textarea id="tp-post-content" class="tp-admin-textarea" rows="3" placeholder="Zawartość / Opis materiału"></textarea>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <input id="tp-post-type" class="tp-admin-select" placeholder="Typ: post, image, file, link" value="post" />
                <input id="tp-post-media" class="tp-admin-input" placeholder="URL(s) mediów (oddziel przecinkami)" />
              </div>
              <input id="tp-post-tags" class="tp-admin-input" placeholder="Tagi (oddziel przecinkami)" />
              <button class="tp-admin-btn" style="width: 100%" id="tp-btn-create-post">📤 Opublikuj Post</button>
            </div>
            <div id="tp-posts-list" style="max-height: 300px; overflow-y: auto;"></div>
          </div>

          <!-- SEKCJA: EVENT LIVE -->
          <div class="tp-admin-section tp-event-highlight">
            <div class="tp-admin-header">🎉 Event Live (Bonusy)</div>
            <div style="display: grid; gap: 10px; margin-bottom: 12px;">
              <input id="tp-event-title" class="tp-admin-input" placeholder="Nazwa eventu (np. Cyber Week)" />
              <textarea id="tp-event-desc" class="tp-admin-textarea" rows="2" placeholder="Opis eventu i wytyczne"></textarea>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <input id="tp-event-reward" class="tp-admin-input" type="number" placeholder="Nagroda (gwiazdki)" value="50" />
                <input id="tp-event-duration" class="tp-admin-select" placeholder="Czas trwania" value="week" />
              </div>
              <button class="tp-admin-btn" style="width: 100%" id="tp-btn-create-event">✅ Aktywuj Event</button>
            </div>
            <div id="tp-event-active" style="padding: 10px; background: rgba(34, 211, 238, 0.08); border-radius: 10px; border: 1px solid rgba(34, 211, 238, 0.2);">
              <div style="font-size: 10px; color: #94a3b8;">Aktywny event:</div>
              <div id="tp-event-active-title" style="font-size: 12px; font-weight: 700; color: #a5f3fc; margin-top: 4px;">Brak aktywnego eventu</div>
            </div>
          </div>

          <!-- SEKCJA: ZADANIA BONUSOWE -->
          <div class="tp-admin-section">
            <div class="tp-admin-header">✅ Zadania Bonusowe (Zakładka Bonusy)</div>
            <div style="display: grid; gap: 10px; margin-bottom: 12px;">
              <input id="tp-task-title" class="tp-admin-input" placeholder="Nazwa zadania" />
              <textarea id="tp-task-desc" class="tp-admin-textarea" rows="2" placeholder="Opis zadania"></textarea>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <input id="tp-task-reward" class="tp-admin-input" type="number" placeholder="Nagroda (gwiazdki)" value="25" />
                <input id="tp-task-category" class="tp-admin-select" placeholder="Kategoria" value="general" />
              </div>
              <button class="tp-admin-btn" style="width: 100%" id="tp-btn-create-task">➕ Dodaj Zadanie</button>
            </div>
            <div id="tp-tasks-list" style="max-height: 300px; overflow-y: auto;"></div>
          </div>

          <!-- SEKCJA: POWIADOMIENIA -->
          <div class="tp-admin-section">
            <div class="tp-admin-header">📢 Wyślij Powiadomienie</div>
            <div style="display: grid; gap: 10px; margin-bottom: 12px;">
              <input id="tp-notif-title" class="tp-admin-input" placeholder="Tytuł powiadomienia" />
              <textarea id="tp-notif-body" class="tp-admin-textarea" rows="2" placeholder="Zawartość powiadomienia"></textarea>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <input id="tp-notif-type" class="tp-admin-select" placeholder="Typ" value="info" />
                <input id="tp-notif-icon" class="tp-admin-input" placeholder="Emoji ikona" value="📢" />
              </div>
              <button class="tp-admin-btn" style="width: 100%; background: linear-gradient(135deg, #10b981, #34d399);" id="tp-btn-send-notif">🚀 Wyślij Do Użytkowników</button>
            </div>
            <div id="tp-notifs-list" style="max-height: 250px; overflow-y: auto;"></div>
          </div>

          <!-- SEKCJA: STATYSTYKI -->
          <div class="tp-admin-section">
            <div class="tp-admin-header">📈 Statystyki Użytkowników</div>
            <div class="tp-admin-grid">
              <div class="tp-stat-box">
                <div class="tp-stat-label">Użytkownicy</div>
                <div class="tp-stat-value" style="color: #67e8f9;" id="tp-stats-users">1</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Gwiazdek (razem)</div>
                <div class="tp-stat-value" style="color: #fbbf24;" id="tp-stats-stars">0</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Aktywne zadania</div>
                <div class="tp-stat-value" style="color: #c4b5fd;" id="tp-stats-active-tasks">0</div>
              </div>
              <div class="tp-stat-box">
                <div class="tp-stat-label">Aktywne eventy</div>
                <div class="tp-stat-value" style="color: #6ee7b7;" id="tp-stats-active-events">0</div>
              </div>
            </div>
            <button class="tp-admin-btn" style="width: 100%; margin-top: 12px;" id="tp-btn-refresh-stats">🔄 Odśwież Statystyki</button>
          </div>
        </div>
      `;

      this.attachEventListeners();
      this.updateStats();
      this.renderPostsList();
      this.renderTasksList();
      this.renderNotificationsList();
      this.renderActiveEvent();
    },

    attachEventListeners() {
      // Tworzenie posta
      document.getElementById('tp-btn-create-post').addEventListener('click', () => {
        const title = document.getElementById('tp-post-title').value.trim();
        const content = document.getElementById('tp-post-content').value.trim();
        const type = document.getElementById('tp-post-type').value.trim() || 'post';
        const media = document.getElementById('tp-post-media').value.split(',').map(m => m.trim()).filter(m => m);
        const tags = document.getElementById('tp-post-tags').value.split(',').map(t => t.trim()).filter(t => t);

        if (!title && !content) {
          alert('Podaj tytuł lub zawartość posta');
          return;
        }

        Posts.create(title, content, { type, media, tags });
        document.getElementById('tp-post-title').value = '';
        document.getElementById('tp-post-content').value = '';
        document.getElementById('tp-post-media').value = '';
        document.getElementById('tp-post-tags').value = '';
        this.renderPostsList();
        this.updateStats();
      });

      // Tworzenie eventu
      document.getElementById('tp-btn-create-event').addEventListener('click', () => {
        const title = document.getElementById('tp-event-title').value.trim();
        const desc = document.getElementById('tp-event-desc').value.trim();
        const reward = document.getElementById('tp-event-reward').value.trim();
        const duration = document.getElementById('tp-event-duration').value.trim() || 'week';

        if (!title || !desc) {
          alert('Podaj tytuł i opis eventu');
          return;
        }

        const event = LiveEvents.create(title, desc, reward, duration);
        LiveEvents.setActive(event.id);
        document.getElementById('tp-event-title').value = '';
        document.getElementById('tp-event-desc').value = '';
        document.getElementById('tp-event-reward').value = '50';
        this.renderActiveEvent();
        this.updateStats();
      });

      // Dodawanie zadania
      document.getElementById('tp-btn-create-task').addEventListener('click', () => {
        const title = document.getElementById('tp-task-title').value.trim();
        const desc = document.getElementById('tp-task-desc').value.trim();
        const reward = document.getElementById('tp-task-reward').value.trim();
        const category = document.getElementById('tp-task-category').value.trim() || 'general';

        if (!title) {
          alert('Podaj nazwę zadania');
          return;
        }

        Tasks.create(title, desc, reward, category);
        document.getElementById('tp-task-title').value = '';
        document.getElementById('tp-task-desc').value = '';
        document.getElementById('tp-task-reward').value = '25';
        this.renderTasksList();
        this.updateStats();
      });

      // Wysyłanie powiadomienia
      document.getElementById('tp-btn-send-notif').addEventListener('click', () => {
        const title = document.getElementById('tp-notif-title').value.trim();
        const body = document.getElementById('tp-notif-body').value.trim();
        const type = document.getElementById('tp-notif-type').value.trim() || 'info';
        const icon = document.getElementById('tp-notif-icon').value.trim() || '📢';

        if (!title || !body) {
          alert('Podaj tytuł i zawartość powiadomienia');
          return;
        }

        Notifications.create(title, body, { type, icon });
        document.getElementById('tp-notif-title').value = '';
        document.getElementById('tp-notif-body').value = '';
        this.renderNotificationsList();
        this.updateStats();
      });

      // Odświeżanie statystyk
      document.getElementById('tp-btn-refresh-stats').addEventListener('click', () => {
        Statistics.calculateStats();
        this.updateStats();
      });
    },

    renderPostsList() {
      const container = document.getElementById('tp-posts-list');
      const posts = Posts.getAll();
      container.innerHTML = posts.slice(0, 10).map(post => `
        <div class="tp-post-item">
          <div class="tp-post-title">${post.title || 'Bez tytułu'}</div>
          <div style="font-size: 11px; color: #e2e8f0; margin-top: 6px; line-height: 1.4;">${post.content.substring(0, 80)}...</div>
          ${post.media && post.media.length > 0 ? `<img src="${post.media[0]}" class="tp-post-media" />` : ''}
          <div class="tp-post-meta">Typ: ${post.type} | 👁 ${post.views || 0} | ${new Date(post.created_at).toLocaleString('pl-PL')}</div>
        </div>
      `).join('');
    },

    renderTasksList() {
      const container = document.getElementById('tp-tasks-list');
      const tasks = Tasks.getAll();
      container.innerHTML = tasks.slice(0, 15).map(task => `
        <div class="tp-task-item">
          <div class="tp-task-info">
            <div class="tp-task-title">${task.title}</div>
            <div class="tp-task-reward">💰 ${task.reward} ★ (${task.category})</div>
          </div>
          <span class="tp-badge" style="background: rgba(139, 92, 246, 0.12); color: #d8b4fe;">${task.completed_by?.length || 0}</span>
        </div>
      `).join('');
    },

    renderNotificationsList() {
      const container = document.getElementById('tp-notifs-list');
      const notifs = Notifications.getAll();
      container.innerHTML = notifs.slice(0, 8).map(notif => `
        <div class="tp-admin-card">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">${notif.icon || '📢'}</span>
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #f8fafc;">${notif.title}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${notif.body.substring(0, 60)}...</div>
            </div>
          </div>
        </div>
      `).join('');
    },

    renderActiveEvent() {
      const container = document.getElementById('tp-event-active');
      const activeEvent = LiveEvents.getActive();
      if (activeEvent) {
        container.innerHTML = `
          <div style="font-size: 10px; color: #94a3b8;">Aktywny event:</div>
          <div id="tp-event-active-title" style="font-size: 12px; font-weight: 700; color: #22d3ee; margin-top: 4px;">${activeEvent.title}</div>
          <div style="font-size: 10px; color: #a5f3fc; margin-top: 4px;">💰 ${activeEvent.reward} ★ | ⏱ ${activeEvent.duration}</div>
        `;
      }
    },

    updateStats() {
      const stats = Statistics.calculateStats();
      document.getElementById('tp-stat-posts').textContent = stats.total_posts;
      document.getElementById('tp-stat-tasks').textContent = stats.total_tasks;
      document.getElementById('tp-stat-events').textContent = stats.total_events;
      document.getElementById('tp-stat-notifs').textContent = stats.total_notifications;
      document.getElementById('tp-stats-users').textContent = '1';
      document.getElementById('tp-stats-stars').textContent = stats.total_stars_distributed;
      document.getElementById('tp-stats-active-tasks').textContent = stats.active_tasks;
      document.getElementById('tp-stats-active-events').textContent = stats.active_events;
    }
  };

  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  function init() {
    const userId = Auth.getCurrentUserId();
    const isAdminUser = Auth.isAdmin();

    UI.injectStyles();

    if (isAdminUser) {
      // Dla admina: pokaż pełny panel
      const adminContainer = document.getElementById('admin-panel-container');
      if (adminContainer) {
        UI.renderAdminPanel('#admin-panel-container');
      }
    } else {
      // Dla zwykłych użytkowników: ukryj panel admina
      const adminContainer = document.getElementById('admin-panel-container');
      if (adminContainer) {
        adminContainer.style.display = 'none';
      }
    }
  }

  // Inicjalizacja gdy dokument jest gotowy
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Eksport publicznych API (opcjonalnie, dla debugowania)
  window.TechAdmin = {
    Auth,
    Posts,
    Tasks,
    LiveEvents,
    Notifications,
    Statistics,
    Storage
  };
})();
