(function () {
  const order = ['monitor', 'keyboard', 'mouse', 'case', 'fan', 'ram', 'gpu'];
  const labels = {
    monitor: 'Monitor',
    keyboard: 'Klawiatura',
    mouse: 'Myszka',
    case: 'Obudowa komputera',
    fan: 'Chłodzenie',
    ram: 'Pamięć RAM',
    gpu: 'Karta graficzna'
  };
  const drawings = {
    monitor: '<path d="M235 55h156v104H235z" rx="8" fill="#101a2b" stroke="#8b5cf6" stroke-width="4"/><rect class="monitor-screen" x="243" y="63" width="140" height="88" rx="4" fill="#071522"/><path class="boot-line" d="M258 132h46m-46 8h76" stroke="#22d3ee" stroke-width="2" opacity=".65"/><path d="M300 159h26v27h-26zM279 186h68v7h-68z" fill="#27364a" stroke="#22d3ee" stroke-width="2"/>',
    keyboard: '<path d="M186 194l183-1 12 20-195 1z" fill="#182538" stroke="#22d3ee" stroke-width="2"/><path d="M201 199h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9M205 205h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9m8 0h9" stroke="#9e8aff" stroke-width="2" stroke-linecap="round"/>',
    mouse: '<path d="M404 190c0-11 8-18 17-18s17 7 17 18v10c0 12-7 19-17 19s-17-7-17-19z" fill="#17263a" stroke="#ec4899" stroke-width="2"/><path d="M421 173v10" stroke="#22d3ee" stroke-width="2"/>',
    case: '<path d="M104 211h116v112H104z" rx="8" fill="#111b2b" stroke="#64748b" stroke-width="3"/><path d="M114 220h96v93h-96z" fill="#0a1220" stroke="#334155"/><circle cx="130" cy="231" r="3" fill="#22d3ee"/><path d="M121 300h80" stroke="#27364a" stroke-width="2"/>',
    fan: '<circle cx="162" cy="265" r="27" fill="#0d1725" stroke="#22d3ee" stroke-width="2"/><g class="fan-blades"><path d="M162 261c-3-19 3-22 8-18 6 6 1 15-8 18m4 4c18-5 22 1 17 7-6 5-15 0-17-7m-7 4c5 18-1 22-7 17-5-6 0-15 7-17m-4-8c-18 5-22-1-17-7 6-5 15 0 17 7" fill="#8b5cf6" opacity=".85"/><circle cx="162" cy="265" r="4" fill="#dbeafe"/></g>',
    ram: '<path d="M123 239h76v11h-76z" rx="3" fill="#17263a" stroke="#ec4899" stroke-width="2"/><path d="M131 241v7m12-7v7m12-7v7m12-7v7m12-7v7" stroke="#22d3ee" stroke-width="2"/><circle class="ram-led" cx="193" cy="244" r="2" fill="#ec4899"/>',
    gpu: '<path d="M119 276h91v18h-91z" rx="4" fill="#17263a" stroke="#8b5cf6" stroke-width="2"/><circle cx="145" cy="285" r="8" fill="#0b1422" stroke="#22d3ee"/><g class="gpu-fan gpu-fan-one"><path d="M145 279v12m-6-6h12" stroke="#a5f3fc" stroke-width="2"/></g><circle cx="184" cy="285" r="8" fill="#0b1422" stroke="#ec4899"/><g class="gpu-fan gpu-fan-two"><path d="M184 279v12m-6-6h12" stroke="#fbcfe8" stroke-width="2"/></g><path d="M130 296v5m9-5v5m9-5v5m9-5v5m9-5v5" stroke="#fbbf24" stroke-width="2"/>'
  };
  const bounds = {
    monitor: '220 45 185 155', keyboard: '175 187 205 42', mouse: '395 165 48 60',
    case: '92 202 140 128', fan: '126 229 72 72', ram: '115 232 88 24', gpu: '112 269 106 36'
  };
  const sparkPoints = {
    monitor: [314, 57], keyboard: [278, 194], mouse: [421, 171],
    case: [103, 211], fan: [162, 238], ram: [195, 239], gpu: [207, 275]
  };
  const state = { owned: new Set(), queue: Promise.resolve(), online: false, visible: false, inView: false, screenActive: false };
  let scene;
  let observer;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function symbolDefs() {
    return `<defs>${order.map(key => `<symbol id="rig-symbol-${key}" viewBox="0 0 640 360">${drawings[key]}</symbol>`).join('')}</defs>`;
  }

  function init() {
    scene = document.getElementById('rig-scene');
    const svg = document.getElementById('rig-svg');
    if (!scene || !svg) return;
    svg.innerHTML = `${symbolDefs()}
      <defs><pattern id="rig-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#22d3ee" stroke-opacity=".06" stroke-width="1"/></pattern></defs>
      <rect x="0" y="0" width="640" height="360" fill="url(#rig-grid)"/>
      <ellipse cx="322" cy="326" rx="246" ry="14" fill="#22d3ee" opacity=".05"/>
      <g id="rig-desk"><path d="M65 193h510v13H65z" fill="#26354b"/><path d="M65 193h510" stroke="#22d3ee" stroke-width="3"/><path d="M98 206h15v111H98zm451 0h15v111h-15z" fill="#1b293d"/><path d="M80 319h52m411 0h52" stroke="#34465e" stroke-width="7" stroke-linecap="round"/><path d="M70 334h500" stroke="#22d3ee" stroke-opacity=".16" stroke-width="1"/></g>
      ${order.map(key => {
        const [x, y] = sparkPoints[key];
        return `<g id="rig-${key}" data-part="${key}" class="rig-part rig-${key}" role="img" aria-label="${labels[key]} (niezamontowano)"><title>${labels[key]}</title><use href="#rig-symbol-${key}"></use></g><g id="rig-sparks-${key}" class="rig-sparks" aria-hidden="true"><path d="M${x - 8} ${y}h16m-8-8v16m-6-14 12 12m0-12-12 12" fill="none" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/></g>`;
      }).join('')}
      <g id="rig-online-label" class="rig-online-label"><rect x="440" y="30" width="144" height="28" rx="14" fill="#05252d" stroke="#22d3ee" stroke-opacity=".6"/><text x="512" y="49" text-anchor="middle" fill="#a5f3fc" font-size="12" font-weight="700">RIG ONLINE</text></g>`;
    const replay = document.getElementById('rig-replay');
    replay.addEventListener('click', replayAssembly);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        state.inView = entries[0].isIntersecting;
        applyVisibility();
      }, { threshold: 0.1 });
      observer.observe(scene);
    } else {
      state.inView = true;
    }
    document.addEventListener('visibilitychange', updateVisibility);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-screen="crypto"]')) requestAnimationFrame(updateVisibility);
    });
    updateVisibility();
  }

  function updateVisibility() {
    state.screenActive = Boolean(scene && !document.getElementById('screen-crypto').classList.contains('hidden'));
    applyVisibility();
  }

  function applyVisibility() {
    state.visible = state.screenActive && state.inView && !document.hidden;
    if (scene) scene.classList.toggle('rig-paused', !state.visible);
  }

  function setVisible(visible) {
    state.screenActive = visible;
    applyVisibility();
  }

  function updateSummary() {
    const progress = document.getElementById('rig-progress');
    const status = document.getElementById('rig-status');
    const count = state.owned.size;
    if (progress) progress.textContent = `Zamontowano ${count}/${order.length}${count === order.length ? ' · pełny zestaw' : ''}`;
    if (status) status.textContent = state.online ? 'RIG ONLINE · mining w toku' : count ? `Stanowisko działa · ${count} z ${order.length} części` : 'Puste biurko · kup części, aby zbudować stanowisko';
  }

  function mount(key, animated) {
    const part = document.getElementById(`rig-${key}`);
    if (!part) return Promise.resolve();
    part.setAttribute('aria-label', `${labels[key]} (zamontowano)`);
    part.classList.add('owned');
    if (!animated || (reduceMotion && reduceMotion.matches) || window.CONFIG.ANIMATIONS_ENABLED === false) {
      updateSummary();
      return Promise.resolve();
    }
    part.classList.add('assembling');
    const from = {
      monitor: 'translateY(-52px) scale(.92)', keyboard: 'translateY(40px) scale(.9)', mouse: 'translateX(45px) scale(.8)',
      case: 'translateX(-70px) scale(.88)', fan: 'scale(.35) rotate(-35deg)', ram: 'translateY(-28px)', gpu: 'translateX(-45px) scale(.9)'
    }[key] || 'translateY(-24px)';
    const animation = part.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'translate(0) scale(1)' }], {
      duration: 1050, easing: 'cubic-bezier(.2,1.5,.45,1)', fill: 'both'
    });
    return animation.finished.catch(() => {}).then(() => {
      const sparks = document.getElementById(`rig-sparks-${key}`);
      if (sparks) sparks.animate([
        { opacity: 1, transform: 'scale(.45)' },
        { opacity: 0, transform: 'scale(1.35)' }
      ], { duration: 430, easing: 'ease-out' });
      part.classList.remove('assembling');
      part.style.opacity = '';
      part.style.transform = '';
      updateSummary();
    });
  }

  function renderRig(ownedParts = {}, options = {}) {
    if (!scene) init();
    const parts = ownedParts.parts || ownedParts;
    const newlyOwned = order.filter(key => Boolean(parts && parts[key]) && !state.owned.has(key));
    state.owned = new Set(order.filter(key => Boolean(parts && parts[key])));
    state.online = false;
    order.forEach(key => {
      const node = document.getElementById(`rig-${key}`);
      if (!node) return;
      const shouldAnimate = options.animateNew && newlyOwned.includes(key);
      node.classList.toggle('owned', state.owned.has(key) && !shouldAnimate);
      node.classList.remove('assembling');
      node.style.opacity = '';
      node.style.transform = '';
      node.setAttribute('aria-label', `${labels[key]} (${state.owned.has(key) ? 'zamontowano' : 'niezamontowano'})`);
    });
    updateSummary();
    const animateKeys = options.replay ? order.filter(key => state.owned.has(key)) : newlyOwned;
    if (options.animateNew && animateKeys.length) {
      animateKeys.forEach(key => document.getElementById(`rig-${key}`).classList.remove('owned'));
      state.queue = state.queue.then(async () => {
        for (const key of animateKeys) await mount(key, true);
        if (state.owned.size === order.length) await boot();
      });
    } else if (state.owned.size === order.length) {
      state.online = true;
      scene.classList.add('rig-online');
      updateSummary();
    }
  }

  function boot() {
    const svg = document.getElementById('rig-svg');
    if (reduceMotion && reduceMotion.matches) {
      state.online = true;
      scene.classList.add('rig-online');
      updateSummary();
      return Promise.resolve();
    }
    svg.classList.add('rig-booting');
    return new Promise(resolve => setTimeout(() => {
      svg.classList.remove('rig-booting');
      scene.classList.add('rig-online');
      state.online = true;
      updateSummary();
      resolve();
    }, 700));
  }

  function replayAssembly() {
    const svg = document.getElementById('rig-svg');
    if (!svg) return;
    state.online = false;
    scene.classList.remove('rig-online');
    svg.classList.remove('rig-booting');
    order.forEach(key => {
      const node = document.getElementById(`rig-${key}`);
      node.classList.remove('owned', 'assembling');
      node.style.opacity = '';
      node.style.transform = '';
    });
    const saved = new Set(state.owned);
    state.owned = new Set();
    updateSummary();
    const replayParts = Object.fromEntries(order.map(key => [key, saved.has(key)]));
    state.owned = saved;
    renderRig(replayParts, { animateNew: true, replay: true });
  }

  function preview(key) {
    const viewBox = bounds[key] || '0 0 640 360';
    return `<svg class="rig-preview-svg" viewBox="${viewBox}" role="img" aria-label="Podgląd: ${labels[key]}">${drawings[key]}</svg>`;
  }

  window.rigBuilder = { init, renderRig, preview, setVisible, order: [...order] };
  window.addEventListener('load', init);
})();
