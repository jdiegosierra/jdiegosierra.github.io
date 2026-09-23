(function () {
  var root = document.documentElement;
  var lang = (root.lang || 'en').toLowerCase();
  var isSpanish = lang.indexOf('es') === 0;
  var press = 'Click';
  try { press = window.matchMedia('(hover: hover)').matches ? 'Click' : 'Tap'; } catch (error) {}
  var labels = isSpanish
    ? {
        generic: 'Cambiar tema',
        light: 'Cambiar a tema claro',
        dark: 'Cambiar a tema oscuro',
        hintDay: 'Pulsa el sol para que anochezca',
        hintNight: 'Pulsa la luna para que amanezca'
      }
    : {
        generic: 'Switch theme',
        light: 'Switch to light theme',
        dark: 'Switch to dark theme',
        hintDay: press + ' the sun for night',
        hintNight: press + ' the moon for day'
      };
  var currentScript = document.currentScript;

  // Seeded, so the stars sit in the same place on every page and every visit.
  function seededRandom(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Today's moon. The lit part is the limb on one side closed by the terminator, an ellipse whose
  // width follows the phase: 0 is a new moon and 0.5 a full moon, as seen from the north.
  function moonSvg(date) {
    var synodicMonth = 29.530588853;
    var knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    var age = ((date.getTime() - knownNewMoon) / 864e5) % synodicMonth;
    var phase = (age < 0 ? age + synodicMonth : age) / synodicMonth;
    var cos = Math.cos(2 * Math.PI * phase);
    var waxing = phase < 0.5;
    var crescent = cos > 0;
    var lit = 'M50 0A50 50 0 0 ' + (waxing ? 1 : 0) + ' 50 100' +
      'A' + (50 * Math.abs(cos)).toFixed(2) + ' 50 0 0 ' + (waxing === crescent ? 0 : 1) + ' 50 0Z';

    return `<svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
  <defs>
    <radialGradient id="scene-moon-surface" cx="40%" cy="36%" r="72%">
      <stop offset="0" stop-color="#fbfaff"/>
      <stop offset="0.55" stop-color="#e2dded"/>
      <stop offset="1" stop-color="#a39bb4"/>
    </radialGradient>
    <filter id="scene-moon-soften"><feGaussianBlur stdDeviation="1.4"/></filter>
    <mask id="scene-moon-lit"><path d="${lit}" fill="#fff" filter="url(#scene-moon-soften)"/></mask>
    <g id="scene-moon-maria">
      <ellipse cx="26" cy="50" rx="12" ry="21" transform="rotate(12 26 50)"/>
      <ellipse cx="38" cy="29" rx="13" ry="10"/>
      <ellipse cx="57" cy="31" rx="8" ry="7"/>
      <ellipse cx="64" cy="45" rx="10" ry="8"/>
      <ellipse cx="81" cy="37" rx="6" ry="5"/>
      <ellipse cx="76" cy="57" rx="6" ry="8"/>
      <ellipse cx="42" cy="69" rx="9" ry="6"/>
      <ellipse cx="27" cy="70" rx="5" ry="5"/>
    </g>
  </defs>
  <circle class="landscape-scene__moon-dark" cx="50" cy="50" r="50"/>
  <use class="landscape-scene__moon-maria landscape-scene__moon-maria--dark" href="#scene-moon-maria"/>
  <g mask="url(#scene-moon-lit)">
    <circle cx="50" cy="50" r="50" fill="url(#scene-moon-surface)"/>
    <use class="landscape-scene__moon-maria" href="#scene-moon-maria"/>
    <circle class="landscape-scene__moon-crater" cx="44" cy="85" r="2.4"/>
    <circle class="landscape-scene__moon-crater" cx="37" cy="44" r="2.6"/>
    <circle class="landscape-scene__moon-crater" cx="24" cy="45" r="1.6"/>
    <circle class="landscape-scene__moon-crater" cx="70" cy="73" r="3"/>
    <circle class="landscape-scene__moon-crater" cx="62" cy="20" r="2"/>
  </g>
  <circle class="landscape-scene__moon-rim" cx="50" cy="50" r="49.5"/>
</svg>`;
  }

  // Background stars: layers of box-shadow dots that fade in one after another at nightfall.
  function starLayers(random) {
    var sizes = [1, 1, 1.5, 1, 2, 1, 1.5, 1];
    var tints = ['255, 255, 255', '255, 255, 255', '255, 255, 255', '255, 231, 204', '210, 224, 255'];

    return sizes.map(function (size, layer) {
      var dots = [];
      for (var i = 0; i < 18; i++) {
        var x = (random() * 100).toFixed(1);
        var y = (Math.pow(random(), 1.4) * 100).toFixed(1);
        var tint = tints[Math.floor(random() * tints.length)];
        dots.push(x + 'vw ' + y + 'vh rgba(' + tint + ', ' + (0.45 + random() * 0.5).toFixed(2) + ')');
      }
      return '<span class="landscape-scene__stars" style="--star-size:' + size + 'px;--layer:' + layer + ';box-shadow:' + dots.join(',') + '"></span>';
    }).join('');
  }

  function twinkles(random) {
    var html = '';
    for (var i = 0; i < 12; i++) {
      html += '<span class="landscape-scene__twinkle" style="left:' + (random() * 100).toFixed(1) + '%;top:' +
        (Math.pow(random(), 1.3) * 90).toFixed(1) + '%;--layer:' + (i % 8) + ';--twinkle-duration:' +
        (2.5 + random() * 3).toFixed(1) + 's;--twinkle-delay:-' + (random() * 5).toFixed(1) + 's"></span>';
    }
    return html;
  }

  // Constellations traced from the stack, five down each side margin. Stars are [x, y, radius] in a
  // 100x100 box and lines join two stars by index; `top` and `inset` place the box, in viewport units.
  var constellations = [
    {
      id: 'git',
      name: 'Git',
      side: 'left', top: 6, inset: 2,
      labelY: 82,
      stars: [[6, 62, 1.2], [27, 62, 1.5], [50, 62, 1], [73, 62, 1.5], [94, 62, 1.1], [38, 36, 1.2], [62, 36, 1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 3]]
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      side: 'left', top: 24, inset: 4,
      labelY: 99,
      stars: [[50, 46, 1.6], [50, 8, 1.2], [70.1, 23.7, 1], [89.6, 40.4, 1.3], [71.3, 62.6, 1], [53.8, 81.8, 1.2], [31.5, 69.6, 1], [11.4, 51.4, 1.1], [27.9, 28.8, 1]],
      lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8]]
    },
    {
      id: 'docker',
      name: 'Docker',
      side: 'left', top: 42, inset: 1.5,
      labelY: 90,
      stars: [[10, 56, 1.3], [28, 70, 1], [58, 72, 1.1], [80, 60, 1], [92, 42, 1.2], [97, 58, 1], [24, 48, 1], [38, 48, 1], [52, 48, 1], [66, 48, 1], [24, 34, 1.1], [38, 34, 1], [52, 34, 1.2], [66, 34, 1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [0, 6], [6, 7], [7, 8], [8, 9], [9, 3], [6, 10], [7, 11], [8, 12], [9, 13], [10, 11], [11, 12], [12, 13]]
    },
    {
      id: 'prometheus',
      name: 'Prometheus',
      side: 'left', top: 60, inset: 3.5,
      labelY: 99,
      stars: [[50, 4, 1.5], [61, 24, 1], [70, 44, 1.2], [64, 66, 1], [50, 74, 1.1], [36, 66, 1], [30, 44, 1.2], [40, 26, 1], [50, 42, 1], [30, 86, 1.1], [70, 86, 1.1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 4], [9, 10]]
    },
    {
      id: 'python',
      name: 'Python',
      side: 'left', top: 78, inset: 2,
      labelY: 99,
      stars: [[10, 18, 1.5], [24, 24, 1], [36, 40, 1.1], [30, 56, 1], [40, 72, 1.2], [58, 78, 1], [72, 66, 1.1], [70, 50, 1], [80, 36, 1.2], [92, 34, 1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]]
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes',
      side: 'right', top: 24, inset: 2.5,
      labelY: 99,
      stars: [[50, 48, 1.6], [50, 10, 1.3], [79.7, 24.3, 1], [87, 56.5, 1.2], [66.5, 82.2, 1], [33.5, 82.2, 1.1], [13, 56.5, 1], [20.3, 24.3, 1.2]],
      lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1]]
    },
    {
      id: 'aws',
      name: 'AWS',
      side: 'right', top: 39, inset: 4,
      labelY: 84,
      stars: [[10, 50, 1.2], [28, 62, 1], [50, 67, 1.3], [70, 63, 1], [86, 52, 1.4], [76, 52, 1], [82.6, 61.4, 1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]]
    },
    {
      id: 'argo-cd',
      name: 'Argo CD',
      side: 'right', top: 54, inset: 2,
      labelY: 99,
      stars: [[50, 8, 1.4], [67, 16, 1], [73, 32, 1.1], [64, 48, 1], [50, 52, 1.2], [36, 48, 1], [27, 32, 1.1], [33, 16, 1], [26, 64, 1], [18, 78, 1.1], [44, 70, 1], [38, 86, 1], [58, 70, 1], [62, 86, 1.1], [74, 64, 1], [82, 78, 1]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [5, 8], [8, 9], [4, 10], [10, 11], [4, 12], [12, 13], [3, 14], [14, 15]]
    },
    {
      id: 'helm',
      name: 'Helm',
      side: 'right', top: 69, inset: 3.5,
      labelY: 99,
      stars: [[50, 46, 1.5], [50, 24, 1], [69.1, 35, 1], [69.1, 57, 1], [50, 68, 1], [30.9, 57, 1], [30.9, 35, 1], [50, 6, 1.3], [84.6, 26, 1.1], [84.6, 66, 1.2], [50, 86, 1.1], [15.4, 66, 1.2], [15.4, 26, 1.1]],
      lines: [[0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]]
    },
    {
      id: 'opentelemetry',
      name: 'OpenTelemetry',
      side: 'right', top: 84, inset: 2,
      labelY: 99,
      stars: [[15, 59, 1.1], [21, 69, 1], [81, 31, 1.3], [75, 21, 1.1], [51, 50, 1], [51, 58, 1.2], [36, 90, 1], [51, 92, 1], [66, 90, 1]],
      lines: [[0, 1], [1, 4], [4, 2], [2, 3], [3, 0], [4, 5], [5, 6], [5, 7], [5, 8]]
    }
  ];

  function constellationSvg(constellation, index) {
    var stars = constellation.stars;
    var lines = constellation.lines.map(function (line, i) {
      var from = stars[line[0]];
      var to = stars[line[1]];
      return '<path d="M' + from[0] + ' ' + from[1] + 'L' + to[0] + ' ' + to[1] + '" pathLength="1" style="--i:' + i + '"/>';
    }).join('');
    var dots = stars.map(function (star) {
      return '<circle cx="' + star[0] + '" cy="' + star[1] + '" r="' + star[2] + '"/>';
    }).join('');

    return '<svg class="landscape-scene__constellation" viewBox="0 0 100 100" style="top:' + constellation.top + 'vh;' +
      constellation.side + ':' + constellation.inset + 'vw;--c:' + index + '">' +
      '<rect width="100" height="100" fill="none" pointer-events="all"/>' + lines + dots +
      '<text x="50" y="' + constellation.labelY + '" text-anchor="middle">' + constellation.name + '</text></svg>';
  }

  // Clouds share three shapes. `rest` is where each one sits when motion is reduced;
  // `wide` ones are left out on phones.
  var clouds = [
    { layer: 'far', shape: 'b', top: '4.5rem', width: '7rem', drift: 95, delay: -20, rest: 8 },
    { layer: 'far', shape: 'a', top: '10rem', width: '5.5rem', drift: 110, delay: -70, rest: 62, mirror: true, wide: true },
    { layer: 'far', shape: 'c', top: '44vh', width: '6rem', drift: 120, delay: -40, rest: 84, wide: true },
    { layer: 'mid', shape: 'a', top: '7rem', width: '10rem', drift: 70, delay: -10, rest: 30 },
    { layer: 'mid', shape: 'c', top: '14rem', width: '11rem', drift: 80, delay: -48, rest: 74, mirror: true },
    { layer: 'mid', shape: 'b', top: '60vh', width: '12rem', drift: 85, delay: -30, rest: 6, wide: true },
    { layer: 'near', shape: 'a', bottom: '9vh', width: '18rem', drift: 60, delay: -25, rest: 58, mirror: true },
    { layer: 'near', shape: 'b', bottom: '24vh', width: '15rem', drift: 66, delay: -55, rest: 80, wide: true },
    { layer: 'near', shape: 'c', bottom: '2vh', width: '22rem', drift: 75, delay: -5, rest: 2 }
  ];

  // A V of five birds and a looser, farther flock of three. Birds are [x, y] in rem inside the flock.
  var flocks = [
    { layer: 'mid', top: '4.2rem', drift: 52, delay: -14, rest: 38, birds: [[4.6, 1.3], [3.3, 0.6], [2, 0], [3.3, 2], [2, 2.7]] },
    { layer: 'far', top: '9.5rem', drift: 74, delay: -50, rest: 70, far: true, wide: true, birds: [[2.2, 0.8], [1, 0.2], [0.6, 1.5]] }
  ];

  function cloudSvg(cloud) {
    var place = cloud.top ? 'top:' + cloud.top : 'bottom:' + cloud.bottom;
    return '<svg class="landscape-scene__cloud' + (cloud.wide ? ' landscape-scene__wide-only' : '') + '" viewBox="0 0 200 100" style="' +
      place + ';width:' + cloud.width + ';--drift:' + cloud.drift + 's;--delay:' + cloud.delay + 's;--rest-x:' + cloud.rest + 'vw">' +
      '<use href="#scene-cloud-' + cloud.shape + '"' + (cloud.mirror ? ' transform="matrix(-1 0 0 1 200 0)"' : '') + '/></svg>';
  }

  function flockHtml(flock) {
    var birds = flock.birds.map(function (bird, i) {
      return '<span class="landscape-scene__bird" style="--x:' + bird[0] + 'rem;--y:' + bird[1] + 'rem;--flap-delay:-' + (i * 0.19).toFixed(2) + 's"></span>';
    }).join('');
    return '<div class="landscape-scene__flock' + (flock.far ? ' landscape-scene__flock--far' : '') + (flock.wide ? ' landscape-scene__wide-only' : '') +
      '" style="top:' + flock.top + ';--drift:' + flock.drift + 's;--delay:' + flock.delay + 's;--rest-x:' + flock.rest + 'vw">' + birds + '</div>';
  }

  function sceneLayer(name) {
    var content = clouds.filter(function (cloud) { return cloud.layer === name; }).map(cloudSvg).join('') +
      flocks.filter(function (flock) { return flock.layer === name; }).map(flockHtml).join('');
    return '<div class="landscape-scene__layer landscape-scene__layer--' + name + '">' + content + '</div>';
  }

  var cloudDefs = `<svg class="landscape-scene__defs" width="0" height="0" focusable="false">
  <defs>
    <linearGradient id="scene-cloud-fill" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="90">
      <stop offset="0.35" class="landscape-scene__cloud-light"/>
      <stop offset="1" class="landscape-scene__cloud-shade"/>
    </linearGradient>
    <symbol id="scene-cloud-a" viewBox="0 0 200 100">
      <g fill="url(#scene-cloud-fill)"><rect x="18" y="58" width="164" height="30" rx="15"/><circle cx="58" cy="60" r="26"/><circle cx="98" cy="44" r="34"/><circle cx="142" cy="56" r="26"/></g>
    </symbol>
    <symbol id="scene-cloud-b" viewBox="0 0 200 100">
      <g fill="url(#scene-cloud-fill)"><rect x="10" y="62" width="180" height="26" rx="13"/><circle cx="42" cy="64" r="18"/><circle cx="76" cy="50" r="26"/><circle cx="116" cy="46" r="30"/><circle cx="154" cy="60" r="20"/></g>
    </symbol>
    <symbol id="scene-cloud-c" viewBox="0 0 200 100">
      <g fill="url(#scene-cloud-fill)"><rect x="30" y="60" width="140" height="28" rx="14"/><circle cx="70" cy="54" r="28"/><circle cx="118" cy="40" r="36"/><circle cx="150" cy="64" r="18"/></g>
    </symbol>
  </defs>
</svg>`;

  if (currentScript) {
    var random = seededRandom(7);
    var meteors = '';
    for (var i = 1; i <= 7; i++) {
      meteors += '<span class="landscape-scene__shooting-star landscape-scene__shooting-star--' + i + '"></span>';
    }

    currentScript.insertAdjacentHTML('beforebegin', `
<button class="landscape-scene__toggle" id="theme-toggle" type="button" aria-label="${labels.generic}" title="${labels.generic}">
  <span class="landscape-scene__sun"></span>
  <span class="landscape-scene__moon">${moonSvg(new Date())}</span>
</button>
<span class="landscape-scene__hint" aria-hidden="true"></span>
<div class="landscape-scene" aria-hidden="true">
  <div class="landscape-scene__glow landscape-scene__glow--day"></div>
  <div class="landscape-scene__glow landscape-scene__glow--night"></div>
  <div class="landscape-scene__layer landscape-scene__layer--sky">
    ${starLayers(random)}${twinkles(random)}
    <div class="landscape-scene__aurora"></div>
    ${constellations.map(constellationSvg).join('')}
  </div>
  <div class="landscape-scene__meteors">${meteors}</div>
  ${sceneLayer('far')}
  ${sceneLayer('mid')}
  ${sceneLayer('near')}
  ${cloudDefs}
  <div class="landscape-scene__preview"></div>
</div>`);
  }

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    var toggle = document.getElementById('theme-toggle');
    var hint = document.querySelector('.landscape-scene__hint');
    var downloadLink = document.getElementById('resume-download');

    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(isDark ? 'theme-dark' : 'theme-light');

    if (toggle) {
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? labels.light : labels.dark);
      toggle.setAttribute('title', isDark ? labels.light : labels.dark);
    }

    if (hint) {
      hint.textContent = isDark ? labels.hintNight : labels.hintDay;
    }

    if (downloadLink) {
      downloadLink.setAttribute('href', isDark ? 'resume-dark.pdf' : 'resume.pdf');
      downloadLink.setAttribute('download', isDark ? 'diego-sierra-resume-dark.pdf' : 'diego-sierra-resume.pdf');
      downloadLink.textContent = 'Download PDF';
    }

    // The embed URL lives in data-src so the iframe loads once, already in the right theme.
    var spotifyFrame = document.querySelector('.music-embed-frame');
    if (spotifyFrame) {
      var themedSrc = spotifyFrame.getAttribute('data-src') + '&theme=' + (isDark ? '0' : '1');
      if (spotifyFrame.getAttribute('src') !== themedSrc) {
        spotifyFrame.setAttribute('src', themedSrc);
      }
    }
  }

  // The sky goes through a sunset or a sunrise on its way to the new theme (sky-dusk and
  // sky-dawn in style.css). Only on a switch: a page load starts at the final colors.
  function playSkyTransition(isDark) {
    var scene = document.querySelector('.landscape-scene');
    if (!scene) {
      return;
    }

    scene.classList.remove('landscape-scene--dusk', 'landscape-scene--dawn');
    void scene.offsetWidth; // restart the animation when switching again halfway through
    scene.classList.add(isDark ? 'landscape-scene--dusk' : 'landscape-scene--dawn');
  }

  function switchTheme(theme) {
    applyTheme(theme);
    playSkyTransition(theme === 'dark');
  }

  function initThemeToggle() {
    var toggle = document.getElementById('theme-toggle');
    var scene = document.querySelector('.landscape-scene');
    var currentTheme = root.classList.contains('theme-dark') ? 'dark' : 'light';

    applyTheme(currentTheme);

    if (scene) {
      scene.addEventListener('animationend', function (event) {
        if (event.target === scene) {
          scene.classList.remove('landscape-scene--dusk', 'landscape-scene--dawn');
        }
      });
    }

    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', function () {
      currentTheme = root.classList.contains('theme-dark') ? 'light' : 'dark';

      try {
        localStorage.setItem('theme-preference', currentTheme);
        localStorage.setItem('sun-clicked', '1');
      } catch (error) {}

      // is-switching holds back the hover preview of the next switch until the pointer leaves.
      toggle.classList.add('has-clicked', 'is-switching');
      switchTheme(currentTheme);
    });

    toggle.addEventListener('pointerleave', function () {
      toggle.classList.remove('is-switching');
    });

    try {
      if (localStorage.getItem('sun-clicked')) {
        toggle.classList.add('has-clicked');
      }
    } catch (error) {}

    // The label pointing at the sun shows once per visit, until the sun is first clicked.
    var hint = document.querySelector('.landscape-scene__hint');
    var hintShown = false;
    try {
      hintShown = !!sessionStorage.getItem('sun-hint-shown');
      sessionStorage.setItem('sun-hint-shown', '1');
    } catch (error) {}
    if (hint && !hintShown && !toggle.classList.contains('has-clicked')) {
      hint.classList.add('landscape-scene__hint--visible');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle, { once: true });
  } else {
    initThemeToggle();
  }
})();
