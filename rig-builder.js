(function () {
  const partKeys = ['monitor', 'keyboard', 'mouse', 'case', 'ram', 'gpu', 'fan'];
  const labels = {
    monitor: 'Monitor',
    keyboard: 'Klawiatura',
    mouse: 'Mysz',
    case: 'Obudowa komputera',
    ram: 'Pamięć RAM',
    gpu: 'Karta graficzna',
    fan: 'Wentylator'
  };
  const scene = () => document.getElementById('rig-scene');
  let animationQueue = Promise.resolve();
  let observer;
  let intersects = true;
  let cryptoVisible = false;

  function shouldReduceMotion() {
    return window.CONFIG?.ANIMATIONS_ENABLED === false
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function updatePauseState() {
    const svg = scene();
    if (!svg) return;
    const paused = document.hidden || !cryptoVisible || !intersects;
    svg.classList.toggle('is-paused', paused);
    if (paused) {
      (svg._rigAnimations || []).forEach(animation => animation.pause());
    } else {
      (svg._rigAnimations || []).forEach(animation => animation.play());
    }
  }

  function animatePart(key) {
    const svg = scene();
    const part = svg?.querySelector(`#rig-${key}`);
    if (!part) return Promise.resolve();
    part.classList.add('is-installed');
    if (shouldReduceMotion() || !part.animate) return Promise.resolve();

    const offsets = {
      monitor: ['translateY(-28px) scale(.92)', 'translateY(0) scale(1)'],
      keyboard: ['translateX(-38px) scale(.94)', 'translateX(0) scale(1)'],
      mouse: ['translateX(34px) scale(.9)', 'translateX(0) scale(1)'],
      case: ['translateX(-54px) translateY(8px)', 'translateX(0) translateY(0)'],
      ram: ['translateY(-24px)', 'translateY(0)'],
      gpu: ['translateX(42px)', 'translateX(0)'],
      fan: ['scale(.55) rotate(-25deg)', 'scale(1) rotate(0deg)']
    };
    const [from, to] = offsets[key];
    const animation = part.animate(
      [{ opacity: 0, transform: from }, { opacity: 1, transform: to, offset: 0.76 }, { opacity: 1, transform: to }],
      { duration: 960, easing: 'cubic-bezier(.18,.86,.28,1.24)', fill: 'both' }
    );
    svg._rigAnimations = [...(svg._rigAnimations || []), animation];
    updatePauseState();
    return animation.finished.catch(() => {}).then(() => {
      animation.cancel();
      if (key === 'monitor') part.classList.add('is-booted');
      svg._rigAnimations = (svg._rigAnimations || []).filter(item => item !== animation);
    });
  }

  function install(ownedParts, keys, scrollToScene) {
    const svg = scene();
    if (!svg) return;
    const owned = new Set(ownedParts.filter(key => partKeys.includes(key)));
    svg.querySelectorAll('.rig-part').forEach(part => {
      const key = part.id.replace('rig-', '');
      const installed = owned.has(key) && (key !== 'fan' || owned.has('case'));
      part.classList.toggle('is-installed', installed);
      part.classList.toggle('is-booted', installed && key === 'monitor'
        && (!keys.includes(key) || shouldReduceMotion()));
    });
    svg.classList.toggle('is-complete', owned.size === partKeys.length);
    const progress = document.getElementById('rig-progress');
    const status = document.getElementById('rig-status');
    if (progress) progress.textContent = `Zamontowano ${owned.size}/${partKeys.length}`;
    if (status) status.textContent = owned.size === partKeys.length
      ? 'RIG ONLINE · stanowisko wydobywa'
      : owned.size ? `Działa: ${[...owned].map(key => labels[key]).join(', ')}`
        : 'Puste biurko · kup część, aby rozpocząć montaż';

    if (!keys.length) {
      updatePauseState();
      return;
    }
    if (scrollToScene) {
      document.getElementById('rig-builder')?.scrollIntoView({ behavior: shouldReduceMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    animationQueue = animationQueue.then(async () => {
      for (const key of keys) {
        if (owned.has(key) && (key !== 'fan' || owned.has('case'))) await animatePart(key);
      }
      svg.classList.toggle('is-complete', owned.size === partKeys.length);
      if (status && owned.size === partKeys.length) status.textContent = 'RIG ONLINE · stanowisko wydobywa';
    });
  }

  function renderRig(ownedParts, options = {}) {
    const owned = Array.isArray(ownedParts) ? ownedParts : [];
    install(owned, Array.isArray(options.animateNew) ? options.animateNew : [], Boolean(options.focus));
  }

  function replay(ownedParts) {
    const svg = scene();
    if (!svg) return;
    const owned = partKeys.filter(key => ownedParts.includes(key) && (key !== 'fan' || ownedParts.includes('case')));
    svg.classList.remove('is-complete');
    svg.querySelectorAll('.rig-part').forEach(part => part.classList.remove('is-installed'));
    svg.querySelectorAll('.rig-part').forEach(part => part.classList.remove('is-booted'));
    const status = document.getElementById('rig-status');
    if (status) status.textContent = 'Odtwarzanie montażu…';
    install([], [], false);
    animationQueue = animationQueue.then(async () => {
      const progress = document.getElementById('rig-progress');
      for (const [index, key] of owned.entries()) {
        await animatePart(key);
        if (progress) progress.textContent = `Zamontowano ${index + 1}/${partKeys.length}`;
      }
      svg.classList.toggle('is-complete', owned.length === partKeys.length);
      if (status) status.textContent = owned.length === partKeys.length
        ? 'RIG ONLINE · stanowisko wydobywa'
        : `Montaż zakończony · ${owned.length}/${partKeys.length} części`;
    });
    document.getElementById('rig-builder')?.scrollIntoView({ behavior: shouldReduceMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  function createPreview(key) {
    const original = document.getElementById(`rig-${key}`);
    if (!original) return document.createElement('span');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', key === 'case' || key === 'fan' || key === 'ram' || key === 'gpu' ? '85 135 115 105' : '105 45 190 105');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('rig-shop-preview');
    const preview = original.cloneNode(true);
    preview.removeAttribute('id');
    preview.classList.add('is-installed');
    svg.append(preview);
    return svg;
  }

  function init() {
    const svg = scene();
    if (!svg) return;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        intersects = entries.some(entry => entry.isIntersecting);
        updatePauseState();
      });
      observer.observe(svg);
    }
    document.addEventListener('visibilitychange', updatePauseState);
    document.addEventListener('rig-screen-visibility', event => {
      cryptoVisible = Boolean(event.detail);
      updatePauseState();
    });
    document.getElementById('rig-replay')?.addEventListener('click', () => {
      replay(window.getOwnedRigParts ? window.getOwnedRigParts() : []);
    });
    updatePauseState();
  }

  window.RigBuilder = { renderRig, replay, createPreview, init };
  window.addEventListener('load', init, { once: true });
})();
