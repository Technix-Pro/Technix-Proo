/**
 * Pakiet 3: Rozbudowa kategorii materiałów w sekcji Przegląd
 * Public materials for users / admin management for admin
 * No change to index.html
 */
(function () {
  'use strict';

  const ADMIN_ID = (window.TECHNIX_CONFIG && window.TECHNIX_CONFIG.ADMIN_IDS && window.TECHNIX_CONFIG.ADMIN_IDS[0]) || '';

  const STORAGE_KEYS = {
    materials: 'tp_materials_catalog',
    notifications: 'tp_materials_notifications',
    tasks: 'tp_materials_tasks',
    event: 'tp_materials_event'
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
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
    const tgUser = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user;
    if (tgUser && tgUser.id) return String(tgUser.id);
    return localStorage.getItem('tp_user_id') || 'guest';
  }

  function isAdmin() {
    return currentUserId() === String(ADMIN_ID);
  }

  function ensureSeed() {
    const materials = read(STORAGE_KEYS.materials, [
      {
        id: 1,
        title: 'Witamy w przeglądzie',
        content: 'To jest publiczny materiał dostępny dla wszystkich użytkowników. Tutaj administrator dodaje wpisy, zdjęcia i pliki.',
        category: 'post',
        media: [],
        tags: ['witaj', 'przegląd'],
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Nowa kampania bonusowa',
        content: 'Nowe zadania są aktywne oraz event live jest dostępny w zakładce Bonusy.',
        category: 'image',
        media: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80'],
        tags: ['bonus', 'event'],
        author: 'Administrator',
        public: true,
        created_at: new Date().toISOString()
      }
    ]);

    if (!read(STORAGE_KEYS.tasks, null)) {
      write(STORAGE_KEYS.tasks, [
        { id: 101, title: 'Sprawdź przegląd', reward: 20, category: 'daily', active: true, completed_by: [] },
        { id: 102, title: 'Wejdź na event live', reward: 35, category: 'event', active: true, completed_by: [] },
        { id: 103, title: 'Odbierz bonus', reward: 45, category: 'special', active: true, completed_by: [] }
      ]);
    }

    if (!read(STORAGE_KEYS.notifications, null)) {
      write(STORAGE_KEYS.notifications, [
        { id: 201, title: 'Nowe materiały', body: 'Przegląd został zaktualizowany.', type: 'info', created_at: new Date().toISOString() }
      ]);
    }

    if (!read(STORAGE_KEYS.event, null)) {
      write(STORAGE_KEYS.event, {
        id: 301,
        title: 'Cyber Week',
        description: 'Wykonuj zadania i zbieraj gwiazdki.',
        reward: 50,
        duration: 'week',
        active: true
      });
    }

    write(STORAGE_KEYS.materials, materials);
  }

  function renderStyles() {
    if (document.getElementById('tp-materials-styles')) return;

    const style = document.createElement('style');
    style.id = 'tp-materials-styles';
    style.textContent = `
      .tp-material-shell { display: grid; gap: 12px; }
      .tp-material-card {
        background: rgba(15,23,42,0.82);
        border: 1px solid rgba(148,163,184,0.18);
        border-radius: 14px;
        padding: 12px;
      }
      .tp-material-header {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #a78bfa;
      }
      .tp-material-grid {
        display: grid;
        gap: 10px;
      }
      .tp-material-input,
      .tp-material-textarea,
      .tp-material-select {
        width: 100%;
        background: #050b13;
        border: 1px solid rgba(148,163,184,0.25);
        color: #e2e8f0;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        outline: none;
      }
      .tp-material-btn {
        border: none;
        border-radius: 12px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        color: #fff;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
      }
      .tp-material-item {
        background: rgba(15,23,42,0.8);
        border: 1px solid rgba(148,163,184,0.16);
        border-radius: 12px;
        padding: 12px;
        display: grid;
        gap: 8px;
      }
      .tp-material-topic {
        display: inline-flex;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 700;
        background: rgba(139,92,246,0.12);
        color: #ddd6fe;
        border: 1px solid rgba(139,92,246,0.25);
      }
      .tp-material-media {
        width: 100%;
        max-height: 180px;
        object-fit: cover;
        border-radius: 10px;
      }
      .tp-material-meta {
        font-size: 10px;
        color: #94a3b8;
      }
      .tp-material-chip {
        display: inline-flex;
        gap: 6px;
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(34,211,238,0.12);
        border: 1px solid rgba(34,211,238,0.22);
        color: #a5f3fc;
        font-size: 9px;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  function renderAdminControls() {
    const container = document.getElementById('admin-panel-container');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="tp-material-shell">
        <div class="tp-material-card">
          <div class="tp-material-header">Materialy i kategorie</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <span class="tp-material-chip">ID: ${ADMIN_ID}</span>
            <span class="tp-material-chip">Tryb: ADMIN</span>
          </div>
        </div>

        <div class="tp-material-card">
          <div class="tp-material-header">Dodaj nowy materiał</div>
          <div style="display:grid; gap:10px; margin-top:12px;">
            <input id="tp-new-material-title" class="tp-material-input" placeholder="Tytuł materiału" />
            <textarea id="tp-new-material-content" class="tp-material-textarea" rows="3" placeholder="Treść materiału / opis"></textarea>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <select id="tp-new-material-category" class="tp-material-select">
                <option value="post">Post</option>
                <option value="image">Zdjęcie</option>
                <option value="file">Plik</option>
                <option value="link">Link</option>
                <option value="info">Info</option>
              </select>
              <input id="tp-new-material-media" class="tp-material-input" placeholder="URL zdjęcia / pliku" />
            </div>
            <input id="tp-new-material-tags" class="tp-material-input" placeholder="Tagi (oddziel przecinkami)" />
            <button id="tp-save-material" class="tp-material-btn" style="width:100%;">Zapisz materiał</button>
          </div>
        </div>

        <div class="tp-material-card">
          <div class="tp-material-header">Active materials</div>
          <div id="tp-admin-material-list" style="display:grid; gap:10px; margin-top:12px;"></div>
        </div>
      </div>
    `;

    bindAdminMaterialActions();
  }

  function renderPublicMaterials() {
    const feed = document.getElementById('channel-feed') || document.getElementById('posts-feed');
    if (!feed) return;

    const materials = read(STORAGE_KEYS.materials, []);
    const visibleItems = materials.filter(item => item.public !== false);

    if (!visibleItems.length) {
      feed.innerHTML = '<div class="tp-material-card"><div class="tp-material-meta">Brak materiałów publicznych.</div></div>';
      return;
    }

    feed.innerHTML = visibleItems.map(item => {
      const media = Array.isArray(item.media) && item.media.length ? item.media.map(src => `<img src="${src}" class="tp-material-media" alt="${item.title}" />`).join('') : '';
      const tags = Array.isArray(item.tags) ? item.tags.map(tag => `<span class="tp-material-chip" style="margin-right:6px;">${tag}</span>`).join('') : '';

      return `
        <div class="tp-material-item">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <strong style="font-size: 12px; color: #f8fafc;">${item.title}</strong>
            <span class="tp-material-topic">${item.category || 'post'}</span>
          </div>
          ${media}
          <div style="font-size: 12px; color: #e2e8f0; line-height: 1.5;">${item.content || ''}</div>
          <div>${tags}</div>
          <div class="tp-material-meta">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
        </div>
      `;
    }).join('');
  }

  function renderAdminMaterials() {
    const list = document.getElementById('tp-admin-material-list');
    if (!list) return;

    const materials = read(STORAGE_KEYS.materials, []);
    list.innerHTML = materials.map(item => `
      <div class="tp-material-item">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="font-size:12px; color:#f8fafc;">${item.title}</strong>
          <span class="tp-material-topic">${item.category}</span>
        </div>
        <div style="font-size:11px; color:#e2e8f0;">${item.content || ''}</div>
        <div class="tp-material-meta">${new Date(item.created_at || Date.now()).toLocaleString('pl-PL')}</div>
      </div>
    `).join('');
  }

  function bindAdminMaterialActions() {
    const saveBtn = document.getElementById('tp-save-material');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const title = document.getElementById('tp-new-material-title').value.trim();
        const content = document.getElementById('tp-new-material-content').value.trim();
        const category = document.getElementById('tp-new-material-category').value || 'post';
        const media = document.getElementById('tp-new-material-media').value.trim();
        const tags = document.getElementById('tp-new-material-tags').value
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);

        if (!title && !content) return;

        const materials = read(STORAGE_KEYS.materials, []);
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

        write(STORAGE_KEYS.materials, materials.slice(0, 50));
        renderPublicMaterials();
        renderAdminMaterials();

        document.getElementById('tp-new-material-title').value = '';
        document.getElementById('tp-new-material-content').value = '';
        document.getElementById('tp-new-material-media').value = '';
        document.getElementById('tp-new-material-tags').value = '';
      });
    }
  }

  function init() {
    ensureSeed();
    renderStyles();
    renderPublicMaterials();

    if (isAdmin()) {
      renderAdminControls();
      renderAdminMaterials();
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
