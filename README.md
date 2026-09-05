# A Window Through the Day

A small, self-contained interactive scene — a view through a large window that is
re-lit continuously by the visitor's **real local time of day**. Open `index.html`
at 6:30 AM and you see pastel dawn + mist; open it at 11:30 PM and you immediately
see moon, stars and glowing windows. Leave it open and it keeps evolving.

No frameworks. No libraries. No images. No build step. Just `index.html`,
`style.css`, `script.js` opened directly in a browser.

## 1. Concept

One physical place, seen through one window, at every hour:

- **Early morning** — soft dawn pastels, low sun, thin mist over the rooftops
- **Daytime** — bright blue sky, high warm sun, drifting white clouds
- **Golden hour (~5–6 PM)** — low amber sun, warm wash, long shadows + birds
- **Evening** — violet/amber twilight fading into dusk, windows lighting up
- **Night** — dark blue sky, moon, twinkling stars, lamps and lit windows

The skyline, hills, ground, room wall and window frame never swap — they are
re-coloured and re-lit by interpolation, so the transition feels like looking
outside rather than changing slides.

Scene elements (all pure HTML + CSS shapes/gradients, no images/SVG/canvas):

sky, sun, moon, 90 stars, 5 clouds, mist, 6 birds, far/near hills,
far/near skyline with lit windows, ground, street lamps, warm wash,
night dim, glass glare, frame + mullions, sill with plant / books / mug,
live clock + phase label + timeline progress.

## 2. How real local time is detected

```js
function getTimeProgress(now) {
  const d = now instanceof Date ? now : new Date(); // device local time
  const decimal = d.getHours() + d.getMinutes()/60 + d.getSeconds()/3600 + ...;
  return { date: d, hours, minutes, seconds, decimal };
}
```

- Uses the browser's `Date`, which reflects the device OS timezone — no API,
  no geolocation, no hardcoding.
- `tick()` runs immediately on script load and then every 1000 ms via
  `setInterval`, so the clock (`11:42 PM` style) and the scene stay correct
  while the page is open with no clicks or refreshes.

## 3. How continuous transitions are calculated

Time is treated as a continuous `h ∈ [0, 24)` float, not as categories.

- **Sky:** 13 keyframe stops (midnight → pre-dawn → dawn → morning → midday →
  afternoon → golden start/peak → sunset → twilight → night → midnight).
  `skyAt(h)` finds the surrounding stops and lerps top/mid/bottom RGB with a
  smoothstep easing, then writes `--sky-top/mid/bot`.
- **Sun:** arc `p = (h − 6.0) / 12.6`, elevation `sin(π·p)`, `x = 8 + p·84%`,
  `y = 78 − elevation·62%`. Opacity fades over 0.4 h at rise/set — no pop.
  Tint lerps pale-yellow (noon) → amber (low) → deep orange (golden boost);
  glow strengthens when the sun is low.
- **Moon:** mirrored arc over the 11.4 h night with the same positioning math.
- **Stars / night:** `starOpacityAt(h)` is 1 at deep night, 0 across the day,
  linearly ramped 5:00→7:30 AM and 6:00→8:30 PM. That single `nightF` factor
  drives cloud colour, city/hill/ground/wall re-lighting, window lights, lamps,
  night dim and overall `brightness`.
- **Clouds, mist, glare, warmth, shadows:** each is a closed-form function of
  `h` (e.g. mist peaks at 6.4 AM, warm wash peaks at 5:36 PM). All are written
  as CSS custom properties every tick; per-second steps are small enough to
  look perfectly gradual, and `transition: … 1.2–1.5s linear` on positioned /
  opacity layers smooths the 1 s quantisation further.

Categories (dawn/day/golden/twilight/night) only choose the *label text* —
never the visuals.

## 4. Golden-hour special moment

**Golden Hour Birds — 5:00 PM to 6:00 PM local (`17.0 ≤ h < 18.0`).**

`updateSpecialMoment(h)` returns an opacity that is 0 outside the window and
ramps with a 10-minute smoothstep fade at each edge:

```js
fadeIn  = clamp((h − 17.0) / (1/6), 0, 1)   // 17:00 → 17:10
fadeOut = clamp((18.0 − h) / (1/6), 0, 1)   // 17:50 → 18:00
opacity = smoothstep(min(fadeIn, fadeOut))
```

- Sets `--birds-opacity`; the flock (6 CSS birds flapping + drifting across
  the sky on infinite CSS animations) fades in/out as a whole.
- Adds `+0.12` to the warm-wash factor while present, so golden light feels
  stronger when the birds are there.
- Fully automatic: no buttons, disappears on its own after 6 PM.

## 5. Immediate correct state

- `script.js` sits at the end of `<body>` and calls `buildStars(); tick();`
  synchronously — the first `tick()` computes `new Date()` and writes every
  CSS variable before the first paint completes.
- There is no loading screen and no intro animation from midnight; opening at
  11:30 PM paints 11:30 PM on frame one.
- Sensible CSS fallback values (morning) exist only for the no-JS case.

## 6. Responsive approach

- Fluid layout: `width: min(1080px, 100%)`, window `height: min(60vh, 560px)`,
  `clamp()` for sun/moon/clock sizing — composition and hierarchy preserved.
- Flex column (`UI → window → timeline`); skyline buildings use `flex: 1` so
  they reflow to any width; clouds/birds travel in viewport units but are
  clipped by `overflow: hidden`.
- Breakpoints at 720 px and 420 px shrink the frame, mullions, sill objects
  and type; `overflow-x: hidden` + `max-width: 100vw` guarantee no horizontal
  scroll.

## 7. Assumptions made

- Device clock is correct; timezone handling is delegated to `Date`.
- Sunrise ≈ 6:00 AM / sunset ≈ 6:36 PM fixed for the stylised arc (no
  seasonal/latitude solar math — keeps the file small and predictable).
- Golden hour fixed at 5–6 PM to match the brief's example window.
- Indoor wall is stylised (re-lit slightly at night) rather than a
  physically-accurate interior render.
- Stars are randomly scattered once per load (not real constellations).

## 8. What could be improved with more time

- True solar position (latitude + date via a small solar-noon approximation)
  so sunrise/sunset shift seasonally.
- A draggable 24 h scrubber (progressive enhancement; time-driven scene stays
  default) for evaluators to preview every moment without changing OS clocks.
- More foreground life: curtains swaying, rain variant, distant plane at night.
- Canvas-free parallax on mouse move (sub-pixel layer translate, still CSS).
- Snapshot tests that stub `Date` and assert CSS variables at 06:30 / 12:00 /
  17:30 / 23:30.

## 9. How to run

No install, no server, no build:

1. Unzip / clone this folder.
2. Double-click `index.html` — or right-click → Open With → any modern browser.
3. To test moments quickly, change your OS clock (or DevTools → Sensors →
   location/timezone) and reload; or keep the page open across the hour.

Files: `index.html` · `style.css` · `script.js` · `README.md`
Verified: immediate correct state, per-second live clock, smooth day→night
ramps, birds only 5–6 PM, mobile + desktop layouts, zero dependencies,
zero console errors.
