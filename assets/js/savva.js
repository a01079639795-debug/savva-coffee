/* ============================================================================
   SAVVA — interaction layer.
   No dependencies. Every enhancement degrades to a readable page without it,
   and every motion path is switched off under prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  // The folder this script was served from, so the files fetched later resolve
  // wherever the site is published — a domain root or a project path.
  var ASSETS = document.currentScript ? new URL('..', document.currentScript.src).href : '/assets/';

  // the <head> already flipped no-js → js before first paint; this is a safety
  // net for anything that reached the body without it
  document.documentElement.classList.add('js');
  document.documentElement.classList.remove('no-js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isReduced = function () { return reduce.matches; };
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  // matches the desktop split in the stylesheet — below it, scroll-jacking
  // sections (the signature carousel) hand off to touch instead
  var narrow = window.matchMedia('(max-width: 61.9375rem)');

  // A device that told us it is modest gets the same composition with the
  // per-frame filters and blended overlays dropped — see `.lite` in the CSS.
  if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4)) {
    document.documentElement.classList.add('lite');
  }

  var clamp01 = function (n) { return n < 0 ? 0 : n > 1 ? 1 : n; };
  var ramp = function (v, a, b) { return clamp01((v - a) / (b - a)); };

  /* Tilts an element towards the pointer over a reference box, and lets go when
     the pointer leaves. Used by the cup. */
  function tiltOn(area, target, ax, ay, onState) {
    if (!fine.matches) return;
    area.addEventListener('pointermove', function (e) {
      if (isReduced() || (onState && !onState())) return;
      var b = area.getBoundingClientRect();
      var nx = (e.clientX - b.left) / b.width - .5;
      var ny = (e.clientY - b.top) / b.height - .5;
      target.style.setProperty('--ry', (nx * ax).toFixed(2) + 'deg');
      target.style.setProperty('--rx', (-ny * ay).toFixed(2) + 'deg');
      target.style.setProperty('--mx', ((nx + .5) * 100).toFixed(1) + '%');
      target.style.setProperty('--my', ((ny + .5) * 100).toFixed(1) + '%');
      area.classList.add('is-tilting');
    });
    area.addEventListener('pointerleave', function () {
      target.style.setProperty('--ry', '0deg');
      target.style.setProperty('--rx', '0deg');
      area.classList.remove('is-tilting');
    });
  }

  /* --- Navigation -------------------------------------------------------- */
  var nav = document.querySelector('[data-nav]');
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel = document.querySelector('[data-nav-panel]');

  if (nav) {
    var stuck = false;
    var syncNav = function () {
      var next = window.scrollY > window.innerHeight * 0.72;
      if (next !== stuck) { stuck = next; nav.classList.toggle('is-stuck', stuck); }
    };
    syncNav();
    window.addEventListener('scroll', syncNav, { passive: true });
  }

  if (toggle && panel && nav) {
    var hideTimer = 0;
    var openNav = function (open) {
      window.clearTimeout(hideTimer);
      if (open) {
        panel.hidden = false;
        void panel.offsetHeight; // flush layout so the clip-path animates in
      }
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (!open) {
        hideTimer = window.setTimeout(function () {
          if (!nav.classList.contains('is-open')) panel.hidden = true;
        }, 700);
      }
    };
    toggle.addEventListener('click', function () {
      openNav(toggle.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) openNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { openNav(false); toggle.focus(); }
    });
  }

  /* --- Reveals ----------------------------------------------------------- */
  var revealTargets = document.querySelectorAll('.reveal, [data-lines]');

  Array.prototype.forEach.call(document.querySelectorAll('[data-lines]'), function (h) {
    Array.prototype.forEach.call(h.querySelectorAll('.line__in'), function (l, i) {
      l.style.setProperty('--li', i);
    });
  });

  if ('IntersectionObserver' in window && revealTargets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(revealTargets, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(revealTargets, function (el) { el.classList.add('is-in'); });
  }

  /* --- Menu categories --------------------------------------------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
  var cats = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'));

  function selectCat(id, focus) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    cats.forEach(function (c) {
      var on = c.dataset.cat === id;
      c.classList.toggle('is-active', on);
      c.hidden = !on;
    });
  }

  if (tabs.length) {
    // the markup ships every category open so the page reads without JS;
    // taking control here is what makes the panels a real tab set
    selectCat(tabs[0].dataset.tab);
    tabs.forEach(function (t, i) {
      t.tabIndex = i === 0 ? 0 : -1;
      t.addEventListener('click', function () { selectCat(t.dataset.tab); });
      t.addEventListener('keydown', function (e) {
        var rtl = document.dir === 'rtl';
        var step = e.key === 'ArrowRight' ? (rtl ? -1 : 1)
          : e.key === 'ArrowLeft' ? (rtl ? 1 : -1)
            : e.key === 'Home' ? -Infinity
              : e.key === 'End' ? Infinity : 0;
        if (!step) return;
        e.preventDefault();
        var next = step === -Infinity ? 0
          : step === Infinity ? tabs.length - 1
            : (i + step + tabs.length) % tabs.length;
        selectCat(tabs[next].dataset.tab, true);
      });
    });
  }

  /* --- Signature scroll sequence ----------------------------------------- */
  var pour = document.querySelector('[data-pour]');
  var frames = pour ? Array.prototype.slice.call(pour.querySelectorAll('[data-frame]')) : [];
  var slides = pour ? Array.prototype.slice.call(pour.querySelectorAll('[data-slide]')) : [];
  var dots = pour ? Array.prototype.slice.call(pour.querySelectorAll('[data-dot]')) : [];
  var current = -1;

  function setPour(i) {
    if (i === current) return;
    current = i;
    // the stage takes the colour of the drink in the arch
    if (frames[i]) pour.style.setProperty('--stage', frames[i].style.getPropertyValue('--tone'));
    frames.forEach(function (f, n) { f.classList.toggle('is-active', n === i); });
    dots.forEach(function (d, n) { d.classList.toggle('is-active', n === i); });
    slides.forEach(function (s, n) {
      var on = n === i;
      s.classList.toggle('is-active', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
  }

  function updatePour() {
    // below the desktop split the carousel no longer pins to a scroll track —
    // its slide is set by swipe instead, see below
    if (!pour || !frames.length || narrow.matches) return;
    var box = pour.getBoundingClientRect();
    var travel = box.height - window.innerHeight;
    if (travel <= 0) { setPour(0); return; }
    var p = Math.min(1, Math.max(0, -box.top / travel));
    setPour(Math.min(frames.length - 1, Math.floor(p * frames.length * 0.999)));
  }

  // below the desktop split, a left/right swipe over the photo steps through
  // the drinks directly — no more scrolling the page to flip the carousel.
  // The gesture's direction is locked on the first real movement, and only
  // then does a horizontal drag call preventDefault — otherwise iOS treats
  // the whole touch as a page scroll and the carousel never sees a touchend.
  if (pour && frames.length > 1) {
    var pourTouch = null, pourLock = null;
    var pourMedia = pour.querySelector('.pour__media');
    pourMedia.addEventListener('touchstart', function (e) {
      if (!narrow.matches) return;
      var p = e.touches[0];
      pourTouch = { x: p.clientX, y: p.clientY };
      pourLock = null;
    }, { passive: true });
    pourMedia.addEventListener('touchmove', function (e) {
      if (!pourTouch) return;
      var p = e.touches[0];
      var dx = p.clientX - pourTouch.x, dy = p.clientY - pourTouch.y;
      if (pourLock === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        pourLock = Math.abs(dx) > Math.abs(dy);
      }
      if (pourLock) e.preventDefault();
    }, { passive: false });
    pourMedia.addEventListener('touchend', function (e) {
      if (!pourTouch) return;
      var p = e.changedTouches[0];
      var dx = p.clientX - pourTouch.x;
      var wasHorizontal = pourLock;
      pourTouch = null;
      pourLock = null;
      if (!wasHorizontal || Math.abs(dx) < 32) return;
      var step = dx < 0 ? 1 : -1;
      if (document.dir === 'rtl') step = -step;
      setPour((current + step + frames.length) % frames.length);
    }, { passive: true });
    pourMedia.addEventListener('touchcancel', function () {
      pourTouch = null;
      pourLock = null;
    }, { passive: true });
  }

  /* --- The cup: one drink, one scroll-driven scene ----------------------- */
  var cup = document.querySelector('[data-ritual]');
  var cupStage = cup ? cup.querySelector('[data-ritual-stage]') : null;
  var cupTilt = cup ? cup.querySelector('[data-ritual-tilt]') : null;

  function updateRitual() {
    if (!cup || isReduced()) return;
    var box = cup.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;
    var travel = box.height - window.innerHeight;
    if (travel <= 0) return;
    var t = clamp01(-box.top / travel);
    // the drink rises out of depth as the section arrives — not once it has
    // pinned, or the stage slides in empty — then takes the room, eases back
    // as its name lands, and finally recedes the way it came
    var arrive = clamp01((window.innerHeight - box.top) / window.innerHeight);
    var dom = Math.min(ramp(t, .26, .56), 1 - ramp(t, .66, .84) * .85);
    cup.style.setProperty('--t', t.toFixed(4));
    cup.style.setProperty('--enter', ramp(arrive, .42, .96).toFixed(4));
    cup.style.setProperty('--dom', dom.toFixed(4));
    cup.style.setProperty('--name', ramp(t, .66, .84).toFixed(4));
    cup.style.setProperty('--exit', ramp(t, .88, 1).toFixed(4));
  }

  if (cupStage && cupTilt) tiltOn(cupStage, cupTilt, 7, 5);

  // The cup in 3D lives in its own file, fetched only as the section comes
  // within reach, so the first screen never waits on it. Without WebGL it
  // never takes over, and the photograph above remains the drink.
  if (cup && 'IntersectionObserver' in window &&
      !(navigator.connection && navigator.connection.saveData)) {
    var cupIo = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      cupIo.disconnect();
      var s = document.createElement('script');
      s.src = ASSETS + 'js/savva-cup.js';
      s.async = true;
      document.head.appendChild(s);
    }, { rootMargin: '150% 0px' });
    cupIo.observe(cup);
  }

  /* --- Parallax ---------------------------------------------------------- */
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));

  function updateParallax() {
    // a scroll-linked write per image, every frame, across the hero and the
    // whole gallery is what made scrolling stutter on a phone — the shift is
    // subtle on a small screen anyway, so it's a desktop-only touch
    if (isReduced() || narrow.matches) return;
    var vh = window.innerHeight;
    parallax.forEach(function (el) {
      var box = el.getBoundingClientRect();
      if (box.bottom < -vh * 0.3 || box.top > vh * 1.3) return;
      var centre = box.top + box.height / 2;
      var offset = (centre - vh / 2) / vh;
      var shift = offset * parseFloat(el.dataset.parallax) * 100;
      // written as a custom property so CSS keeps ownership of the transform
      // and hover scaling still composes with it
      el.style.setProperty('--py', shift.toFixed(2) + 'px');
    });
  }

  /* --- One scroll loop for everything ------------------------------------ */
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      updatePour();
      updateRitual();
      updateParallax();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // a page that loads in a background tab never gets its first frame; re-sync
  // as soon as it becomes visible so the sequence is never left mid-state
  document.addEventListener('visibilitychange', function () { queued = false; onScroll(); });
  onScroll();
  setPour(0);

  reduce.addEventListener('change', function () {
    if (isReduced()) parallax.forEach(function (el) { el.style.removeProperty('--py'); });
    else onScroll();
  });

  /* --- Location card: spring tilt, click to open, real opening status ----- */
  var xmap = document.querySelector('[data-xmap]');

  if (xmap) (function () {
    var card = xmap.querySelector('[data-xmap-card]');
    var hit = xmap.querySelector('[data-xmap-toggle]');
    var close = xmap.querySelector('[data-xmap-close]');
    var open = false;

    // The map in 3D lives in its own file, fetched as the card comes within
    // reach. Without WebGL — or on Save-Data — it never takes over, and the
    // flat map of the same streets remains the map.
    if ('IntersectionObserver' in window && !(navigator.connection && navigator.connection.saveData)) {
      var mapIo = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        mapIo.disconnect();
        var s = document.createElement('script');
        s.src = ASSETS + 'js/savva-map.js';
        s.async = true;
        document.head.appendChild(s);
      }, { rootMargin: '120% 0px' });
      mapIo.observe(xmap);
    }

    // a damped spring per value, integrated in small fixed steps — the same
    // stiffness/damping pairs the reference drives its motion values with
    function Spring(k, c) { this.k = k; this.c = c; this.x = 0; this.v = 0; this.to = 0; }
    Spring.prototype.step = function (dt) {
      this.v += (this.k * (this.to - this.x) - this.c * this.v) * dt;
      this.x += this.v * dt;
    };
    Spring.prototype.moving = function (eps) {
      return Math.abs(this.to - this.x) > eps || Math.abs(this.v) > eps;
    };
    var rx = new Spring(300, 30), ry = new Spring(300, 30);
    var sw = new Spring(400, 35), sh = new Spring(400, 35);
    var sizing = false, running = false, last = 0;

    function frame(now) {
      var dt = last ? Math.min(.05, (now - last) / 1000) : .016;
      last = now;
      var n = Math.ceil(dt / .004), sub = dt / n;
      for (var i = 0; i < n; i++) {
        rx.step(sub); ry.step(sub);
        if (sizing) { sw.step(sub); sh.step(sub); }
      }
      card.style.setProperty('--rx', rx.x.toFixed(2) + 'deg');
      card.style.setProperty('--ry', ry.x.toFixed(2) + 'deg');
      if (sizing) {
        if (sw.moving(.3) || sh.moving(.3)) {
          card.style.width = sw.x.toFixed(1) + 'px';
          card.style.height = sh.x.toFixed(1) + 'px';
        } else {
          // settled: hand the geometry back to the stylesheet so it stays fluid
          sizing = false;
          card.style.width = card.style.height = '';
        }
      }
      if (sizing || rx.moving(.01) || ry.moving(.01)) requestAnimationFrame(frame);
      else { running = false; last = 0; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

    // the Google frame is dropped on close, so the next opening is the 3D map
    function dropLive() {
      var frameEl = card.querySelector('iframe');
      if (frameEl) frameEl.parentNode.removeChild(frameEl);
      xmap.classList.remove('is-live');
    }

    function setOpen(next, moveFocus) {
      if (next === open) return;
      var fw = card.offsetWidth, fh = card.offsetHeight;
      open = next;
      xmap.classList.toggle('is-open', open);
      hit.setAttribute('aria-expanded', String(open));
      if (!open) dropLive();
      // the 3D map (savva-map.js) flies in or out on this
      xmap.dispatchEvent(new CustomEvent('savva:xmap', { detail: { open: open } }));
      rx.to = ry.to = 0;
      if (moveFocus) (open ? close : hit).focus({ preventScroll: true });
      if (isReduced()) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); return; }
      // measure the target the stylesheet now asks for, then spring towards it
      card.style.width = card.style.height = '';
      var tw = card.offsetWidth, th = card.offsetHeight;
      sw.x = fw; sh.x = fh; sw.v = sh.v = 0; sw.to = tw; sh.to = th;
      card.style.width = fw + 'px';
      card.style.height = fh + 'px';
      sizing = true;
      kick();
    }
    // a click from the keyboard reports no pointer detail; focus follows it
    // into the open card and back out again
    hit.addEventListener('click', function (e) { setOpen(true, e.detail === 0); });
    if (close) close.addEventListener('click', function (e) { setOpen(false, e.detail === 0); });
    xmap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false, true);
    });

    if (fine.matches) {
      card.addEventListener('pointerenter', function () { xmap.classList.add('is-hover'); });
      card.addEventListener('pointermove', function (e) {
        // only the collapsed plate tilts; open, the map itself turns
        if (isReduced() || open) return;
        var b = card.getBoundingClientRect();
        var cap = function (v) { return v < -50 ? -50 : v > 50 ? 50 : v; };
        // ±50px from the centre maps onto ±8°, as in the reference
        rx.to = -cap(e.clientY - (b.top + b.height / 2)) / 50 * 8;
        ry.to = cap(e.clientX - (b.left + b.width / 2)) / 50 * 8;
        kick();
      });
      card.addEventListener('pointerleave', function () {
        xmap.classList.remove('is-hover');
        rx.to = ry.to = 0;
        kick();
      });
    }

    // Open or closed, from SAVVA's published hours. Saudi Arabia keeps UTC+3
    // all year, so the visitor's own clock and time zone never enter into it.
    // The card shows it twice — on its face, and on the plate over the pin.
    var statuses = Array.prototype.slice.call(xmap.querySelectorAll('[data-open-status]'));
    if (statuses.length) {
      var hours = JSON.parse(statuses[0].dataset.hours);
      var mins = function (s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; };
      var sync = function () {
        var local = new Date(Date.now() + 3 * 36e5);
        var day = local.getUTCDay(), now = local.getUTCHours() * 60 + local.getUTCMinutes();
        var isOpen = hours.some(function (h) {
          var o = mins(h.o), c = mins(h.c), wraps = c <= o;
          if (h.d.indexOf(day) > -1 && now >= o && (wraps || now < c)) return true;
          return wraps && h.d.indexOf((day + 6) % 7) > -1 && now < c;
        });
        statuses.forEach(function (status) {
          status.lastElementChild.textContent = isOpen ? status.dataset.open : status.dataset.closed;
          status.classList.toggle('is-closed', !isOpen);
          status.hidden = false;
        });
      };
      sync();
      window.setInterval(sync, 60000);
    }

    // Google's own map loads only when the visitor asks for it
    var load = xmap.querySelector('[data-map-load]');
    if (load) load.addEventListener('click', function () {
      if (xmap.classList.contains('is-live')) return;
      setOpen(true);
      var embed = document.createElement('iframe');
      embed.src = card.dataset.src;
      embed.title = card.dataset.title || 'Map';
      embed.loading = 'lazy';
      embed.referrerPolicy = 'no-referrer-when-downgrade';
      embed.allowFullscreen = true;
      card.appendChild(embed);
      xmap.classList.add('is-live');
    });
  })();
})();
