(function () {
  var CALENDLY_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';
  var CALENDLY_STYLESHEET = 'https://assets.calendly.com/assets/external/widget.css';
  var MATTER_SCRIPT = 'js/vendor/matter.min.js';

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

  // The links are a physics toy: they pile up in a box, can be dragged and thrown, the chaos
  // monkey knocks them over, and Sync puts each one back in its place like a GitOps
  // controller would. Without Matter.js, or with reduced motion, they stay a wrapped list.
  function initLinkLab() {
    var lab = document.querySelector('.link-lab');
    if (!lab || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window) || !('ResizeObserver' in window)) {
      return;
    }

    var matterLoading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = MATTER_SCRIPT;
      script.async = true;
      script.onload = function () {
        if (window.Matter) {
          resolve(window.Matter);
        } else {
          reject(new Error('Matter.js unavailable'));
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Pill widths depend on the web font, so measure them once it has loaded.
    Promise.all([matterLoading, document.fonts ? document.fonts.ready : null]).then(function (loaded) {
      startLinkLab(lab, loaded[0]);
    }).catch(function () {});
  }

  function startLinkLab(lab, Matter) {
    var Bodies = Matter.Bodies;
    var Body = Matter.Body;
    var Composite = Matter.Composite;
    var Constraint = Matter.Constraint;
    var Engine = Matter.Engine;
    var Events = Matter.Events;
    var Sleeping = Matter.Sleeping;

    var STEP = 1000 / 60;
    var INSET = 6;
    var GAP = 10;
    var SUPPORT_MARGIN = 16;
    var MIN_HEIGHT = 240;
    var HEADROOM = 120;
    var WALL = 200;
    var MAX_SPEED = 32;
    var DRAG_THRESHOLD = 6;
    var STATES = { synced: 'Synced', 'out-of-sync': 'OutOfSync', syncing: 'Syncing' };

    var arena = lab.querySelector('.link-lab__arena');
    var bar = lab.querySelector('.link-lab__bar');
    var stateLabel = lab.querySelector('.link-lab__state');
    var detailLabel = lab.querySelector('.link-lab__detail');
    var clock = lab.querySelector('.link-lab__clock');
    var chaosButton = lab.querySelector('[data-lab-action="chaos"]');
    var syncButton = lab.querySelector('[data-lab-action="sync"]');

    var engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1.2;

    var pills = Array.prototype.map.call(arena.querySelectorAll('.link-pill'), function (el) {
      var box = el.getBoundingClientRect();
      var body = Bodies.rectangle(0, 0, box.width, box.height, {
        chamfer: { radius: box.height * 0.3 },
        density: 0.0015,
        friction: 0.5,
        frictionStatic: 0.9,
        frictionAir: 0.015,
        restitution: 0.3
      });
      el.setAttribute('draggable', 'false');
      Composite.add(engine.world, body);
      return { el: el, width: box.width, height: box.height, body: body, target: null };
    });

    var width = 0;
    var height = 0;
    var walls = [];
    var state = 'synced';
    var incidentStart = 0;
    var clockTimer = 0;
    var animation = null;
    var drag = null;
    var lastDragEnd = 0;
    var entered = false;
    var visible = false;
    var frameId = 0;
    var lastTime = 0;
    var pending = 0;

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function lerp(from, to, t) {
      return from + (to - from) * t;
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Rows are filled from the last link backwards, so the first links end up on top, and a
    // row only takes a pill if every pill in it still has its middle over the row below.
    function stackRows(maxWidth) {
      var rows = [];
      var row = null;

      for (var i = pills.length - 1; i >= 0; i--) {
        var pill = pills[i];
        if (row) {
          var below = rows[rows.length - 1];
          var rowWidth = row.width + GAP + pill.width;
          var overhang = rowWidth - Math.min(pill.width, row.items[row.items.length - 1].width);
          if (rowWidth <= maxWidth && (!below || overhang <= below.width - 2 * SUPPORT_MARGIN)) {
            row.items.unshift(pill);
            row.width = rowWidth;
            continue;
          }
          rows.push(row);
        }
        row = { items: [pill], width: pill.width };
      }
      rows.push(row);

      return rows;
    }

    // Sizes the arena to the pile and works out where each pill sits when everything is in sync.
    function layout() {
      width = arena.clientWidth;
      var rows = stackRows(width - 2 * INSET);
      var rowHeights = rows.map(function (row) {
        return Math.max.apply(null, row.items.map(function (pill) { return pill.height; }));
      });
      var pileHeight = rowHeights.reduce(function (sum, rowHeight) { return sum + rowHeight; }, 0);

      height = Math.round(Math.max(MIN_HEIGHT, pileHeight + HEADROOM) + INSET);
      arena.style.height = height + 'px';

      var y = height - INSET;
      rows.forEach(function (row, index) {
        var x = (width - row.width) / 2;
        row.items.forEach(function (pill) {
          pill.target = { x: x + pill.width / 2, y: y - rowHeights[index] / 2 };
          x += pill.width + GAP;
        });
        y -= rowHeights[index];
      });

      Composite.remove(engine.world, walls);
      walls = [
        Bodies.rectangle(width / 2, height - INSET + WALL / 2, width + 2 * WALL, WALL, { isStatic: true, friction: 0.6 }),
        Bodies.rectangle(width / 2, INSET - WALL / 2, width + 2 * WALL, WALL, { isStatic: true }),
        Bodies.rectangle(INSET - WALL / 2, height / 2, WALL, height + 2 * WALL, { isStatic: true }),
        Bodies.rectangle(width - INSET + WALL / 2, height / 2, WALL, height + 2 * WALL, { isStatic: true })
      ];
      Composite.add(engine.world, walls);
    }

    function place(pill, x, y, angle) {
      Body.setPosition(pill.body, { x: x, y: y });
      Body.setAngle(pill.body, angle);
      Body.setVelocity(pill.body, { x: 0, y: 0 });
      Body.setAngularVelocity(pill.body, 0);
    }

    function settle() {
      pills.forEach(function (pill) {
        place(pill, pill.target.x, pill.target.y, 0);
        Sleeping.set(pill.body, true);
      });
    }

    function render() {
      pills.forEach(function (pill) {
        var body = pill.body;
        pill.el.style.transform = 'translate(' + (body.position.x - pill.width / 2).toFixed(2) + 'px, ' +
          (body.position.y - pill.height / 2).toFixed(2) + 'px) rotate(' + body.angle.toFixed(4) + 'rad)';
      });
    }

    function formatClock(ms) {
      var seconds = Math.floor(ms / 1000);
      return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }

    function setState(next, detail) {
      state = next;
      lab.setAttribute('data-state', next);
      stateLabel.textContent = STATES[next];
      detailLabel.textContent = detail;
      syncButton.disabled = next !== 'out-of-sync';
      chaosButton.disabled = next === 'syncing';

      window.clearInterval(clockTimer);
      clock.hidden = next !== 'out-of-sync';
      if (next === 'out-of-sync') {
        var tick = function () {
          clock.textContent = formatClock(performance.now() - incidentStart);
        };
        tick();
        clockTimer = window.setInterval(tick, 1000);
      }
    }

    function breakSync() {
      if (state !== 'synced') {
        return;
      }
      incidentStart = performance.now();
      setState('out-of-sync', 'The links drifted from the desired state.');
    }

    // Moves every pill to its place, bottom row first, without simulating the trip there.
    // The entrance drops them in from above; a sync flies them over from wherever they are.
    function reconcile(entrance) {
      var start = performance.now();
      var order = pills.slice().sort(function (a, b) {
        return b.target.y - a.target.y || a.target.x - b.target.x;
      });

      animation = order.map(function (pill, index) {
        var body = pill.body;
        var from = entrance
          ? { x: pill.target.x, y: -pill.height, angle: 0 }
          : { x: body.position.x, y: body.position.y, angle: Math.atan2(Math.sin(body.angle), Math.cos(body.angle)) };
        var distance = Math.hypot(pill.target.x - from.x, pill.target.y - from.y);

        return {
          pill: pill,
          from: from,
          start: start + index * (entrance ? 90 : 60),
          duration: entrance ? 650 : 700,
          lift: entrance ? 0 : Math.min(48, distance * 0.35),
          drop: entrance
        };
      });

      if (drag) {
        Composite.remove(engine.world, drag.constraint);
        drag.pill.el.classList.remove('is-grabbed');
        drag = null;
      }
      setState('syncing', entrance ? 'Deploying the links.' : 'Putting every link back in its place.');
      run();
    }

    function animate(now) {
      var done = true;

      animation.forEach(function (step) {
        var t = clamp((now - step.start) / step.duration, 0, 1);
        var to = step.pill.target;
        done = done && t === 1;

        if (step.drop) {
          // Falls with gravity-like acceleration, then a small bounce on landing.
          var fall = t < 0.8 ? Math.pow(t / 0.8, 2) : 1;
          var bounce = t < 0.8 ? 0 : Math.sin(Math.PI * (t - 0.8) / 0.2) * 10;
          place(step.pill, to.x, lerp(step.from.y, to.y, fall) - bounce, 0);
        } else {
          var eased = easeInOutCubic(t);
          place(step.pill,
            lerp(step.from.x, to.x, eased),
            lerp(step.from.y, to.y, eased) - Math.sin(Math.PI * eased) * step.lift,
            lerp(step.from.angle, 0, eased));
        }
      });

      if (!done) {
        return;
      }

      var wasEntrance = animation[0].drop;
      animation = null;
      settle();
      if (wasEntrance) {
        setState('synced', 'Grab a link and throw it.');
      } else {
        setState('synced', 'MTTR ' + ((performance.now() - incidentStart) / 1000).toFixed(1) + 's. Break it again?');
      }
    }

    function frame(now) {
      frameId = 0;
      if (animation) {
        animate(now);
      } else {
        pending += clamp(now - lastTime, 0, 100);
        while (pending >= STEP) {
          Engine.update(engine, STEP);
          pending -= STEP;
        }
      }
      lastTime = now;
      render();

      // Stop once everything is asleep; the next interaction starts the loop again.
      if (animation || drag || pills.some(function (pill) { return !pill.body.isSleeping; })) {
        run();
      }
    }

    function run() {
      if (!frameId && visible) {
        if (!lastTime || performance.now() - lastTime > 100) {
          lastTime = performance.now();
          pending = 0;
        }
        frameId = window.requestAnimationFrame(frame);
      }
    }

    // A hard throw could otherwise tunnel through a wall.
    Events.on(engine, 'beforeUpdate', function () {
      pills.forEach(function (pill) {
        var velocity = pill.body.velocity;
        var speed = Math.hypot(velocity.x, velocity.y);
        if (speed > MAX_SPEED) {
          Body.setVelocity(pill.body, { x: velocity.x / speed * MAX_SPEED, y: velocity.y / speed * MAX_SPEED });
        }
      });
    });

    function arenaPoint(event) {
      var box = arena.getBoundingClientRect();
      return {
        x: clamp(event.clientX - box.left - arena.clientLeft, INSET, width - INSET),
        y: clamp(event.clientY - box.top - arena.clientTop, INSET, height - INSET)
      };
    }

    function endDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      Composite.remove(engine.world, drag.constraint);
      drag.pill.el.classList.remove('is-grabbed');
      if (drag.moved) {
        lastDragEnd = performance.now();
      }
      drag = null;
    }

    arena.addEventListener('pointerdown', function (event) {
      var el = event.target.closest('.link-pill');
      if (!el || animation || drag || event.button !== 0) {
        return;
      }

      var pill = pills.filter(function (candidate) { return candidate.el === el; })[0];
      var point = arenaPoint(event);
      Sleeping.set(pill.body, false);
      drag = {
        pill: pill,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        constraint: Constraint.create({
          pointA: point,
          bodyB: pill.body,
          pointB: { x: point.x - pill.body.position.x, y: point.y - pill.body.position.y },
          length: 0,
          stiffness: 0.2,
          damping: 0.1,
          angularStiffness: 0
        })
      };
      Composite.add(engine.world, drag.constraint);
      try {
        el.setPointerCapture(event.pointerId);
      } catch (error) {}
      run();
    });

    arena.addEventListener('pointermove', function (event) {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      var point = arenaPoint(event);
      drag.constraint.pointA.x = point.x;
      drag.constraint.pointA.y = point.y;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > DRAG_THRESHOLD) {
        drag.moved = true;
        drag.pill.el.classList.add('is-grabbed');
        breakSync();
      }
      run();
    });

    arena.addEventListener('pointerup', endDrag);
    arena.addEventListener('pointercancel', endDrag);
    arena.addEventListener('lostpointercapture', endDrag);
    arena.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    // Letting go of a thrown link fires a click on it: don't follow the link (or open Calendly).
    arena.addEventListener('click', function (event) {
      if (performance.now() - lastDragEnd < 400 && event.target.closest('.link-pill')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    chaosButton.addEventListener('click', function () {
      if (animation) {
        return;
      }
      pills.forEach(function (pill) {
        Sleeping.set(pill.body, false);
        Body.setVelocity(pill.body, { x: lerp(-12, 12, Math.random()), y: lerp(-20, -10, Math.random()) });
        Body.setAngularVelocity(pill.body, lerp(-0.3, 0.3, Math.random()));
      });
      breakSync();
      run();
    });

    syncButton.addEventListener('click', function () {
      if (!animation && state === 'out-of-sync') {
        reconcile(false);
      }
    });

    new ResizeObserver(function () {
      if (arena.clientWidth === width) {
        return;
      }

      var oldHeight = height;
      layout();
      if (!entered) {
        pills.forEach(function (pill) {
          place(pill, pill.target.x, -pill.height, 0);
        });
      } else if (state === 'synced') {
        settle();
      } else if (!animation) {
        // Keep the pile on the floor and every pill inside the new walls.
        pills.forEach(function (pill) {
          var body = pill.body;
          var reach = Math.max(pill.width, pill.height) / 2 + INSET;
          Body.setPosition(body, {
            x: clamp(body.position.x, reach, width - reach),
            y: clamp(body.position.y + height - oldHeight, reach, height - reach)
          });
          Sleeping.set(body, false);
        });
      }
      render();
      run();
    }).observe(arena);

    new IntersectionObserver(function (entries) {
      var entry = entries[entries.length - 1];
      visible = entry.isIntersecting;
      if (visible && !entered && entry.intersectionRatio >= 0.35) {
        entered = true;
        reconcile(true);
      }
      run();
    }, { threshold: [0, 0.35] }).observe(arena);

    layout();
    pills.forEach(function (pill) {
      place(pill, pill.target.x, -pill.height, 0);
      Sleeping.set(pill.body, true);
    });
    render();
    lab.classList.add('is-live');
    bar.hidden = false;
  }

  initHeroVideo();
  initCalendlyLinks();
  initLinkLab();
})();
