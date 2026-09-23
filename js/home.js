(function () {
  var CALENDLY_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';
  var CALENDLY_STYLESHEET = 'https://assets.calendly.com/assets/external/widget.css';

  // The portrait video only plays for visitors who haven't asked for reduced motion.
  function initHeroVideo() {
    var video = document.querySelector('.avatar--video');
    if (!video || !window.matchMedia) {
      return;
    }

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function syncPlayback() {
      if (reducedMotion.matches) {
        video.pause();
        return;
      }

      var playback = video.play();
      if (playback && playback.catch) {
        playback.catch(function () {});
      }
    }

    syncPlayback();
    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener('change', syncPlayback);
    }
  }

  // Calendly's widget is only downloaded once someone shows interest in booking a call.
  function initCalendlyLinks() {
    var bookCallLinks = document.querySelectorAll('a[data-calendly-url]');
    var calendlyLoading = null;

    function loadCalendly() {
      if (!calendlyLoading) {
        calendlyLoading = new Promise(function (resolve, reject) {
          var stylesheet = document.createElement('link');
          stylesheet.rel = 'stylesheet';
          stylesheet.href = CALENDLY_STYLESHEET;
          document.head.appendChild(stylesheet);

          var script = document.createElement('script');
          script.src = CALENDLY_SCRIPT;
          script.async = true;
          script.onload = function () {
            if (window.Calendly && window.Calendly.initPopupWidget) {
              resolve(window.Calendly);
            } else {
              reject(new Error('Calendly widget unavailable'));
            }
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      return calendlyLoading;
    }

    Array.prototype.forEach.call(bookCallLinks, function (bookCallLink) {
      var calendlyUrl = bookCallLink.getAttribute('data-calendly-url');

      bookCallLink.addEventListener('pointerenter', loadCalendly, { once: true });
      bookCallLink.addEventListener('focus', loadCalendly, { once: true });

      bookCallLink.addEventListener('click', function (event) {
        // Let modified clicks (new tab, new window) behave like a normal link.
        if (!calendlyUrl || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        loadCalendly().then(function (Calendly) {
          Calendly.initPopupWidget({ url: calendlyUrl });
        }).catch(function () {
          window.open(bookCallLink.href, '_blank', 'noopener');
        });
      });
    });
  }

  initHeroVideo();
  initCalendlyLinks();
})();
