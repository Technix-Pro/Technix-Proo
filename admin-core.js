/**
 * Panel administratora / admin-core.js
 * Modular admin frontend package.
 * Backend-ready version: only requires replacing the storage adapter later.
 */
(function () {
  'use strict';

  const ADMIN_ID = (window.TECHNIX_CONFIG && window.TECHNIX_CONFIG.ADMIN_IDS && window.TECHNIX_CONFIG.ADMIN_IDS[0]) || '';

  // =============================
  // BACKEND READY CONFIG
  // =============================
  // To enable real backend later, set:
  // window.AdminPanelConfig = { backendEnabled: true, baseUrl: 'https://api.example.com' };
  const BackendConfig = {
    backendEnabled: !!(window.AdminPanelConfig && window.AdminPanelConfig.backendEnabled),
    baseUrl: (window.AdminPanelConfig && window.AdminPanelConfig.baseUrl) || '',
    endpointPrefix: (window.AdminPanelConfig && window.AdminPanelConfig.endpointPrefix) || '/api/admin'
  };

  const STORAGE = {
    materials: 'tp_admin_materials',
    tasks: 'tp_admin_tasks',
    notifications: 'tp_admin_notifications',
    event: 'tp_admin_event'
  };

  // =============================
  // STORAGE ADAPTER
  // =============================
  // Current version uses localStorage as default.
  // Later, when backend is connected, replace this adapter with endpoint calls.
  function read(key, fallback) {
    if (BackendConfig.backendEnabled) {
      // TODO: Replace this with fetch(`${BackendConfig.baseUrl}${BackendConfig.endpointPrefix}/${key}`)
      // Example:
      // return apiRead(key, fallback)
      return fallback;
    }

    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    if (BackendConfig.backendEnabled) {
      // TODO: Replace this with fetch(`${BackendConfig.baseUrl}${BackendConfig.endpointPrefix}/${key}`, { method: 'POST', body: JSON.stringify(value) })
      // Example:
      // return apiWrite(key, value)
      return true;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function apiRead(key, fallback) {
    // Placeholder for future backend.
    return fallback;
  }

  function apiWrite(key, value) {
    // Placeholder for future backend.
    return true;
  }

  function getCurrentUserId() {
    const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe;
    if (tg && tg.user && tg.user.id) return String(tg.user.id);
    return localStorage.getItem('tp_user_id') || 'guest';
  }

  function isAdmin() {
    return getCurrentUserId() === String(ADMIN_ID);
  }

  function ensureSeed() {
    const materials = read(STORAGE.materials, [
      {
        id: 1,
        title: 'Witamy w nowym przeglądzie',
        content: 'Sekcja przegląd została podłączona do panelu administratora.',
        category: 'post',
        media: [],
        tags: ['przegląd', 'start'],
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      }
    ]);

    const tasks = read(STORAGE.tasks, [
      { id: 101, title: 'Sprawdź przegląd', reward: 20, category: 'daily', active: true, completed_by: [] },
      { id: 102, title: 'Wejdź do eventu live', reward: 35, category: 'event', active: true, completed_by: [] }
    ]);

    const notifications = read(STORAGE.notifications, [
      { id: 201, title: 'Witamy', body: 'Panel administratora jest aktywny.', type: 'info', created_at: new Date().toISOString() }
    ]);

    const event = read(STORAGE.event, {
      id: 301,
      title: 'Event Live',
      description: 'Wykonuj zadania i zbieraj gwiazdki.',
      reward: 50,
      duration: 'week',
      active: true
    });

    write(STORAGE.materials, materials);
    write(STORAGE.tasks, tasks);
    write(STORAGE.notifications, notifications);
    write(STORAGE.event, event);
  }

  function injectStyles() {
    if (document.getElementById('tp-admin-core-styles')) return;

    const style = document.createElement('style');
    style.id = 'tp-admin-core-styles';
    style.textContent = `
      .tp-admin-shell { display: grid; gap: 12px; }
      .tp-admin-card {
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        padding: 12px;
      }
      .tp-admin-header {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #a78bfa;
      }
      .tp-admin-input, .tp-admin-textarea, .tp-admin-select {
        width: 100%;
        background: #050b13;
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: #e2e8f0;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        outline: none;
      }
      .tp-admin-btn {
        border: 0;
        border-radius: 12px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        color: white;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .tp-admin-item {
        display: grid;
        gap: 8px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 12px;
        padding: 12px;
      }
      .tp-admin-image { width: 100%; max-height: 180px; object-fit: cover; border-radius: 10px; }
      .tp-admin-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 700;
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.22);
        color: #ddd6fe;
      }
      .tp-admin-meta { font-size: 10px; color: #94a3b8; }
    `;
    document.head.appendChild(style);
  }

  function renderPublicFeed() {
    let feed = document.getElementById('channel-feed') || document.getElementById('posts-feed');
    if (!feed) return;

    const materials = read(STORAGE.materials, []);
    const visible = materials.filter(item => item.public !== false);

    if (!visible.length) {
      feed.innerHTML = '<div class="tp-admin-card"><div class="tp-admin-meta">Brak materiałów publicznych.</div></div>';
      return;
    }

    feed.innerHTML = visible.map(item => {
      const media = Array.isArray(item.media) && item.media.length
        ? item.media.map(src => `<img src="${src}" class="tp-admin-image" alt="${item.title}" />`).join('')
        : '';
      const tags = Array.isArray(item.tags) && item.tags.length
        ? item.tags.map(tag => `<span class="tp-admin-pill" style="margin-right:6px;">${tag}</span>`).join('')
        : '';

      return `
        <div class="tp-admin-item">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size:12px; color:#f8fafc;">${item.title}</strong>
            <span class="tp-admin-pill">${item.category || 'post'}</span>
          </div>
          ${media}
          <div style="font-size:12px; line-height:1.5; color:#e2e8f0;">${item.content || ''}</div>
          <div>${tags}</div>
          <div class="tp-admin-meta">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
        </div>
      `;
    }).join('');
  }

  function renderTasks() {
    let taskList = document.getElementById('task-list');
    if (!taskList) return;

    const tasks = read(STORAGE.tasks, []);
    taskList.innerHTML = tasks.map(task => `
      <div class="tp-admin-card" style="padding:10px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:#f8fafc;">${task.title}</div>
            <div style="font-size:10px; color:#94a3b8;">${task.category || 'general'} • ${task.reward || 0} ★</div>
          </div>
          <button class="tp-admin-btn" style="padding:7px 10px; font-size:10px;">Ukończ</button>
        </div>
      </div>
    `).join('');
  }

  function renderNotifications() {
    let log = document.getElementById('reward-log');
    if (!log) return;

    const notices = read(STORAGE.notifications, []);
    log.innerHTML = notices.map(item => `
      <div class="tp-admin-card" style="padding:10px; margin-bottom:8px;">
        <div style="font-size:11px; font-weight:800; color:#c4b5fd;">${item.title}</div>
        <div style="font-size:11px; color:#e2e8f0; margin-top:4px;">${item.body}</div>
        <div class="tp-admin-meta" style="margin-top:6px;">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
      </div>
    `).join('');
  }

  function renderEvent() {
    const event = read(STORAGE.event, null);
    const titleEl = document.getElementById('live-event-title');
    const descEl = document.getElementById('live-event-desc');
    if (titleEl && event) titleEl.textContent = event.title || 'Brak aktywnego eventu';
    if (descEl && event) descEl.textContent = event.description || 'Brak opisu.';
  }

  function renderAdminPanel() {
    let container = document.getElementById('admin-panel-container');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="tp-admin-shell">
        <div class="tp-admin-card">
          <div class="tp-admin-header">Panel Administratora</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <span class="tp-admin-pill">ID: ${ADMIN_ID}</span>
            <span class="tp-admin-pill">Tryb: ADMIN</span>
          </div>
        </div>

        <div class="tp-admin-card">
          <div class="tp-admin-header">Dodaj materiał</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-title" class="tp-admin-input" placeholder="Tytuł" />
            <textarea id="tp-content" class="tp-admin-textarea" rows="3" placeholder="Treść"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <select id="tp-category" class="tp-admin-input">
                <option value="post">Post</option>
                <option value="image">Zdjęcie</option>
                <option value="file">Plik</option>
                <option value="link">Link</option>
                <option value="info">Info</option>
              </select>
              <input id="tp-media" class="tp-admin-input" placeholder="URL" />
            </div>
            <input id="tp-tags" class="tp-admin-input" placeholder="Tagi (oddziel przecinkami)" />
            <button id="tp-save-material" class="tp-admin-btn" style="width:100%;">Zapisz materiał</button>
          </div>
        </div>

        <div class="tp-admin-card">
          <div class="tp-admin-header">Event Live</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-event-title" class="tp-admin-input" placeholder="Nazwa" />
            <textarea id="tp-event-desc" class="tp-admin-textarea" rows="2" placeholder="Opis"></textarea>
            <input id="tp-event-reward" class="tp-admin-input" type="number" value="50" placeholder="Nagroda" />
            <button id="tp-save-event" class="tp-admin-btn" style="width:100%;">Zapisz event</button>
          </div>
        </div>

        <div class="tp-admin-card">
          <div class="tp-admin-header">Zadania</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-task-title" class="tp-admin-input" placeholder="Nazwa" />
            <input id="tp-task-reward" class="tp-admin-input" type="number" value="25" placeholder="Nagroda" />
            <button id="tp-save-task" class="tp-admin-btn" style="width:100%;">Dodaj</button>
          </div>
        </div>

        <div class="tp-admin-card">
          <div class="tp-admin-header">Powiadomienie</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-notify-title" class="tp-admin-input" placeholder="Tytuł" />
            <textarea id="tp-notify-body" class="tp-admin-textarea" rows="2" placeholder="Treść"></textarea>
            <button id="tp-send-notify" class="tp-admin-btn" style="width:100%;">Wyślij</button>
          </div>
        </div>
      </div>
    `;

    bindAdminEvents();
  }

  function bindAdminEvents() {
    document.getElementById('tp-save-material')?.addEventListener('click', () => {
      const title = document.getElementById('tp-title').value.trim();
      const content = document.getElementById('tp-content').value.trim();
      const category = document.getElementById('tp-category').value || 'post';
      const media = document.getElementById('tp-media').value.trim();
      const tags = document.getElementById('tp-tags').value.split(',').map(t => t.trim()).filter(Boolean);

      if (!title && !content) return;

      const materials = read(STORAGE.materials, []);
      materials.unshift({
        id: Date.now(),
        title: title || 'Nowy materiał',
        content,
        category,
        media: media ? [media] : [],
        tags,
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      });
      write(STORAGE.materials, materials.slice(0, 50));
      renderPublicFeed();
    });

    document.getElementById('tp-save-event')?.addEventListener('click', () => {
      const title = document.getElementById('tp-event-title').value.trim();
      const desc = document.getElementById('tp-event-desc').value.trim();
      const reward = Number(document.getElementById('tp-event-reward').value || 0);
      if (!title || !desc) return;
      write(STORAGE.event, { id: Date.now(), title, description: desc, reward, duration: 'week', active: true });
      renderEvent();
    });

    document.getElementById('tp-save-task')?.addEventListener('click', () => {
      const title = document.getElementById('tp-task-title').value.trim();
      const reward = Number(document.getElementById('tp-task-reward').value || 0);
      if (!title) return;
      const tasks = read(STORAGE.tasks, []);
      tasks.unshift({ id: Date.now(), title, reward, category: 'bonus', active: true, completed_by: [] });
      write(STORAGE.tasks, tasks);
      renderTasks();
    });

    document.getElementById('tp-send-notify')?.addEventListener('click', () => {
      const title = document.getElementById('tp-notify-title').value.trim();
      const body = document.getElementById('tp-notify-body').value.trim();
      if (!title || !body) return;
      const notices = read(STORAGE.notifications, []);
      notices.unshift({ id: Date.now(), title, body, type: 'info', created_at: new Date().toISOString() });
      write(STORAGE.notifications, notices.slice(0, 50));
      renderNotifications();
    });
  }

  function init() {
    ensureSeed();
    injectStyles();
    renderPublicFeed();
    renderTasks();
    renderNotifications();
    renderEvent();

    if (isAdmin()) {
      renderAdminPanel();
    } else {
      const container = document.getElementById('admin-panel-container');
      if (container) container.classList.add('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
