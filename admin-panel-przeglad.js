/**
 * Pack 2: Panel Przegląd + publiczny widok materiałów
 * Works with existing index.html without editing the original file.
 */
(function () {
  'use strict';

  const ADMIN_ID = (window.TECHNIX_CONFIG && window.TECHNIX_CONFIG.ADMIN_IDS && window.TECHNIX_CONFIG.ADMIN_IDS[0]) || '';
  const KEY = {
    posts: 'tp_public_materials',
    tasks: 'tp_bonus_tasks',
    notifications: 'tp_notifications_feed',
    event: 'tp_active_event',
    stats: 'tp_stats_snapshot'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function currentUserId() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
      return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }

    const stored = localStorage.getItem('tp_user_id');
    if (stored) return String(stored);

    return 'guest';
  }

  function isAdmin() {
    return currentUserId() === String(ADMIN_ID);
  }

  function ensureDefaults() {
    const posts = read(KEY.posts, [
      {
        id: 1,
        title: 'Witamy w nowym przeglądzie',
        content: 'Nowy przegląd jest dostępny dla wszystkich użytkowników. Tutaj pojawiają się materiały publikowane przez administratora.',
        author: 'Administrator',
        type: 'post',
        media: [],
        visible: true,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Premiera bonusów',
        content: 'Sprawdź najnowsze zadania bonusowe i event live dostępne w zakładce Bonusy.',
        author: 'Administrator',
        type: 'post',
        media: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'],
        visible: true,
        created_at: new Date().toISOString()
      }
    ]);

    if (!read(KEY.tasks, null)) {
      write(KEY.tasks, [
        { id: 101, title: 'Sprawdź przegląd', reward: 20, completed_by: [], category: 'daily', active: true },
        { id: 102, title: 'Wejdź do eventu live', reward: 35, completed_by: [], category: 'event', active: true },
        { id: 103, title: 'Zobacz nowy bonus', reward: 45, completed_by: [], category: 'special', active: true }
      ]);
    }

    if (!read(KEY.notifications, null)) {
      write(KEY.notifications, [
        { id: 201, title: 'Nowy materiał', body: 'Przegląd został zaktualizowany.', type: 'info', created_at: new Date().toISOString() }
      ]);
    }

    if (!read(KEY.event, null)) {
      write(KEY.event, {
        id: 301,
        title: 'Cyber Week — Community Sprint',
        description: 'Zbieraj gwiazdki, wykonuj zadania i odblokuj limitowaną nagrodę.',
        reward: 50,
        duration: 'week',
        active: true
      });
    }

    write(KEY.posts, posts);
    write(KEY.stats, {
      total_users: 1,
      total_posts: posts.length,
      total_tasks: read(KEY.tasks, []).length,
      total_events: 1,
      total_notifications: read(KEY.notifications, []).length,
      total_stars: 0
    });
  }

  function renderStyles() {
    if (document.getElementById('tp-przeglad-styles')) return;

    const style = document.createElement('style');
    style.id = 'tp-przeglad-styles';
    style.textContent = `
      .tp-przeglad-shell {
        display: grid;
        gap: 12px;
      }
      .tp-przeglad-card {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 14px;
        padding: 12px;
      }
      .tp-przeglad-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #a78bfa;
      }
      .tp-przeglad-post {
        display: grid;
        gap: 8px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        padding: 12px;
      }
      .tp-przeglad-input,
      .tp-przeglad-textarea {
        width: 100%;
        background: #050b13;
        color: #e2e8f0;
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        outline: none;
      }
      .tp-przeglad-btn {
        border: none;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 11px;
        font-weight: 800;
        color: white;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        cursor: pointer;
      }
      .tp-przeglad-micro {
        font-size: 10px;
        color: #94a3b8;
      }
      .tp-przeglad-media {
        width: 100%;
        border-radius: 10px;
        max-height: 180px;
        object-fit: cover;
      }
      .tp-przeglad-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        font-size: 9px;
        font-weight: 700;
        border-radius: 999px;
      }
    `;
    document.head.appendChild(style);
  }

  function renderPublicOverview() {
    const feed = document.getElementById('channel-feed') || document.getElementById('posts-feed');
    if (!feed) return;

    const posts = read(KEY.posts, []);
    if (!posts.length) {
      feed.innerHTML = '<div class="tp-przeglad-card"><div class="tp-przeglad-micro">Brak materiałów do wyświetlenia.</div></div>';
      return;
    }

    feed.innerHTML = posts.map(post => {
      const media = Array.isArray(post.media) && post.media.length
        ? `<img src="${post.media[0]}" class="tp-przeglad-media" alt="${post.title || 'content'}" />`
        : '';

      return `
        <div class="tp-przeglad-post">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size: 12px; color: #f8fafc;">${post.title || 'Nowy materiał'}</strong>
            <span class="tp-przeglad-pill" style="background: rgba(139, 92, 246, 0.12); color: #ddd6fe; border: 1px solid rgba(139, 92, 246, 0.25);">${post.author || 'System'}</span>
          </div>
          ${media}
          <div style="font-size: 12px; line-height: 1.5; color: #e2e8f0;">${post.content || ''}</div>
          <div class="tp-przeglad-micro">${new Date(post.created_at || Date.now()).toLocaleString('pl-PL')}</div>
        </div>
      `;
    }).join('');
  }

  function renderLiveEventWidget() {
    const event = read(KEY.event, null);
    const titleEl = document.getElementById('live-event-title');
    const descEl = document.getElementById('live-event-desc');

    if (titleEl && event) {
      titleEl.textContent = event.title || 'Brak aktywnego eventu';
    }

    if (descEl && event) {
      descEl.textContent = event.description || 'Brak opisu.';
    }
  }

  function renderTaskList() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const tasks = read(KEY.tasks, []);
    taskList.innerHTML = tasks.map(task => `
      <div class="tp-przeglad-card" style="padding: 10px; margin-bottom: 8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #f8fafc;">${task.title}</div>
            <div style="font-size: 10px; color: #94a3b8;">${task.category || 'general'} • ${task.reward || 0} ★</div>
          </div>
          <button class='tp-przeglad-btn' style='padding: 7px 10px; font-size: 10px;'>Ukończ</button>
        </div>
      </div>
    `).join('');
  }

  function renderNotificationsFeed() {
    const log = document.getElementById('reward-log');
    if (!log) return;

    const items = read(KEY.notifications, []);
    log.innerHTML = items.map(item => `
      <div class="tp-przeglad-card" style="padding: 10px; margin-bottom: 8px;">
        <div style="font-size: 11px; font-weight: 800; color: #c4b5fd;">${item.title}</div>
        <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px;">${item.body}</div>
        <div class="tp-przeglad-micro" style="margin-top: 6px;">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
      </div>
    `).join('');
  }

  function renderAdminOverview() {
    const container = document.getElementById('admin-panel-container');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="tp-przeglad-shell">
        <div class="tp-przeglad-card">
          <div class="tp-przeglad-title">Panel Administratora</div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap: wrap; margin-top: 10px;">
            <span class="tp-przeglad-pill" style="background: rgba(139, 92, 246, 0.12); color: #ddd6fe; border: 1px solid rgba(139, 92, 246, 0.25);">ID: ${ADMIN_ID}</span>
            <span class="tp-przeglad-pill" style="background: rgba(34, 211, 238, 0.12); color: #a5f3fc; border: 1px solid rgba(34, 211, 238, 0.25);">Tryb: ADMIN</span>
          </div>
        </div>

        <div class="tp-przeglad-card">
          <div class="tp-przeglad-title">Nowy wpis do przeglądu</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-admin-post-title" class="tp-przeglad-input" placeholder="Tytuł" />
            <textarea id="tp-admin-post-content" class="tp-przeglad-textarea" rows="3" placeholder="Treść materiału"></textarea>
            <input id="tp-admin-post-media" class="tp-przeglad-input" placeholder="Link do zdjęcia / pliku (opcjonalnie)" />
            <button id="tp-admin-publish" class="tp-przeglad-btn" style="width:100%;">Opublikuj materiał</button>
          </div>
        </div>

        <div class="tp-przeglad-card">
          <div class="tp-przeglad-title">Event Live</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-admin-event-title" class="tp-przeglad-input" placeholder="Nazwa eventu" />
            <textarea id="tp-admin-event-desc" class="tp-przeglad-textarea" rows="2" placeholder="Opis eventu"></textarea>
            <input id="tp-admin-event-reward" class="tp-przeglad-input" type="number" value="50" placeholder="Nagroda" />
            <button id="tp-admin-save-event" class="tp-przeglad-btn" style="width:100%;">Zapisz event</button>
          </div>
        </div>

        <div class="tp-przeglad-card">
          <div class="tp-przeglad-title">Zadania bonusowe</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-admin-task-title" class="tp-przeglad-input" placeholder="Nazwa zadania" />
            <input id="tp-admin-task-reward" class="tp-przeglad-input" type="number" value="25" placeholder="Nagroda" />
            <button id="tp-admin-add-task" class="tp-przeglad-btn" style="width:100%;">Dodaj zadanie</button>
          </div>
        </div>

        <div class="tp-przeglad-card">
          <div class="tp-przeglad-title">Powiadomienie</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-admin-notify-title" class="tp-przeglad-input" placeholder="Tytuł powiadomienia" />
            <textarea id="tp-admin-notify-body" class="tp-przeglad-textarea" rows="2" placeholder="Treść"></textarea>
            <button id="tp-admin-send-notify" class="tp-przeglad-btn" style="width:100%;">Wyślij do użytkowników</button>
          </div>
        </div>
      </div>
    `;

    bindAdminActions();
  }

  function bindAdminActions() {
    const publishBtn = document.getElementById('tp-admin-publish');
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        const title = document.getElementById('tp-admin-post-title').value.trim();
        const content = document.getElementById('tp-admin-post-content').value.trim();
        const mediaRaw = document.getElementById('tp-admin-post-media').value.trim();
        const media = mediaRaw ? mediaRaw.split(',').map(item => item.trim()).filter(Boolean) : [];

        if (!title && !content) return;

        const posts = read(KEY.posts, []);
        posts.unshift({
          id: Date.now(),
          title: title || 'Nowy materiał',
          content,
          author: 'Administrator',
          type: 'post',
          media,
          visible: true,
          created_at: new Date().toISOString()
        });

        write(KEY.posts, posts.slice(0, 50));
        renderPublicOverview();
        document.getElementById('tp-admin-post-title').value = '';
        document.getElementById('tp-admin-post-content').value = '';
        document.getElementById('tp-admin-post-media').value = '';
      });
    }

    const saveEventBtn = document.getElementById('tp-admin-save-event');
    if (saveEventBtn) {
      saveEventBtn.addEventListener('click', () => {
        const title = document.getElementById('tp-admin-event-title').value.trim();
        const description = document.getElementById('tp-admin-event-desc').value.trim();
        const reward = Number(document.getElementById('tp-admin-event-reward').value || 0);

        if (!title || !description) return;

        write(KEY.event, {
          id: Date.now(),
          title,
          description,
          reward,
          duration: 'week',
          active: true
        });

        renderLiveEventWidget();
      });
    }

    const addTaskBtn = document.getElementById('tp-admin-add-task');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        const title = document.getElementById('tp-admin-task-title').value.trim();
        const reward = Number(document.getElementById('tp-admin-task-reward').value || 0);

        if (!title) return;

        const tasks = read(KEY.tasks, []);
        tasks.unshift({
          id: Date.now(),
          title,
          reward,
          category: 'bonus',
          completed_by: [],
          active: true
        });

        write(KEY.tasks, tasks);
        renderTaskList();
        document.getElementById('tp-admin-task-title').value = '';
        document.getElementById('tp-admin-task-reward').value = '25';
      });
    }

    const sendNotifyBtn = document.getElementById('tp-admin-send-notify');
    if (sendNotifyBtn) {
      sendNotifyBtn.addEventListener('click', () => {
        const title = document.getElementById('tp-admin-notify-title').value.trim();
        const body = document.getElementById('tp-admin-notify-body').value.trim();

        if (!title || !body) return;

        const notifications = read(KEY.notifications, []);
        notifications.unshift({
          id: Date.now(),
          title,
          body,
          type: 'info',
          created_at: new Date().toISOString()
        });

        write(KEY.notifications, notifications);
        renderNotificationsFeed();
        document.getElementById('tp-admin-notify-title').value = '';
        document.getElementById('tp-admin-notify-body').value = '';
      });
    }
  }

  function init() {
    ensureDefaults();
    renderStyles();

    renderPublicOverview();
    renderLiveEventWidget();
    renderTaskList();
    renderNotificationsFeed();

    if (isAdmin()) {
      renderAdminOverview();
    } else {
      const adminBox = document.getElementById('admin-panel-container');
      if (adminBox) {
        adminBox.classList.add('hidden');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
