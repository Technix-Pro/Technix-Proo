(function (root) {
  'use strict';
  var directions = ['left', 'bottom', 'right', 'top', 'left', 'bottom', 'right'];

  function progress(owned) {
    var count = Array.isArray(owned) ? owned.length : 0;
    return { count: count, total: 7, percent: Math.round(count / 7 * 100) };
  }

  function reducedMotion() {
    return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setPart(group, entering) {
    if (!group) return;
    group.classList.remove('rig-mounted', 'rig-entering', 'rig-from-left', 'rig-from-right', 'rig-from-top', 'rig-from-bottom');
    group.classList.add(entering ? 'rig-entering' : 'rig-mounted');
  }

  function animateSequence(svg, owned, onStep) {
    var parts = owned.filter(function (key) { return svg.querySelector('[data-part="' + key + '"]'); });
    svg._rigSequence = (svg._rigSequence || 0) + 1;
    var sequence = svg._rigSequence;
    root.clearTimeout(svg._rigTimer);
    if (reducedMotion()) {
      parts.forEach(function (key, index) {
        setPart(svg.querySelector('[data-part="' + key + '"]'), false);
        if (onStep) onStep(key, index + 1, parts.length);
      });
      if (onStep) onStep(null, parts.length, parts.length);
      return;
    }
    parts.forEach(function (key) {
      var group = svg.querySelector('[data-part="' + key + '"]');
      setPart(group, true);
      group.classList.add('rig-from-' + directions[Math.max(0, owned.indexOf(key)) % directions.length]);
    });
    var index = 0;
    function next() {
      if (sequence !== svg._rigSequence) return;
      if (index >= parts.length) {
        if (onStep) onStep(null, parts.length, parts.length);
        return;
      }
      var key = parts[index];
      setPart(svg.querySelector('[data-part="' + key + '"]'), false);
      if (onStep) onStep(key, index + 1, parts.length);
      index += 1;
      svg._rigTimer = root.setTimeout(next, 420);
    }
    root.requestAnimationFrame(next);
  }

  var api = {
    progress: progress,
    mount: function (svg, owned, animatePart, onStep) {
      if (!svg) return;
      owned.forEach(function (key) {
        var group = svg.querySelector('[data-part="' + key + '"]');
        if (animatePart === key && !reducedMotion()) {
          setPart(group, true);
          group.classList.add('rig-from-' + directions[Math.max(0, owned.indexOf(key)) % directions.length]);
          root.requestAnimationFrame(function () {
            setPart(group, false);
            if (onStep) onStep(key, owned.indexOf(key) + 1, owned.length);
          });
        } else {
          setPart(group, false);
        }
      });
    },
    replay: animateSequence
  };
  root.TPRig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
