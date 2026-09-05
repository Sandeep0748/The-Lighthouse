# The Lighthouse

A small, self-contained web creative — a coastal headland that is re-lit
continuously by the visitor's **real local time of day**. Open `index.html` at
noon and gulls ride a bright sky over glittering water; open it at midnight and
a rotating beam sweeps dark seas under the stars. Leave it open and it keeps
evolving — including a short "First Light" moment only at dusk.

No frameworks. No libraries. No images. No build step. Just `index.html`,
`style.css`, `script.js` opened directly in a browser.

## How it works

- **Real time:** `getTimeProgress()` reads the device clock via `new Date()`
  into a continuous decimal hour. `tick()` runs immediately on load (correct
  first paint, no warm-up) and every second after — no clicks, no refresh.
- **Continuous change:** 13 sky keyframes are lerped with smoothstep; sun and
  moon ride sine arcs; one `nightF` factor (from star opacity) re-lights the
  sea, rocks, lamp, beam and brightness. Categories only pick label text.
- **Special moment — "First Light", 6:30–7:00 PM local:** the lamp glass warms
  from 6:20 PM, the rotating double beam fades up, and a lit ship crosses —
  all with 10-minute smoothstep fades, all time-gated, zero on screen by day.
- **Responsive:** fluid card (`min(1080px, 100%)`, `clamp()` sizing),
  breakpoints at 720/420 px, no horizontal scroll.
- **Accessibility:** semantic landmarks, live clock/label regions, synced
  `aria-label` on the scene, `prefers-reduced-motion` freezes drift/sweep
  while keeping the correct time state.

## Assumptions

Device clock is correct; sunrise ≈ 6 AM / sunset ≈ 6:36 PM fixed (no
seasonal solar math); first light fixed at 6:30–7 PM to sit just after
sunset; gulls are stylised silhouettes, not real species.

## What I'd improve with more time

True solar position from latitude + date; a moon glitter path tracking the
moon's x-position; foghorn sea-fog variant on damp mornings; a scrubbable
24 h preview (progressive enhancement, time-driven by default).

## Run

Double-click `index.html` — or right-click → Open With → any modern browser.
To preview moments, change the OS clock and reload.

---

## One-page note (submission)

**Approach.** I wanted the strongest possible day/night contrast, so I chose
a lighthouse: by day it's gulls and glittering water; by night it's a
sweeping beam. One scene, re-lit — never swapped. The time engine from my
first concept (window) carried over untouched: sky stops, sun/moon arcs,
star-derived `nightF`. Only the "actors" changed — tower, beam, ship, sea.

**Always correct.** `new Date()` is the single source of truth, sampled on
script evaluation before first paint and re-sampled every second via
`setInterval`. Every visual is a pure function of that value, so any load
time paints the right frame immediately and the page self-corrects across
hour boundaries with the tab open.

**Assumptions.** Device clock trusted; fixed stylised sunrise/sunset;
first-light window fixed at 6:30–7 PM; no geolocation (would add permission
friction for zero visual gain at this fidelity).

**With more time.** Seasonal sun times, moon glitter path, preview scrubber,
sea-fog variant — in that order.
