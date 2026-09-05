/* ============================================================
   A Window Through the Day — script.js
   Vanilla JS only. Reads the visitor's REAL local time with
   `new Date()` and continuously maps it onto CSS variables.
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var clockEl = document.getElementById('clock');
  var phaseEl = document.getElementById('phaseLabel');
  var descEl = document.getElementById('phaseDesc');
  var markerEl = document.getElementById('timelineMarker');
  var starsEl = document.getElementById('stars');
  var windowEl = document.getElementById('window');

  var lastPhase = '';

  /* ---------- helpers ---------- */

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t))
    ];
  }

  function rgb(c) {
    return 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
  }

  /* Sky keyframes: same physical place, re-lit through the day.
     Each stop is an hour (0-24) + top/mid/bottom sky colours. */
  var SKY_STOPS = [
    { h: 0.0,  top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },     // midnight
    { h: 4.5,  top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },     // late night
    { h: 5.5,  top: [42, 58, 101],  mid: [90, 106, 154], bot: [201, 168, 138] }, // pre-dawn lift
    { h: 6.5,  top: [122, 164, 214],mid: [242, 184, 160],bot: [255, 227, 194] }, // dawn pastel + mist
    { h: 8.0,  top: [61, 139, 255], mid: [126, 192, 255],bot: [207, 234, 255] }, // morning blue
    { h: 12.0, top: [42, 123, 255], mid: [106, 184, 255],bot: [200, 234, 255] }, // midday
    { h: 16.0, top: [47, 125, 232], mid: [122, 184, 240],bot: [214, 236, 255] }, // afternoon
    { h: 17.0, top: [58, 92, 192],  mid: [232, 138, 90], bot: [255, 207, 138] }, // golden start
    { h: 17.75,top: [61, 58, 122],  mid: [232, 106, 106],bot: [255, 180, 94] },  // golden peak
    { h: 18.5, top: [44, 33, 84],   mid: [138, 74, 138], bot: [255, 138, 90] },  // sunset
    { h: 19.5, top: [23, 21, 58],   mid: [61, 42, 94],   bot: [122, 74, 122] },  // twilight
    { h: 20.5, top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },     // night
    { h: 24.0, top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] }      // wrap
  ];

  // Day vs night palettes for the (same) environment. Interpolated by darkness.
  var PAL = {
    hillFarDay: [157, 184, 201], hillFarNight: [24, 33, 60],
    hillNearDay: [127, 160, 141], hillNearNight: [17, 27, 50],
    cityFarDay: [138, 155, 181], cityFarNight: [24, 32, 56],
    cityNearDay: [93, 111, 143], cityNearNight: [15, 21, 40],
    groundDay: [74, 90, 106], groundNight: [11, 16, 30],
    wallTopDay: [236, 229, 216], wallTopNight: [54, 60, 82],
    wallBotDay: [216, 207, 190], wallBotNight: [36, 41, 60],
    cloudDay: [255, 255, 255], cloudNight: [58, 68, 100]
  };

  var SUNRISE = 6.0;
  var SUNSET = 18.6;
  var DAY_LEN = SUNSET - SUNRISE;       // 12.6h
  var NIGHT_LEN = 24 - DAY_LEN;         // 11.4h

  /**
   * getTimeProgress — single source of truth for REAL local time.
   * Returns a continuous decimal hour plus parts. Never hardcoded.
   */
  function getTimeProgress(now) {
    var d = now instanceof Date ? now : new Date();
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var seconds = d.getSeconds();
    var ms = d.getMilliseconds();
    var decimal = hours + minutes / 60 + seconds / 3600 + ms / 3600000;
    return { date: d, hours: hours, minutes: minutes, seconds: seconds, decimal: decimal };
  }

  function skyAt(h) {
    var i = 0;
    while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1].h <= h) i++;
    var a = SKY_STOPS[i];
    var b = SKY_STOPS[i + 1];
    var t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    // smoothstep softens keyframe seams so nothing pops
    var s = t * t * (3 - 2 * t);
    return {
      top: lerpColor(a.top, b.top, s),
      mid: lerpColor(a.mid, b.mid, s),
      bot: lerpColor(a.bot, b.bot, s)
    };
  }

  function starOpacityAt(h) {
    if (h >= 20.5 || h < 5.0) return 1;
    if (h >= 7.5 && h <= 18.0) return 0;
    if (h >= 5.0 && h < 7.5) return 1 - (h - 5.0) / 2.5;
    return (h - 18.0) / 2.5; // 18.0 -> 20.5
  }

  function sunStateAt(h) {
    if (h <= SUNRISE - 0.4 || h >= SUNSET + 0.4) {
      return { x: 50, y: 85, elevation: 0, opacity: 0 };
    }
    var p = clamp((h - SUNRISE) / DAY_LEN, 0, 1);
    var elevation = Math.sin(Math.PI * p); // 0 horizon -> 1 noon
    // gentle S-curve dodges the centre mullion (50%) at midday so the
    // noon sun sits just clear of the frame bar instead of split behind it
    var x = 8 + p * 84 + Math.sin(p * Math.PI) * 5;
    var y = 78 - elevation * 62;
    // fade in/out within ~0.4h of rise/set so there is no pop
    var edge = Math.min((h - (SUNRISE - 0.4)) / 0.4, ((SUNSET + 0.4) - h) / 0.4, 1);
    return { x: x, y: y, elevation: elevation, opacity: clamp(edge, 0, 1) };
  }

  function moonStateAt(h) {
    var p = (((h - SUNSET) % 24) + 24) % 24 / NIGHT_LEN; // 0 at sunset -> 1 at sunrise
    var inNight = h >= SUNSET - 0.3 || h <= SUNRISE + 0.3;
    if (!inNight) return { x: 50, y: 85, elevation: 0, opacity: 0 };
    var elevation = Math.sin(Math.PI * clamp(p, 0, 1));
    var x = 8 + clamp(p, 0, 1) * 84;
    var y = 74 - elevation * 56;
    var edgeRaw = inNight ? 1 : 0;
    // soften right at rise/set
    var nearEdge = Math.min(elevation * 4 + 0.15, 1);
    return { x: x, y: y, elevation: elevation, opacity: clamp(edgeRaw * nearEdge, 0, 1) };
  }

  function phaseFor(h) {
    if (h >= 5 && h < 12) return { label: 'Good morning', desc: h < 7.5 ? 'Soft dawn light, pastel sky and a thin morning mist over the rooftops.' : 'Fresh morning sun over the rooftops — a calm, bright start.' };
    if (h >= 12 && h < 17) return { label: 'A bright afternoon', desc: 'High sun, drifting clouds and a clear blue sky over the city.' };
    if (h >= 17 && h < 18) return { label: 'Golden hour', desc: 'Low warm sun and long light — a small flock of birds crosses the sky.' };
    if (h >= 18 && h < 22) return { label: 'A quiet evening', desc: h < 19.5 ? 'Twilight settles in — amber and violet fading over the skyline.' : 'City windows glow under a quiet evening sky.' };
    return { label: 'Good night', desc: 'Night — moon, stars and glowing windows. Rest well.' };
  }

  /**
   * updateSpecialMoment — Golden Hour Birds, ~5:00 PM–6:00 PM local.
   * Returns 0 outside the window, fading in/out over ~10 min each side,
   * and adds a warm boost while the flock is present.
   */
  function updateSpecialMoment(h) {
    var START = 17.0;
    var END = 18.0;
    var FADE = 1 / 6; // 10 minutes in hours
    var opacity = 0;
    if (h >= START && h < END) {
      var fadeIn = clamp((h - START) / FADE, 0, 1);
      var fadeOut = clamp((END - h) / FADE, 0, 1);
      opacity = Math.min(fadeIn, fadeOut);
      // smoothstep the fades
      opacity = opacity * opacity * (3 - 2 * opacity);
    }
    root.style.setProperty('--birds-opacity', opacity.toFixed(3));
    return opacity;
  }

  /**
   * updateScene — maps continuous time onto every visual variable.
   * Called every second; each value is interpolated so motion is gradual.
   */
  function updateScene(t, birdOpacity) {
    var h = t.decimal;
    var sky = skyAt(h);
    var sun = sunStateAt(h);
    var moon = moonStateAt(h);
    var nightF = clamp(starOpacityAt(h), 0, 1);

    var mist = Math.max(0, 1 - Math.abs(h - 6.4) / 1.6) * 0.75;
    var warm = Math.max(0, 1 - Math.abs(h - 17.6) / 1.7);
    warm = warm * warm * (3 - 2 * warm);
    // birds make the golden light slightly more present — still time-driven
    warm = clamp(warm + birdOpacity * 0.12, 0, 1);

    var brightness = clamp(1.02 - nightF * 0.28 + warm * 0.03, 0.72, 1.05);
    var cloudOp = clamp(0.3 + (1 - nightF) * 0.6 - mist * 0.1, 0.15, 0.95);
    var windows = clamp((nightF - 0.08) / 0.92, 0, 1);
    windows = windows * windows * (3 - 2 * windows);
    var lamps = clamp((nightF - 0.15) / 0.85, 0, 1);
    var glare = clamp(0.1 + (1 - nightF) * 0.12 + warm * 0.18, 0.06, 0.4);
    var glow = clamp(0.45 + (1 - sun.elevation) * 0.35 + warm * 0.3, 0, 1);
    var shadow = clamp(sun.elevation * (1 - nightF), 0, 1) * 0.5;

    // sun tint: pale at noon, amber when low, deeper during golden hour
    var low = [255, 138, 66];
    var high = [255, 232, 170];
    var tint = lerpColor(low, high, clamp(sun.elevation, 0, 1));
    tint = lerpColor(tint, [255, 122, 58], warm * 0.35);

    var s = root.style;
    s.setProperty('--sky-top', rgb(sky.top));
    s.setProperty('--sky-mid', rgb(sky.mid));
    s.setProperty('--sky-bot', rgb(sky.bot));

    s.setProperty('--sun-x', sun.x.toFixed(2) + '%');
    s.setProperty('--sun-y', sun.y.toFixed(2) + '%');
    s.setProperty('--sun-opacity', sun.opacity.toFixed(3));
    s.setProperty('--sun-tint', rgb(tint));
    s.setProperty('--sun-glow', glow.toFixed(3));

    s.setProperty('--moon-x', moon.x.toFixed(2) + '%');
    s.setProperty('--moon-y', moon.y.toFixed(2) + '%');
    s.setProperty('--moon-opacity', moon.opacity.toFixed(3));
    s.setProperty('--stars-opacity', nightF.toFixed(3));

    s.setProperty('--cloud-opacity', cloudOp.toFixed(3));
    s.setProperty('--cloud-color', rgb(lerpColor(PAL.cloudDay, PAL.cloudNight, nightF)));
    s.setProperty('--mist-opacity', mist.toFixed(3));
    s.setProperty('--warm-opacity', (warm * 0.6).toFixed(3));
    s.setProperty('--night-opacity', nightF.toFixed(3));
    s.setProperty('--scene-brightness', brightness.toFixed(3));
    s.setProperty('--glare-opacity', glare.toFixed(3));
    s.setProperty('--shadow-opacity', shadow.toFixed(3));

    s.setProperty('--hill-far-c', rgb(lerpColor(PAL.hillFarDay, PAL.hillFarNight, nightF)));
    s.setProperty('--hill-near-c', rgb(lerpColor(PAL.hillNearDay, PAL.hillNearNight, nightF)));
    s.setProperty('--city-far-c', rgb(lerpColor(PAL.cityFarDay, PAL.cityFarNight, nightF)));
    s.setProperty('--city-near-c', rgb(lerpColor(PAL.cityNearDay, PAL.cityNearNight, nightF)));
    s.setProperty('--ground-c', rgb(lerpColor(PAL.groundDay, PAL.groundNight, nightF)));
    s.setProperty('--wall-top', rgb(lerpColor(PAL.wallTopDay, PAL.wallTopNight, nightF * 0.9)));
    s.setProperty('--wall-bot', rgb(lerpColor(PAL.wallBotDay, PAL.wallBotNight, nightF * 0.9)));
    s.setProperty('--windows-opacity', windows.toFixed(3));
    s.setProperty('--lamp-opacity', lamps.toFixed(3));
    s.setProperty('--day-progress', (h / 24 * 100).toFixed(2) + '%');

    // keep the accessible name in sync with what is actually visible
    if (windowEl) {
      var ph = phaseFor(h);
      windowEl.setAttribute('aria-label',
        'Window view at ' + formatClock(t) + ': ' + ph.label + '. ' + ph.desc);
    }
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatClock(t) {
    var h24 = t.hours;
    var suffix = h24 >= 12 ? 'PM' : 'AM';
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(t.minutes) + ' ' + suffix;
  }

  /**
   * updateClock — live device-time display + contextual label.
   * Text nodes only change when the value actually changes.
   */
  function updateClock(t) {
    var label = formatClock(t);
    if (clockEl) {
      if (clockEl.textContent !== label) clockEl.textContent = label;
      var iso = t.date.getFullYear() + '-' + pad(t.date.getMonth() + 1) + '-' + pad(t.date.getDate()) +
        'T' + pad(t.hours) + ':' + pad(t.minutes) + ':' + pad(t.seconds);
      clockEl.setAttribute('datetime', iso);
    }
    var ph = phaseFor(t.decimal);
    if (ph.label !== lastPhase) {
      lastPhase = ph.label;
      if (phaseEl) phaseEl.textContent = ph.label;
      if (descEl) descEl.textContent = ph.desc;
    }
  }

  function buildStars() {
    if (!starsEl || starsEl.childNodes.length > 0) return;
    var frag = document.createDocumentFragment();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (var i = 0; i < 90; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      var size = i % 7 === 0 ? 3 : (i % 3 === 0 ? 2 : 1.5);
      star.style.left = (Math.random() * 100).toFixed(2) + '%';
      star.style.top = (Math.random() * 62).toFixed(2) + '%';
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
      if (!reduced) star.style.animationDelay = (-Math.random() * 3.2).toFixed(2) + 's';
      frag.appendChild(star);
    }
    starsEl.appendChild(frag);
  }

  function tick() {
    var t = getTimeProgress(new Date());
    var birdOpacity = updateSpecialMoment(t.decimal);
    updateScene(t, birdOpacity);
    updateClock(t);
  }

  // Immediate correct state: paint the right moment before the user
  // sees anything, with no loading screen and no play-from-midnight.
  buildStars();
  tick();
  window.setInterval(tick, 1000);

  // Expose for debugging / evaluation (harmless, no dependencies).
  window.__windowThroughDay = {
    getTimeProgress: getTimeProgress,
    updateScene: updateScene,
    updateClock: updateClock,
    updateSpecialMoment: updateSpecialMoment
  };
})();
