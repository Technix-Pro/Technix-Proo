(function () {
  const featureNames = {
    clicker: 'Clicker / mining', rigBuilder: 'RIG Builder', wallet: 'Portfel',
    referrals: 'Referral', leaderboard: 'Ranking', dailyBonus: 'Bonus dzienny',
    tasks: 'Zadania', events: 'Eventy Live', posts: 'Kanał / posty',
    notifications: 'Powiadomienia'
  };
  const animationNames = {
    tokens: 'Latające tokeny', circuitPulse: 'Puls obwodu', chipPulse: 'Puls chipu',
    partGlow: 'Poświata części RIG', toastFx: 'Animacja toastów', reduceMotion: 'Reduce motion'
  };
  const phaseDefaults = {
    1: { clicker: true, rigBuilder: true, wallet: false, referrals: false, leaderboard: false, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true },
    2: { clicker: true, rigBuilder: true, wallet: false, referrals: true, leaderboard: true, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true },
    3: { clicker: true, rigBuilder: true, wallet: true, referrals: true, leaderboard: true, dailyBonus: true, tasks: true, events: true, posts: true, notifications: true }
  };
  let authorized = false;
  let adminMode = false;
  let previewMode = false;
  let root;
  let overviewButton;
  let previewBar;
  let onConfigChange = () => {};
  let activeTab = 'dashboard';

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function button(text, action, className) {
    const element = node('button', className || 'admin-button', text);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  }

  function panel(title) {
    const section = node('section', 'panel admin-card');
    if (title) section.append(node('h3', 'admin-card-title', title));
    return section;
  }

  function getDraft() {
    return window.TechnixStore.getDraft();
  }

  function saveDraft(config, message) {
    window.TechnixStore.save(config).then(() => {
      if (previewMode) onConfigChange(config, true);
      render();
      toast(message || 'Zmiany zapisano w wersji roboczej.');
    }).catch(error => toast(error.message));
  }

  function toast(message) {
    const target = document.getElementById('toast');
    if (!target) return;
    target.textContent = message;
    target.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => target.classList.remove('show'), 1900);
  }

  function isAuthorized(userId) {
    const config = window.TECHNIX_CONFIG;
    const numericId = Number(userId);
    return (Array.isArray(config.ADMIN_IDS) && config.ADMIN_IDS.some(id => Number(id) === numericId && numericId > 0))
      || (config.DEV_MODE === true && new URLSearchParams(window.location.search).get('admin') === '1');
  }

  function makeOverviewButton() {
    overviewButton = button('Panel administratora', () => enterAdmin(), 'admin-entry');
    const overview = document.getElementById('reward-overview');
    if (overview) overview.prepend(overviewButton);
  }

  function initialize(callback, userId) {
    authorized = isAuthorized(userId);
    if (!authorized) return false;
    onConfigChange = callback;
    makeOverviewButton();
    createAdminRoot();
    return true;
  }

  function createAdminRoot() {
    const main = document.querySelector('main');
    root = node('section', 'admin-root hidden');
    root.setAttribute('aria-label', 'Panel administratora');
    main.insertBefore(root, document.getElementById('app-content'));
    previewBar = node('div', 'preview-bar hidden', 'PODGLĄD UŻYTKOWNIKA — konfiguracja robocza');
    const returnButton = button('Wróć do panelu admina', () => enterAdmin(), 'admin-button admin-return');
    previewBar.append(returnButton);
    main.insertBefore(previewBar, document.getElementById('app-content'));
  }

  function enterAdmin() {
    if (!authorized) return;
    adminMode = true;
    previewMode = false;
    root.classList.remove('hidden');
    previewBar.classList.add('hidden');
    document.getElementById('app-content').classList.add('hidden');
    document.querySelector('nav').classList.add('hidden');
    render();
  }

  function exitAdmin() {
    adminMode = false;
    previewMode = false;
    root.classList.add('hidden');
    previewBar.classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.querySelector('nav').classList.remove('hidden');
    onConfigChange(window.TechnixStore.getPublished(), false);
    toast('Powrócono do widoku użytkownika.');
  }

  function showPreview() {
    if (!authorized) return;
    adminMode = false;
    previewMode = true;
    root.classList.add('hidden');
    previewBar.classList.remove('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.querySelector('nav').classList.remove('hidden');
    onConfigChange(getDraft(), true);
    toast('Podgląd pokazuje wersję roboczą — widoczną tylko dla administratora.');
  }

  function header() {
    const bar = node('div', 'admin-toolbar');
    const title = node('div', 'admin-toolbar-title');
    title.append(node('strong', '', 'TRYB ADMINA'), node('span', '', 'Zmiany są robocze do czasu publikacji.'));
    const actions = node('div', 'admin-toolbar-actions');
    actions.append(
      button('Podgląd użytkownika', showPreview),
      button('Opublikuj', publish),
      button('Wyjdź', exitAdmin, 'admin-button admin-button-muted')
    );
    bar.append(title, actions);
    return bar;
  }

  function publish() {
    if (!window.confirm('Opublikować wersję roboczą dla użytkowników?')) return;
    window.TechnixStore.publish().then(config => {
      if (previewMode) onConfigChange(config, true);
      render();
      toast('Opublikowano konfigurację.');
    }).catch(error => toast(error.message));
  }

  function render() {
    if (!root || !adminMode) return;
    root.replaceChildren(header());
    const nav = node('div', 'admin-tabs');
    const tabs = [
      ['dashboard', 'Dashboard'], ['phases', 'Fazy'], ['features', 'Funkcje'],
      ['animations', 'Animacje'], ['tasks', 'Zadania'], ['events', 'Eventy'],
      ['posts', 'Posty / Kanał'], ['notifications', 'Powiadomienia'],
      ['status', 'Status'], ['presets', 'Presety'], ['data', 'Import / statystyki']
    ];
    tabs.forEach(([id, label]) => {
      nav.append(button(label, () => { activeTab = id; render(); }, `admin-tab${activeTab === id ? ' active' : ''}`));
    });
    root.append(nav);
    const content = node('div', 'admin-content');
    root.append(content);
    const config = getDraft();
    if (activeTab === 'dashboard') renderDashboard(content, config);
    if (activeTab === 'phases') renderPhases(content, config);
    if (activeTab === 'features') renderToggles(content, config, 'features', featureNames, 'Funkcje aplikacji');
    if (activeTab === 'animations') renderToggles(content, config, 'animations', animationNames, 'Animacje i dostępność');
    if (activeTab === 'tasks') renderCollection(content, 'tasks', config.tasks, taskFields, 'Zadania');
    if (activeTab === 'events') renderCollection(content, 'events', config.events, eventFields, 'Eventy Live');
    if (activeTab === 'posts') renderCollection(content, 'posts', config.posts, postFields, 'Posty / Kanał');
    if (activeTab === 'notifications') renderCollection(content, 'notifications', config.notifications, notificationFields, 'Powiadomienia');
    if (activeTab === 'status') renderStatus(content, config);
    if (activeTab === 'presets') renderPresets(content, config);
    if (activeTab === 'data') renderData(content, config);
  }

  function renderDashboard(target, config) {
    const card = panel('Stan aplikacji');
    const stats = node('div', 'admin-stats');
    const hasDraftChanges = JSON.stringify(config) !== JSON.stringify(window.TechnixStore.getPublished());
    [
      [`Aktywna faza`, `${config.activePhase} / 3`],
      ['Aktywne zadania', String(config.tasks.filter(item => item.active !== false).length)],
      ['Aktywne eventy', String(config.events.filter(item => item.active !== false).length)],
      ['Status konfiguracji', hasDraftChanges ? 'Draft · zmiany' : `Published · v${config.version}`]
    ].forEach(([label, value]) => {
      const stat = node('div', 'admin-stat');
      stat.append(node('span', '', label), node('strong', '', value));
      stats.append(stat);
    });
    card.append(stats);
    const actions = node('div', 'admin-actions');
    actions.append(button('Podgląd wersji roboczej', showPreview), button('Odrzuć zmiany', rejectDraft, 'admin-button admin-button-muted'), button('Cofnij publikację', rollback, 'admin-button admin-button-muted'));
    card.append(actions, node('p', 'admin-note', 'Zmiany zapisują się lokalnie jako draft. Użytkownicy widzą wyłącznie opublikowaną konfigurację.'));
    target.append(card);
  }

  function renderPhases(target, config) {
    const card = panel('Fazy projektu');
    card.append(node('p', 'admin-note', 'Zastosowanie fazy ustawia domyślne flagi funkcji w wersji roboczej. Możesz je później zmienić osobno.'));
    [1, 2, 3].forEach(phase => {
      const descriptions = ['Stealth — podstawowy clicker i zadania.', 'Rozszerzenie — społeczność, referral i ranking.', 'Launch — pełny zestaw funkcji, w tym portfel.'];
      const row = node('div', 'admin-list-row');
      row.append(node('div', 'admin-list-copy', `Faza ${phase} · ${descriptions[phase - 1]}`));
      row.append(button(config.activePhase === phase ? 'Aktywna' : 'Zastosuj ustawienia fazy', () => {
        const next = getDraft();
        next.activePhase = phase;
        next.features = { ...phaseDefaults[phase] };
        saveDraft(next, `Ustawiono draft fazy ${phase}.`);
      }));
      card.append(row);
    });
    target.append(card);
  }

  function renderToggles(target, config, key, labels, title) {
    const card = panel(title);
    Object.entries(labels).forEach(([id, label]) => {
      const row = node('label', 'admin-toggle-row');
      const checkbox = node('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(config[key][id]);
      checkbox.addEventListener('change', () => {
        const next = getDraft();
        next[key][id] = checkbox.checked;
        saveDraft(next);
      });
      row.append(node('span', '', label), checkbox);
      card.append(row);
    });
    target.append(card);
  }

  const taskFields = [
    { key: 'title', label: 'Nazwa zadania', required: true },
    { key: 'reward', label: 'Nagroda ★', type: 'number', min: 0, required: true },
    { key: 'label', label: 'Etykieta', value: 'Zadanie' },
    { key: 'type', label: 'Typ', value: 'social' },
    { key: 'order', label: 'Kolejność', type: 'number', min: 0, value: 1 },
    { key: 'active', label: 'Aktywne', type: 'checkbox', value: true }
  ];
  const eventFields = [
    { key: 'title', label: 'Tytuł', required: true },
    { key: 'desc', label: 'Opis', type: 'textarea' },
    { key: 'reward', label: 'Nagroda ★', type: 'number', min: 0, required: true },
    { key: 'startAt', label: 'Start', type: 'datetime-local' },
    { key: 'endAt', label: 'Koniec', type: 'datetime-local' },
    { key: 'active', label: 'Aktywny', type: 'checkbox', value: true }
  ];
  const postFields = [
    { key: 'text', label: 'Treść posta', type: 'textarea', required: true },
    { key: 'media', label: 'URL grafiki', type: 'url' },
    { key: 'link', label: 'Link docelowy', type: 'url' },
    { key: 'pinned', label: 'Przypięty', type: 'checkbox' },
    { key: 'visible', label: 'Widoczny', type: 'checkbox', value: true }
  ];
  const notificationFields = [
    { key: 'title', label: 'Tytuł', required: true },
    { key: 'text', label: 'Treść', type: 'textarea', required: true },
    { key: 'audience', label: 'Odbiorcy (all / phase-1 / phase-2 / phase-3)', value: 'all' },
    { key: 'scheduledAt', label: 'Zaplanowano', type: 'datetime-local' },
    { key: 'sent', label: 'Wysłane', type: 'checkbox' }
  ];

  function inputField(definition, value) {
    const label = node('label', 'admin-field');
    label.append(node('span', '', definition.label));
    const field = node(definition.type === 'textarea' ? 'textarea' : 'input', 'admin-input');
    if (definition.type !== 'textarea') field.type = definition.type || 'text';
    if (definition.type === 'checkbox') field.checked = value === undefined ? Boolean(definition.value) : Boolean(value);
    else field.value = value === undefined ? (definition.value || '') : value;
    if (definition.min !== undefined) field.min = String(definition.min);
    if (definition.required) field.required = true;
    label.append(field);
    return { label, field };
  }

  function renderCollection(target, name, records, fields, title) {
    const card = panel(`${title} — edycja draftu`);
    const form = node('form', 'admin-form');
    const id = node('input');
    id.type = 'hidden';
    form.append(id);
    const controls = fields.map(field => {
      const input = inputField(field);
      form.append(input.label);
      return { definition: field, element: input.field };
    });
    const formActions = node('div', 'admin-actions');
    const saveButton = node('button', 'admin-button', 'Dodaj');
    saveButton.type = 'submit';
    const cancelButton = button('Wyczyść formularz', () => { form.reset(); id.value = ''; saveButton.textContent = 'Dodaj'; });
    formActions.append(saveButton, cancelButton);
    form.append(formActions);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const values = {};
      for (const item of controls) {
        const raw = item.definition.type === 'checkbox' ? item.element.checked : item.element.value.trim();
        if (item.definition.required && !raw) return toast(`Uzupełnij pole: ${item.definition.label}.`);
        if (item.definition.type === 'number') {
          const number = Number(raw);
          if (!Number.isFinite(number) || number < 0) return toast('Nagroda i kolejność nie mogą być ujemne.');
          values[item.definition.key] = number;
        } else {
          values[item.definition.key] = raw;
        }
      }
      if (name === 'events' && values.startAt && values.endAt && Date.parse(values.startAt) > Date.parse(values.endAt)) {
        return toast('Data zakończenia eventu nie może poprzedzać jego startu.');
      }
      const config = getDraft();
      const list = config[name];
      const existingIndex = list.findIndex(item => item.id === id.value);
      if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...values };
      else list.push({ id: `${name}-${Date.now()}`, author: 'TechnixPro', time: 'teraz', ...values });
      saveDraft(config, `${title}: zapisano w wersji roboczej.`);
    });
    card.append(form);
    records.forEach(record => {
      const row = node('div', 'admin-list-row');
      const description = record.title || record.text || 'Powiadomienie';
      const detail = name === 'tasks' || name === 'events' ? ` · ${record.reward} ★` : '';
      const visible = name === 'posts' ? record.visible !== false : record.active !== false && record.sent !== false;
      row.append(node('div', 'admin-list-copy', `${description}${detail} · ${visible ? 'Aktywne' : 'Ukryte / nieaktywne'}`));
      row.append(button('Edytuj', () => {
        id.value = record.id;
        saveButton.textContent = 'Zapisz zmiany';
        controls.forEach(item => {
          const value = record[item.definition.key];
          if (item.definition.type === 'checkbox') item.element.checked = Boolean(value);
          else item.element.value = value === undefined ? '' : value;
        });
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      if (name === 'notifications' && !record.sent) {
        row.append(button('Oznacz jako wysłane', () => updateRecord(name, record.id, { sent: true })));
      }
      row.append(button('Usuń', () => {
        if (window.confirm('Usunąć ten element z wersji roboczej?')) deleteRecord(name, record.id);
      }, 'admin-button admin-button-danger'));
      card.append(row);
    });
    target.append(card);
  }

  function updateRecord(name, id, changes) {
    const config = getDraft();
    const record = config[name].find(item => item.id === id);
    if (record) Object.assign(record, changes);
    saveDraft(config);
  }

  function deleteRecord(name, id) {
    const config = getDraft();
    config[name] = config[name].filter(item => item.id !== id);
    saveDraft(config, 'Usunięto element z draftu.');
  }

  function renderStatus(target, config) {
    const card = panel('Baner i status systemu');
    const textField = inputField({ key: 'text', label: 'Tekst statusu', required: true }, config.statusBanner.text);
    const levelField = inputField({ key: 'level', label: 'Poziom (info / warn / ok)' }, config.statusBanner.level);
    const visibleField = inputField({ key: 'visible', label: 'Widoczny', type: 'checkbox' }, config.statusBanner.visible);
    card.append(textField.label, levelField.label, visibleField.label);
    card.append(button('Zapisz status do draftu', () => {
      const next = getDraft();
      const text = textField.field.value.trim();
      if (!text) return toast('Wpisz tekst statusu.');
      const level = levelField.field.value.trim();
      if (!['info', 'warn', 'ok'].includes(level)) return toast('Poziom musi mieć wartość info, warn lub ok.');
      next.statusBanner = { text, level, visible: visibleField.field.checked };
      saveDraft(next);
    }));
    target.append(card);
  }

  function renderPresets(target, config) {
    const card = panel('Presety');
    (config.presets || []).forEach(preset => {
      const row = node('div', 'admin-list-row');
      row.append(node('div', 'admin-list-copy', preset.name));
      row.append(button('Załaduj do draftu', () => {
        window.TechnixStore.loadPreset(preset.id).then(next => {
          if (previewMode) onConfigChange(next, true);
          render();
          toast('Preset załadowano do draftu — nie został opublikowany.');
        }).catch(error => toast(error.message));
      }));
      card.append(row);
    });
    const nameField = inputField({ label: 'Nazwa własnego presetu' });
    card.append(nameField.label, button('Zapisz obecną konfigurację jako preset', () => {
      window.TechnixStore.savePreset(nameField.field.value).then(() => {
        render();
        toast('Zapisano preset w wersji roboczej.');
      }).catch(error => toast(error.message));
    }));
    target.append(card);
  }

  function renderData(target, config) {
    const card = panel('Kopia konfiguracji');
    card.append(node('p', 'admin-note', 'Eksport zawiera wyłącznie konfigurację. Statystyki poniżej są danymi demo i będą pochodziły z backendu.'));
    const stats = node('div', 'admin-stats');
    [['Aktywne zadania', config.tasks.filter(item => item.active !== false).length], ['Widoczne posty', config.posts.filter(item => item.visible !== false).length], ['Powiadomienia', config.notifications.length]].forEach(([label, value]) => {
      const item = node('div', 'admin-stat');
      item.append(node('span', '', label), node('strong', '', String(value)));
      stats.append(item);
    });
    card.append(stats);
    card.append(button('Eksportuj JSON', () => {
      const file = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file);
      const link = node('a');
      link.href = url;
      link.download = 'technixpro-config.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    const importArea = node('textarea', 'admin-input admin-import');
    importArea.placeholder = 'Wklej tutaj JSON konfiguracji';
    importArea.setAttribute('aria-label', 'Konfiguracja JSON do importu');
    card.append(importArea, button('Importuj do draftu', () => {
      try {
        const imported = JSON.parse(importArea.value);
        window.TechnixStore.replaceDraft(imported).then(next => {
          if (previewMode) onConfigChange(next, true);
          render();
          toast('Import zapisano jako draft.');
        }).catch(error => toast(error.message));
      } catch (error) {
        toast('Nieprawidłowy format JSON.');
      }
    }));
    target.append(card);
  }

  function rejectDraft() {
    if (!window.confirm('Odrzucić wszystkie niezapisane zmiany?')) return;
    window.TechnixStore.reject().then(config => {
      if (previewMode) onConfigChange(config, true);
      render();
      toast('Odrzucono zmiany draftu.');
    }).catch(error => toast(error.message));
  }

  function rollback() {
    if (!window.confirm('Cofnąć opublikowaną konfigurację do poprzedniej wersji?')) return;
    window.TechnixStore.rollback().then(config => {
      if (previewMode) onConfigChange(config, true);
      render();
      toast('Przywrócono poprzednią publikację.');
    }).catch(error => toast(error.message));
  }

  window.AdminControlCenter = { initialize, isAuthorized };
})();
