/**
 * Final frontend integration for admin/public content panels.
 * It does not edit index.html. It works as an isolated module.
 */
(function () {
  'use strict';

  const ADMIN_ID = '7777540542';
  const STORAGE = {
    materials: 'tp_final_materials_v2',
    tasks: 'tp_final_tasks_v2',
    notifications: 'tp_final_notifications_v2',
    event: 'tp_final_event_v2',
    stats: 'tp_final_stats_v2'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
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
        content: 'Sekcja przegląd została podłączona do panelu administratora. Tutaj publikowane są materiały publiczne.',
        category: 'post',
        media: [],
        tags: ['przegląd', 'start'],
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Nowy event live',
        content: 'Event bonusowy jest aktywny i można nim zarządzać z poziomu panelu administratora.',
        category: 'image',
        media: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'],
        tags: ['bonus', 'event'],
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      }
    ]);

    const tasks = read(STORAGE.tasks, [
      { id: 101, title: 'Otwórz przegląd', reward: 20, category: 'daily', active: true, completed_by: [] },
      { id: 102, title: 'Wejdź do eventu live', reward: 35, category: 'event', active: true, completed_by: [] },
      { id: 103, title: 'Złóż aktywność bonusową', reward: 45, category: 'special', active: true, completed_by: [] }
    ]);

    const notifications = read(STORAGE.notifications, [
      { id: 201, title: 'Nowe materiały', body: 'Przegląd został zaktualizowany.', type: 'info', created_at: new Date().toISOString() }
    ]);

    const event = read(STORAGE.event, {
      id: 301,
      title: 'Cyber Week',
      description: 'Wykonuj zadania, zbieraj gwiazdki i rozwijaj profil.',
      reward: 50,
      duration: 'week',
      active: true
    });

    write(STORAGE.materials, materials);
    write(STORAGE.tasks, tasks);
    write(STORAGE.notifications, notifications);
    write(STORAGE.event, event);
    write(STORAGE.stats, {
      total_users: 1,
      total_posts: materials.length,
      total_tasks: tasks.length,
      total_events: 1,
      total_notifications: notifications.length,
      total_stars: tasks.reduce((sum, task) => sum + (task.reward || 0), 0)
    });
  }

  function ensureContainer() {
    let box = document.getElementById('admin-panel-container');
    if (!box) {
      box = document.createElement('div');
      box.id = 'admin-panel-container';
      box.className = 'panel';
      box.style.marginTop = '12px';
      document.body.appendChild(box);
    }
    return box;
  }

  function injectStyles() {
    if (document.getElementById('tp-final-admin-style')) return;

    const style = document.createElement('style');
    style.id = 'tp-final-admin-style';
    style.textContent = `
      .tp-final-shell { display: grid; gap: 12px; }
      .tp-final-card {
        background: rgba(15, 23, 42, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        padding: 12px;
      }
      .tp-final-header {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #a78bfa;
      }
      .tp-final-input, .tp-final-textarea, .tp-final-select {
        width: 100%;
        background: #050b13;
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: #e2e8f0;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        outline: none;
      }
      .tp-final-btn {
        border: 0;
        border-radius: 12px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        color: white;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .tp-final-item {
        display: grid;
        gap: 8px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 12px;
        padding: 12px;
      }
      .tp-final-image {
        width: 100%;
        max-height: 180px;
        object-fit: cover;
        border-radius: 10px;
      }
      .tp-final-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 700;
        background: rgba(139,92,246,0.1);
        border: 1px solid rgba(139,92,246,0.22);
        color: #ddd6fe;
      }
      .tp-final-meta { font-size: 10px; color: #94a3b8; }
    `;
    document.head.appendChild(style);
  }

  function renderPublicFeed() {
    let feed = document.getElementById('channel-feed') || document.getElementById('posts-feed');
    if (!feed) {
      feed = document.createElement('div');
      feed.id = 'channel-feed';
      const host = document.getElementById('app-content') || document.body;
      host.appendChild(feed);
    }

    const materials = read(STORAGE.materials, []);
    const visible = materials.filter(item => item.public !== false);

    if (!visible.length) {
      feed.innerHTML = '<div class="tp-final-card"><div class="tp-final-meta">Brak materiałów publicznych.</div></div>';
      return;
    }

    feed.innerHTML = visible.map(item => {
      const media = Array.isArray(item.media) && item.media.length
        ? item.media.map(src => `<img src="${src}" class="tp-final-image" alt="${item.title}" />`).join('')
        : '';
      const tags = Array.isArray(item.tags) && item.tags.length
        ? item.tags.map(tag => `<span class="tp-final-pill" style="margin-right:6px;">${tag}</span>`).join('')
        : '';

      return `
        <div class="tp-final-item">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size:12px; color:#f8fafc;">${item.title}</strong>
            <span class="tp-final-pill">${item.category || 'post'}</span>
          </div>
          ${media}
          <div style="font-size:12px; line-height:1.5; color:#e2e8f0;">${item.content || ''}</div>
          <div>${tags}</div>
          <div class="tp-final-meta">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
        </div>
      `;
    }).join('');
  }

  function renderPublicTasks() {
    let taskList = document.getElementById('task-list');
    if (!taskList) {
      taskList = document.createElement('div');
      taskList.id = 'task-list';
      const host = document.getElementById('app-content') || document.body;
      host.appendChild(taskList);
    }

    const tasks = read(STORAGE.tasks, []);
    taskList.innerHTML = tasks.map(task => `
      <div class="tp-final-card" style="padding:10px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:#f8fafc;">${task.title}</div>
            <div style="font-size:10px; color:#94a3b8;">${task.category || 'general'} • ${task.reward || 0} ★</div>
          </div>
          <button class="tp-final-btn" style="padding:7px 10px; font-size:10px;">Ukończ</button>
        </div>
      </div>
    `).join('');
  }

  function renderNotifications() {
    let log = document.getElementById('reward-log');
    if (!log) {
      log = document.createElement('div');
      log.id = 'reward-log';
      const host = document.getElementById('app-content') || document.body;
      host.appendChild(log);
    }

    const notices = read(STORAGE.notifications, []);
    log.innerHTML = notices.map(item => `
      <div class="tp-final-card" style="padding:10px; margin-bottom:8px;">
        <div style="font-size:11px; font-weight:800; color:#c4b5fd;">${item.title}</div>
        <div style="font-size:11px; color:#e2e8f0; margin-top:4px;">${item.body}</div>
        <div class="tp-final-meta" style="margin-top:6px;">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
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
    const box = ensureContainer();
    box.innerHTML = `
      <div class="tp-final-shell">
        <div class="tp-final-card">
          <div class="tp-final-header">Panel Administratora</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <span class="tp-final-pill">ID: ${ADMIN_ID}</span>
            <span class="tp-final-pill">Tryb: ADMIN</span>
          </div>
        </div>

        <div class="tp-final-card">
          <div class="tp-final-header">Dodaj materiał</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-final-title" class="tp-final-input" placeholder="Tytuł materiału" />
            <textarea id="tp-final-content" class="tp-final-textarea" rows="3" placeholder="Treść materiału"></textarea>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <select id="tp-final-category" class="tp-final-input">
                <option value="post">Post</option>
                <option value="image">Zdjęcie</option>
                <option value="file">Plik</option>
                <option value="link">Link</option>
                <option value="info">Info</option>
              </select>
              <input id="tp-final-media" class="tp-final-input" placeholder="URL zdjęcia / pliku" />
            </div>
            <input id="tp-final-tags" class="tp-final-input" placeholder="Tagi (oddziel przecinkami)" />
            <button id="tp-final-save-material" class="tp-final-btn" style="width:100%;">Zapisz materiał</button>
          </div>
        </div>

        <div class="tp-final-card">
          <div class="tp-final-header">Event Live</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-final-event-title" class="tp-final-input" placeholder="Nazwa eventu" />
            <textarea id="tp-final-event-desc" class="tp-final-textarea" rows="2" placeholder="Opis eventu"></textarea>
            <input id="tp-final-event-reward" class="tp-final-input" type="number" value="50" placeholder="Nagroda" />
            <button id="tp-final-save-event" class="tp-final-btn" style="width:100%;">Zapisz event</button>
          </div>
        </div>

        <div class="tp-final-card">
          <div class="tp-final-header">Zadania bonusowe</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-final-task-title" class="tp-final-input" placeholder="Nazwa zadania" />
            <input id="tp-final-task-reward" class="tp-final-input" type="number" value="25" placeholder="Nagroda" />
            <button id="tp-final-save-task" class="tp-final-btn" style="width:100%;">Dodaj zadanie</button>
          </div>
        </div>

        <div class="tp-final-card">
          <div class="tp-final-header">Powiadomienie</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-final-notify-title" class="tp-final-input" placeholder="Tytuł powiadomienia" />
            <textarea id="tp-final-notify-body" class="tp-final-textarea" rows="2" placeholder="Treść"></textarea>
            <button id="tp-final-send-notify" class="tp-final-btn" style="width:100%;">Wyślij do użytkowników</button>
          </div>
        </div>
      </div>
    `;

    bindAdminActions();
  }

  function bindAdminActions() {
    const saveMaterial = document.getElementById('tp-final-save-material');
    if (saveMaterial) {
      saveMaterial.addEventListener('click', () => {
        const title = document.getElementById('tp-final-title').value.trim();
        const content = document.getElementById('tp-final-content').value.trim();
        const category = document.getElementById('tp-final-category').value || 'post';
        const mediaValue = document.getElementById('tp-final-media').value.trim();
        const tags = document.getElementById('tp-final-tags').value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);

        if (!title && !content) return;

        const current = read(STORAGE.materials, []);
        current.unshift({
          id: Date.now(),
          title: title || 'Nowy materiał',
          content,
          category,
          media: mediaValue ? [mediaValue] : [],
          tags,
          author: 'Administrator',
          public: true,
          created_at: new Date().toISOString()
        });

        write(STORAGE.materials, current.slice(0, 50));
        renderPublicFeed();
      });
    }

    const saveEvent = document.getElementById('tp-final-save-event');
    if (saveEvent) {
      saveEvent.addEventListener('click', () => {
        const title = document.getElementById('tp-final-event-title').value.trim();
        const description = document.getElementById('tp-final-event-desc').value.trim();
        const reward = Number(document.getElementById('tp-final-event-reward').value || 0);
        if (!title || !description) return;

        write(STORAGE.event, {
          id: Date.now(),
          title,
          description,
          reward,
          duration: 'week',
          active: true
        });
        renderEvent();
      });
    }

    const saveTask = document.getElementById('tp-final-save-task');
    if (saveTask) {
      saveTask.addEventListener('click', () => {
        const title = document.getElementById('tp-final-task-title').value.trim();
        const reward = Number(document.getElementById('tp-final-task-reward').value || 0);
        if (!title) return;

        const tasks = read(STORAGE.tasks, []);
        tasks.unshift({ id: Date.now(), title, reward, category: 'bonus', active: true, completed_by: [] });
        write(STORAGE.tasks, tasks);
        renderPublicTasks();
      });
    }

    const sendNotify = document.getElementById('tp-final-send-notify');
    if (sendNotify) {
      sendNotify.addEventListener('click', () => {
        const title = document.getElementById('tp-final-notify-title').value.trim();
        const body = document.getElementById('tp-final-notify-body').value.trim();
        if (!title || !body) return;

        const notices = read(STORAGE.notifications, []);
        notices.unshift({ id: Date.now(), title, body, type: 'info', created_at: new Date().toISOString() });
        write(STORAGE.notifications, notices.slice(0, 50));
        renderNotifications();
      });
    }
  }

  function init() {
    ensureSeed();
    injectStyles();
    renderPublicFeed();
    renderPublicTasks();
    renderNotifications();
    renderEvent();

    if (isAdmin()) {
      renderAdminPanel();
    } else {
      const box = ensureContainer();
      box.classList.add('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
