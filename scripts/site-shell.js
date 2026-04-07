(function () {
  var root = document.documentElement;
  var lang = (root.lang || 'en').toLowerCase();
  var isSpanish = lang.indexOf('es') === 0;
  var labels = isSpanish
    ? {
        generic: 'Cambiar tema',
        light: 'Cambiar a tema claro',
        dark: 'Cambiar a tema oscuro'
      }
    : {
        generic: 'Switch theme',
        light: 'Switch to light theme',
        dark: 'Switch to dark theme'
      };
  var currentScript = document.currentScript;

  if (currentScript) {
    currentScript.insertAdjacentHTML('beforebegin', `
<button class="landscape-scene__sun" id="theme-toggle" type="button" aria-label="${labels.generic}" title="${labels.generic}"></button>
<div class="landscape-scene" aria-hidden="true">
  <div class="landscape-scene__cloud landscape-scene__cloud--1"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--2"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--3"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--4"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--5"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--6"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--7"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--8"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--9"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--10"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--11"></div>
  <div class="landscape-scene__cloud landscape-scene__cloud--12"></div>
  <div class="landscape-scene__birds landscape-scene__birds--1"></div>
  <div class="landscape-scene__birds landscape-scene__birds--2"></div>
  <div class="landscape-scene__birds landscape-scene__birds--3"></div>
  <div class="landscape-scene__birds landscape-scene__birds--4"></div>
  <div class="landscape-scene__birds landscape-scene__birds--5"></div>
  <div class="landscape-scene__birds landscape-scene__birds--6"></div>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--1"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--2"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--3"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--4"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--5"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--6"></span>
  <span class="landscape-scene__shooting-star landscape-scene__shooting-star--7"></span>
</div>`);
  }

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    var toggle = document.getElementById('theme-toggle');
    var downloadLink = document.getElementById('resume-download');

    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(isDark ? 'theme-dark' : 'theme-light');

    if (toggle) {
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? labels.light : labels.dark);
      toggle.setAttribute('title', isDark ? labels.light : labels.dark);
    }

    if (downloadLink) {
      downloadLink.setAttribute('href', isDark ? 'resume-dark.pdf' : 'resume.pdf');
      downloadLink.setAttribute('download', isDark ? 'diego-sierra-resume-dark.pdf' : 'diego-sierra-resume.pdf');
      downloadLink.textContent = 'Download PDF';
    }

    var spotifyFrame = document.querySelector('.music-embed-frame');
    if (spotifyFrame) {
      var src = spotifyFrame.getAttribute('src');
      var newSrc = src.replace(/theme=[01]/, 'theme=' + (isDark ? '0' : '1'));
      if (src !== newSrc) {
        spotifyFrame.setAttribute('src', newSrc);
      }
    }
  }

  function initThemeToggle() {
    var toggle = document.getElementById('theme-toggle');
    var currentTheme = root.classList.contains('theme-dark') ? 'dark' : 'light';

    applyTheme(currentTheme);

    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', function () {
      currentTheme = root.classList.contains('theme-dark') ? 'light' : 'dark';

      try {
        localStorage.setItem('theme-preference', currentTheme);
        localStorage.setItem('sun-clicked', '1');
      } catch (error) {}

      toggle.classList.add('has-clicked');
      applyTheme(currentTheme);
    });

    try {
      if (localStorage.getItem('sun-clicked')) {
        toggle.classList.add('has-clicked');
      }
    } catch (error) {}

    try {
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      if (mql.addEventListener) {
        mql.addEventListener('change', function (e) {
          var hasManualPref = false;
          try { hasManualPref = !!localStorage.getItem('theme-preference'); } catch (err) {}
          if (!hasManualPref) {
            currentTheme = e.matches ? 'dark' : 'light';
            applyTheme(currentTheme);
          }
        });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle, { once: true });
  } else {
    initThemeToggle();
  }
})();
