/* ============================================================
   The Lighthouse — script.js
   Vanilla JS only. Reads the visitor's REAL local time with
   `new Date()` and continuously maps it onto CSS variables.
   Time engine ported from "A Window Through the Day".
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var clockEl = document.getElementById('clock');
  var phaseEl = document.getElementById('phaseLabel');
  var descEl = document.getElementById('phaseDesc');
  var starsEl = document.getElementById('stars');
  var seaSparklesEl = document.getElementById('seaSparkles');
  var keeperEl = document.getElementById('keeperNote');
  var windowEl = document.getElementById('window');

  var lastPhase = '';
  var lastKeeper = '';

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

  function smooth(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* Sky keyframes: the same headland, re-lit through the day. */
  var SKY_STOPS = [
    { h: 0.0,  top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },
    { h: 4.5,  top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },
    { h: 5.5,  top: [42, 58, 101],  mid: [90, 106, 154], bot: [201, 168, 138] },
    { h: 6.5,  top: [122, 164, 214],mid: [242, 184, 160],bot: [255, 227, 194] },
    { h: 8.0,  top: [61, 139, 255], mid: [126, 192, 255],bot: [207, 234, 255] },
    { h: 12.0, top: [42, 123, 255], mid: [106, 184, 255],bot: [200, 234, 255] },
    { h: 16.0, top: [47, 125, 232], mid: [122, 184, 240],bot: [214, 236, 255] },
    { h: 17.0, top: [58, 92, 192],  mid: [232, 138, 90], bot: [255, 207, 138] },
    { h: 17.75,top: [61, 58, 122],  mid: [232, 106, 106],bot: [255, 180, 94] },
    { h: 18.25,top: [70, 60, 130],  mid: [250, 130, 90], bot: [255, 200, 130] },
    { h: 18.5, top: [44, 33, 84],   mid: [138, 74, 138], bot: [255, 138, 90] },
    { h: 18.75,top: [36, 28, 72],   mid: [110, 60, 120], bot: [220, 120, 110] },
    { h: 19.5, top: [23, 21, 58],   mid: [61, 42, 94],   bot: [122, 74, 122] },
    { h: 20.5, top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] },
    { h: 24.0, top: [6, 10, 26],    mid: [11, 21, 48],   bot: [26, 35, 64] }
  ];

  // Day vs night palettes for the coast. Interpolated by darkness.
  var PAL = {
    seaTopDay: [74, 144, 196],  seaTopNight: [10, 20, 44],
    seaBotDay: [168, 210, 234], seaBotNight: [22, 34, 62],
    rockDay: [90, 95, 110],     rockNight: [18, 22, 34],
    rockDeepDay: [60, 64, 76],  rockDeepNight: [10, 13, 22],
    wallTopDay: [52, 66, 104],  wallTopNight: [30, 36, 58],
    wallBotDay: [38, 48, 80],   wallBotNight: [18, 22, 40],
    cloudDay: [255, 255, 255],  cloudNight: [58, 68, 100]
  };

  var SUNRISE = 6.0;
  var SUNSET = 18.6;
  var DAY_LEN = SUNSET - SUNRISE;
  var NIGHT_LEN = 24 - DAY_LEN;

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
    var s = smooth((h - a.h) / (b.h - a.h));
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
    return (h - 18.0) / 2.5;
  }

  function sunStateAt(h) {
    if (h <= SUNRISE - 0.4 || h >= SUNSET + 0.4) {
      return { x: 50, y: 85, elevation: 0, opacity: 0 };
    }
    var p = clamp((h - SUNRISE) / DAY_LEN, 0, 1);
    var elevation = Math.sin(Math.PI * p);
    var x = 8 + p * 84 + Math.sin(p * Math.PI) * 5;
    var y = 78 - elevation * 62;
    var edge = Math.min((h - (SUNRISE - 0.4)) / 0.4, ((SUNSET + 0.4) - h) / 0.4, 1);
    return { x: x, y: y, elevation: elevation, opacity: clamp(edge, 0, 1) };
  }

  function moonStateAt(h) {
    var p = (((h - SUNSET) % 24) + 24) % 24 / NIGHT_LEN;
    var inNight = h >= SUNSET - 0.3 || h <= SUNRISE + 0.3;
    if (!inNight) return { x: 50, y: 85, elevation: 0, opacity: 0 };
    var elevation = Math.sin(Math.PI * clamp(p, 0, 1));
    var x = 8 + clamp(p, 0, 1) * 84;
    var y = 74 - elevation * 56;
    var nearEdge = Math.min(elevation * 4 + 0.15, 1);
    return { x: x, y: y, elevation: elevation, opacity: clamp(nearEdge, 0, 1) };
  }

  function phaseFor(h) {
    if (h >= 5 && h < 12) return { label: 'Morning watch', desc: h < 7.5 ? 'Pale dawn over calm water — gulls waking, mist on the sea.' : 'Bright morning on the headland — gulls riding the wind.' };
    if (h >= 12 && h < 17) return { label: 'High day', desc: 'High sun glittering on open water. The lamp sleeps.' };
    if (h >= 17 && h < 18.5) return { label: 'Golden water', desc: 'Low amber sun melting into the sea. Evening is coming.' };
    if (h >= 18.5 && h < 19) return { label: 'First light', desc: 'The lamp wakes — its beam sweeps the dusk and a ship passes by.' };
    if (h >= 19 && h < 22) return { label: 'Night watch', desc: 'The beam keeps its steady watch over dark water.' };
    return { label: 'Night watch', desc: 'Night — moon, stars and the turning beam. All is well.' };
  }

  function keeperNoteFor(h) {
    if (h >= 5 && h < 7.5) return "Keeper's note — dawn mist. Gulls waking, lamp cooling.";
    if (h >= 7.5 && h < 10) return "Keeper's note — bright watch. Lamp asleep, gulls out.";
    if (h >= 10 && h < 17) return "Keeper's note — beach day. Kids at the shore, lamp asleep.";
    if (h >= 17 && h < 18.33) return "Keeper's note — beach emptying. Sunset soon, lamp warms ~6:20 PM.";
    if (h >= 18.33 && h < 18.5) return "Keeper's note — dusk settling. Beacon waking up.";
    if (h >= 18.5 && h < 18.7) return "Keeper's note — first light! Beam sweeping the dusk.";
    if (h >= 18.7 && h < 18.9) return "Keeper's note — passing ship spotted — 2.8 km offshore.";
    if (h >= 18.9 && h < 19.0) return "Keeper's note — ship passed safely.";
    if (h >= 19 && h < 22) return "Keeper's note — beam steady. All ships warned.";
    return "Keeper's note — the lamp wakes ~6:30 PM. Watch for the passing ship.";
  }

  /**
   * updateSpecialMoment — "First Light", ~6:30 PM–7:00 PM local.
   * The lamp warms up over the first 10 minutes, holds while a small
   * ship crosses, then hands over to the all-night beam. Gulls (daytime)
   * are gated here too so one function owns every time-windowed actor.
   */
  function updateSpecialMoment(h, nightF) {
    var START = 18.5;
    var END = 19.0;
    var FADE = 1 / 6; // 10 minutes in hours

    var warmup = 0;
    var ship = 0;
    if (h >= START && h < END) {
      warmup = smooth((h - START) / FADE);
      ship = Math.min(smooth((h - START) / FADE), smooth((END - h) / FADE));
    }

    // Lamp schedule: burns all night, fades out after sunrise (5:45→6:30),
    // filament warms from 6:20 PM, full beam from 6:30 PM. Off by day.
    // (Explicit schedule — not derived from nightF — so dawn never glows.)
    var lampStart = START - FADE; // 18:20
    var lamp, beam;
    if (h >= END || h < 5.75) { lamp = 1; beam = 1; }
    else if (h < 6.5) { lamp = smooth((6.5 - h) / 0.75); beam = lamp; }
    else if (h < lampStart) { lamp = 0; beam = 0; }
    else if (h < END) { lamp = smooth((h - lampStart) / (END - lampStart)); beam = warmup; }
    else { lamp = 1; beam = 1; }
    // Gulls belong to daylight and head home as dusk settles (gone by 7 PM).
    var gulls = clamp((1 - nightF) * 0.9 - warmup * 0.4, 0, 0.9);
    if (h >= 18.5) gulls *= Math.max(0, 1 - (h - 18.5) / 0.5);

    // Beach people: full 10 AM–5 PM, fade out by 6:30 PM. Zero at night.
    var people = 0;
    if (h >= 10 && h < 17) people = 1;
    else if (h >= 9.5 && h < 10) people = smooth((h - 9.5) / 0.5);
    else if (h >= 17 && h < 18.5) people = 1 - smooth((h - 17) / 1.5);

    // Beam x ship: peaks ~6:42 PM when the ship is mid-crossing.
    // Lights the hull via filter brightness in CSS. Zero outside window.
    var beamOnShip = smooth(1 - Math.abs(h - 18.7) / 0.3) * beam * ship;

    root.style.setProperty('--beam-opacity', beam.toFixed(3));
    root.style.setProperty('--beam-on-ship', beamOnShip.toFixed(3));
    root.style.setProperty('--ship-opacity', ship.toFixed(3));
    root.style.setProperty('--lamp-opacity', lamp.toFixed(3));
    root.style.setProperty('--halo-opacity', lamp.toFixed(3));
    root.style.setProperty('--people-opacity', people.toFixed(3));
    root.style.setProperty('--birds-opacity', gulls.toFixed(3));
    return { beam: beam, ship: ship };
  }

  /**
   * updateScene — maps continuous time onto every visual variable.
   * Called every second; each value is interpolated so motion is gradual.
   * (Beam/ship/gulls are owned by updateSpecialMoment and not touched here.)
   */
  function updateScene(t) {
    var h = t.decimal;
    var sky = skyAt(h);
    var sun = sunStateAt(h);
    var moon = moonStateAt(h);
    var nightF = clamp(starOpacityAt(h), 0, 1);

    var mist = Math.max(0, 1 - Math.abs(h - 6.4) / 1.6) * 0.7;
    var warm = smooth(1 - Math.abs(h - 17.6) / 1.7);

    var brightness = clamp(1.02 - nightF * 0.28 + warm * 0.03, 0.72, 1.05);
    var cloudOp = clamp(0.18 + (1 - nightF) * 0.65 - mist * 0.1, 0.12, 0.95);
    var shimmerOp = clamp(0.55 - nightF * 0.37, 0.15, 0.6);
    var glitterOp = moon.opacity * 0.35;
    var foamOp = clamp(0.18 + (1 - nightF) * 0.22, 0.12, 0.45);
    var buoyOp = nightF;
    var sparkleOp = nightF * 0.85;
    var milkyOp = nightF * 0.6;
    var glare = clamp(0.08 + (1 - nightF) * 0.12 + warm * 0.16, 0.05, 0.36);
    var glow = clamp(0.45 + (1 - sun.elevation) * 0.35 + warm * 0.3, 0, 1);
    var shadow = clamp(sun.elevation * (1 - nightF), 0, 1) * 0.5;

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
    s.setProperty('--shimmer-opacity', shimmerOp.toFixed(3));
    s.setProperty('--glitter-opacity', glitterOp.toFixed(3));
    s.setProperty('--foam-opacity', foamOp.toFixed(3));
    s.setProperty('--buoy-opacity', buoyOp.toFixed(3));
    s.setProperty('--sparkle-opacity', sparkleOp.toFixed(3));
    s.setProperty('--milky-opacity', milkyOp.toFixed(3));
    s.setProperty('--meteor-opacity', nightF.toFixed(3));
    s.setProperty('--cloud-color', rgb(lerpColor(PAL.cloudDay, PAL.cloudNight, nightF)));
    s.setProperty('--mist-opacity', mist.toFixed(3));
    s.setProperty('--warm-opacity', (warm * 0.6).toFixed(3));
    s.setProperty('--night-opacity', nightF.toFixed(3));
    s.setProperty('--scene-brightness', brightness.toFixed(3));
    s.setProperty('--glare-opacity', glare.toFixed(3));
    s.setProperty('--shadow-opacity', shadow.toFixed(3));

    s.setProperty('--sea-top', rgb(lerpColor(PAL.seaTopDay, PAL.seaTopNight, nightF)));
    s.setProperty('--sea-bot', rgb(lerpColor(PAL.seaBotDay, PAL.seaBotNight, nightF)));
    s.setProperty('--rock-c', rgb(lerpColor(PAL.rockDay, PAL.rockNight, nightF)));
    s.setProperty('--rock-deep', rgb(lerpColor(PAL.rockDeepDay, PAL.rockDeepNight, nightF)));
    s.setProperty('--wall-top', rgb(lerpColor(PAL.wallTopDay, PAL.wallTopNight, nightF * 0.9)));
    s.setProperty('--wall-bot', rgb(lerpColor(PAL.wallBotDay, PAL.wallBotNight, nightF * 0.9)));
    s.setProperty('--day-progress', (h / 24 * 100).toFixed(2) + '%');

    if (windowEl) {
      var ph = phaseFor(h);
      var beach = (h >= 10 && h < 17) ? ', beach lively' : ((h >= 9.5 && h < 10) || (h >= 17 && h < 18.5) ? ', beach emptying' : ', beach empty');
      windowEl.setAttribute('aria-label',
        'Lighthouse view at ' + formatClock(t) + ': ' + ph.label + '. ' + ph.desc + beach + '.');
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
    var note = keeperNoteFor(t.decimal);
    if (note !== lastKeeper) {
      lastKeeper = note;
      if (keeperEl) keeperEl.textContent = note;
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

  function buildSeaSparkles() {
    if (!seaSparklesEl || seaSparklesEl.childNodes.length > 0) return;
    var frag = document.createDocumentFragment();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (var i = 0; i < 16; i++) {
      var sp = document.createElement('span');
      sp.className = 'spark';
      // Bias half the sparkles to the emptier right side.
      var x = i % 2 === 0 ? (48 + Math.random() * 44) : (8 + Math.random() * 84);
      sp.style.left = x.toFixed(2) + '%';
      sp.style.top = (20 + Math.random() * 70).toFixed(2) + '%';
      if (!reduced) sp.style.animationDelay = (-Math.random() * 3.4).toFixed(2) + 's';
      frag.appendChild(sp);
    }
    seaSparklesEl.appendChild(frag);
  }

  function tick() {
    var t = getTimeProgress(new Date());
    var nightF = clamp(starOpacityAt(t.decimal), 0, 1);
    updateSpecialMoment(t.decimal, nightF);
    updateScene(t);
    updateClock(t);
  }

  // Immediate correct state: paint the right moment before the user
  // sees anything, with no loading screen and no play-from-midnight.
  buildStars();
  buildSeaSparkles();
  tick();
  window.setInterval(tick, 1000);

  // Expose for debugging / evaluation (harmless, no dependencies).
  window.__lighthouse = {
    getTimeProgress: getTimeProgress,
    updateScene: updateScene,
    updateClock: updateClock,
    updateSpecialMoment: updateSpecialMoment
  };
})();
