(function () {
  const PART_NAMES = {
    monitor: 'Monitor',
    keyboard: 'Klawiatura',
    mouse: 'Mysz',
    case: 'Obudowa komputera',
    fan: 'Chłodzenie',
    ram: 'RAM',
    gpu: 'Karta graficzna'
  };
  const DIRECTIONS = {
    monitor: [-24, -90],
    keyboard: [0, 36],
    mouse: [0, 36],
    case: [-90, 0],
    fan: [0, -24],
    ram: [0, -24],
    gpu: [30, 0]
  };
  const stage = () => document.querySelector('.rig-station');
  const reducedMotion = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false);
  let owned = {};
  let queue = Promise.resolve();
  let sequenceId = 0;
  let runningAnimations = [];
  let visible = false;
  let intersectionVisible = true;
  let online = false;

  function isVisible() {
    return visible && intersectionVisible && !document.hidden;
  }

  function updateAnimationPlayback() {
    runningAnimations.forEach(animation => {
      if (isVisible()) animation.play();
      else animation.pause();
    });
    const root = stage();
    const screen = document.getElementById('screen-crypto');
    if (root) {
      root.classList.toggle('rig-paused', !isVisible());
      root.classList.toggle('rig-motion-disabled', Boolean(window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false));
    }
    if (screen) screen.classList.toggle('rig-paused', !isVisible());
    document.documentElement.classList.toggle('animations-disabled', Boolean(window.CONFIG && window.CONFIG.ENABLE_ANIMATIONS === false));
  }

  function setMounted(key, mounted) {
    const node = document.getElementById(`rig-${key}`);
    if (!node) return;
    node.classList.toggle('is-mounted', mounted);
    node.classList.toggle('is-running', mounted);
    node.setAttribute('aria-hidden', String(!mounted));
  }

  function updateStatus() {
    const keys = Object.keys(PART_NAMES);
    const count = keys.filter(key => document.getElementById(`rig-${key}`)?.classList.contains('is-mounted')).length;
    const summary = document.getElementById('rig-status');
    const progress = document.getElementById('rig-progress');
    const badge = document.getElementById('rig-online');
    if (summary) summary.textContent = `${count} z ${keys.length} części zamontowanych`;
    if (progress) progress.textContent = `Zamontowano ${count}/${keys.length}`;
    if (badge) badge.classList.toggle('hidden', count !== keys.length || !online);
    const root = stage();
    if (root) root.classList.toggle('rig-online-active', count === keys.length && online);
    if (count !== keys.length) online = false;
  }

  function playInstall(key) {
    const node = document.getElementById(`rig-${key}`);
    if (!node || reducedMotion()) {
      setMounted(key, true);
      updateStatus();
      return Promise.resolve();
    }
    const [x, y] = DIRECTIONS[key];
    setMounted(key, true);
    updateStatus();
    const animation = node.animate([
      { opacity: 0, transform: `translate(${x}px, ${y}px) scale(.78)` },
      { opacity: 1, transform: 'translate(0, 0) scale(1.06)', offset: .78 },
      { opacity: 1, transform: 'translate(0, 0) scale(1)' }
    ], { duration: 1050, easing: 'cubic-bezier(.2, 1.35, .35, 1)', fill: 'both' });
    const flash = node.querySelector('.rig-flash');
    if (flash) {
      const flashAnimation = flash.animate([{ opacity: 0 }, { opacity: .9, offset: .25 }, { opacity: 0 }], { duration: 850 });
      runningAnimations.push(flashAnimation);
      flashAnimation.finished.catch(() => {}).then(() => {
        runningAnimations = runningAnimations.filter(item => item !== flashAnimation);
        flashAnimation.cancel();
      });
    }
    runningAnimations.push(animation);
    updateAnimationPlayback();
    return animation.finished.catch(() => {}).then(() => {
      runningAnimations = runningAnimations.filter(item => item !== animation);
      node.style.transform = '';
      node.style.opacity = '';
      animation.cancel();
    });
  }

  async function playQueue(keys, id = sequenceId) {
    for (const key of keys) {
      if (id !== sequenceId) return;
      await playInstall(key);
      if (id !== sequenceId) return;
    }
    updateStatus();
    if (Object.keys(PART_NAMES).every(key => owned[key])) {
      online = true;
      updateStatus();
    }
  }

  function renderRig(parts = {}, options = {}) {
    const newlyOwned = [];
    Object.keys(PART_NAMES).forEach(key => {
      const hasPart = parts[key] === true;
      const animatePart = hasPart && !owned[key] && options.animateNew;
      if (animatePart) newlyOwned.push(key);
      setMounted(key, hasPart && !animatePart);
    });
    owned = { ...parts };
    if (!newlyOwned.length && Object.keys(PART_NAMES).every(key => owned[key])) online = true;
    updateStatus();
    if (newlyOwned.length) {
      const id = sequenceId;
      queue = queue.then(() => playQueue(newlyOwned, id));
    }
    return queue;
  }

  function replay() {
    online = false;
    sequenceId += 1;
    runningAnimations.forEach(animation => animation.cancel());
    runningAnimations = [];
    const root = stage();
    if (root) root.scrollIntoView({ behavior: 'auto', block: 'center' });
    Object.keys(PART_NAMES).forEach(key => setMounted(key, false));
    updateStatus();
    queue = Promise.resolve().then(() => playQueue(Object.keys(PART_NAMES).filter(key => owned[key]), sequenceId));
    return queue;
  }

  function bindScene() {
    const root = stage();
    if (!root) return;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        intersectionVisible = entries[0].isIntersecting;
        updateAnimationPlayback();
      });
      observer.observe(root);
    }
    const button = document.getElementById('rig-replay');
    if (button) button.addEventListener('click', replay);
    document.addEventListener('visibilitychange', updateAnimationPlayback);
  }

  function bindThumbnails() {
    document.querySelectorAll('.shop-item-preview use').forEach(use => {
      use.setAttribute('href', `#rig-${use.closest('[data-preview]')?.dataset.preview || ''}`);
    });
  }

  window.rigBuilder = { renderRig, setVisible(value) { visible = value; updateAnimationPlayback(); }, bindScene, bindThumbnails, names: PART_NAMES };
})();
