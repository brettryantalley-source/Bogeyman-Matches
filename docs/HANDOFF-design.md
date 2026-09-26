# Design brief: Ghost Match redesign

For a **Claude Design** thread. This describes what the app does, what each screen must contain,
and the conditions it is used in. It does **not** describe how the app currently looks, on purpose:
the redesign starts from zero on colour, type, shape and layout. Screenshots of the current build are
attached separately as evidence of the content, not as a reference to follow.

Output is a visual direction; a Code thread rebuilds it in the repo afterwards. The engineering
handoff is `docs/HANDOFF-redesign.md`.

---

## 1. What it is
A golf app one person uses on an iPhone, on the course. Two jobs:
1. **A match against a ghost.** The ghost is the golfer's own recent form projected onto the course
   being played. It has a fixed score on every hole. The golfer logs a score per hole and the app
   scores the match: six 3-hole segments (1 point each, ½ for a tie), front nine (½), back nine (½),
   total (1) — 8 points. The feeling to capture: a head-to-head match against a silent,
   ever-present opponent — competitive, a little haunted, quietly satisfying to track hole by hole.
2. **A caddie.** Before every shot it says which club, where to aim, and why. The "why" is always one
   or two short lines that cite the golfer's own statistics.

## 2. Who, where, how
- **One user.** Mid-handicap, plays for par on every hole.
- **Outdoors, in sunlight, one-handed,** a glove on the other hand, frequently no signal.
  Glanceable beats complete.
- **Frequency:** the caddie screen ~70 times a round (every shot), the match screen 18 times (once
  per hole), setup once per round, the summary once, the history rarely.
- **Voice of the caddie:** second person, present tense, no exclamation points, numbers not
  adjectives. Example: "130–150 is your best number: 73% GIR, ~26 ft."

## 3. Structure
Five screens. A round opens on the Caddie. Caddie and Match are one action apart in both
directions and share the current hole, so switching on hole 7 lands on hole 7.

```
Setup ──start──▶ Caddie ◀──toggle──▶ Match ──finalize──▶ Summary ──new round──▶ Setup
   └──▶ History (from Setup)
```

## 4. Screens: required content and states

### A. Caddie — the screen that matters
Must contain:
- Hole identity: number of 18, par, scorecard yardage, stroke index; the course name.
- **A map of the hole**, satellite, oriented so the green is at the top. Layers the engineering
  side already supplies: bunkers, water, the hole's centreline, the green outline, the golfer's
  position with an accuracy ring when GPS is poor, and a **landing ellipse** for the recommended
  club with 48 dots on its rim, each dot flagged when that miss would land in trouble.
- **Where you are:** the phase (tee / approach / short / putt) chosen automatically from GPS, and
  the distance to the green's front, middle and back. The golfer can override the phase and hand
  it back to automatic.
- **The distance** the recommendation is based on. GPS fills it; the golfer can type over it
  (a laser rangefinder beats GPS) and revert. On the green it is a putt length in feet and is
  always typed, because GPS cannot resolve feet.
- **Conditions:** lie (fairway / rough, approach only) and flags: tight, water left, water right
  (remembered per hole per course), wet, wind (kept for the round). Set rarely.
- **The recommendation:** the club (the headline), a swing note (stock / easy), a one-line
  summary (what it leaves, which zone that is and how good that zone is for this golfer, where to
  aim), one or two why-lines, and a quiet **ghost status line** ("Ghost: 4") that is information
  only, never a control.
- **Alternatives:** the other clubs with what each leaves; choosing one shows its card so the
  golfer can see why it lost. On the tee one club is banned and should read as such.
- Hole navigation and a way to the Match screen to log the score.
- Exit the round (with a confirmation when scores exist).

States to design: on the tee with GPS · approach at 140 · inside 50 · on the green · no GPS fix ·
GPS denied · no green mapped for this hole (the golfer stands on it and marks it) · hole map still
fetching / failed · wet flag on (club goes up two) · a typed distance overriding GPS · a manually
overridden phase · an alternative club selected.

Real content for mockups (use these; do not invent numbers):
- Tee: **2-hybrid** · stock · leaves ~138 · green zone · "130–150 is your best number: 73% GIR,
  ~26 ft." · "Driver leaves 107 — red zone — and 1 in 4 drives finds trouble." · Ghost: 4 ·
  alternatives 2Hy 138 · 2i 135 · Dr 107 · 4Hy 163 (banned) · distances 415 to middle, front 400,
  back 433 · GPS ±5 m.
- Tee, tight: second line "Your driver corridor is 108 yds. Need 50 clear each side."
- Approach 140, fairway: **9-iron** · stock · 140 · green zone · aim center · "130–150 is your best
  number — go at it. 73% GIR, ~26 ft." · front 125, back 158 · alternatives PW 136 · 9i 152 · 8i 169.
- Approach 108: **gap wedge** · easy · 108 · red zone · aim back-center · "100–130 is a
  damage-control number (36% GIR). Center of the green, take the 30-footer." · "GW comes up short
  24%. Long almost never. Back-center."
- Approach 165, rough: **8-iron** · "150–180 is a damage-control number (34% GIR). Center of the
  green, take the 30-footer." · "From the rough you're fine — PW 83%, 9i 75% GIR from rough. Don't
  over-protect."
- Wet at 140: **7-iron** · carry the number · "Wet: no roll-out. 7-iron is 2 clubs up from your
  stock 9-iron so 140 carries."
- Short, 30 yards: "Land it pin-high or past — you're short 27% inside 25. From here your median
  is 14 ft; the up-and-down is the putt."
- Putt, 18 ft: "Start it a ball-width left of your read — 62% of your misses out here are right."
- Putt, 30 ft: "Two-putt. Finish inside 3 ft, not 6 — your 4–6 footer is 42%."
- Small-sample suffix: "… 83% GIR, ~23 ft. (small sample)"
- Banned club tapped: "4-hybrid off the tee: 36% trouble off the tee, −0.32 SG/shot."

Zones are graded best / neutral / worst for this golfer and the grade should be legible at a
glance; how is open.

### B. Match — the ghost game
Must contain: the same hole identity and course; **match points** for the golfer and the ghost
with the live margin (e.g. 2.5 to 0.5, "1 up"); a running picture of strokes versus the ghost across
the round; the six 3-hole segments (won / lost / halved, or the live margin while open); front
nine, back nine and total; an **18-hole board** showing per hole whether the golfer beat, lost to,
or tied the ghost, with the current hole marked and any hole tappable to jump; **score entry** for
the current hole — the goal is **one tap for par** (par centred; today a roll-and-tap dial; the
ghost's score for the hole and the stroke index shown alongside); logging a score advances the
hole automatically; **Finalize** once every hole has a score; the way back to the Caddie; exit
with confirmation.

Real content for a mid-round mockup: Sugar Creek Golf Club, Blue tee, 70.1/125, par 71; the ghost
plays to 78. Hole 7, par 4, stroke index 5; the ghost makes 4 here. Match so far YOU 2.5 · GHOST
0.5, "1 UP". Segments: S1 won (14–15), S2 won (14–16), S3–S6 not yet played. Front nine leading,
back and total open. Per hole so far: H1 tie, H2 loss, H3 win, H4 win, H5 win, H6 win.

### C. Setup
Must contain: a build/version tag the golfer reads to confirm a new deploy loaded; entry to
History; **course search** (network, debounced, with a region filter) and **tee selection**;
the golfer's **last-5 differential** with a stepper and a source line ("your official last-5 (Sep 5)"
or "from your last five rounds"); the **selected course card** (name, tee, "ghost plays to 8",
par, rating/slope, and the ghost's projected gross, e.g. 80); **pre-round readiness**: hole map
status (e.g. 18/18 greens found / fetching / failed, tap to retry) and satellite offline status
(saved · 254 tiles / not saved, tap to save on wifi); **Start round**. Setup is the only screen
used with reliable signal, so it is where readiness lives.

### D. Summary
The finished round: final score versus the ghost, match result, a full 18-hole scorecard with
par-relative marks (birdie, eagle, bogey, double), per-hole edit, and New round.

### E. History
Past rounds with per-round delete, the win–loss–tie record (e.g. 4–2–1, streak W2, average margin
+1.4), cloud backup sign-in and status, manual export/import. Lower priority; bring into the
system, do not re-think the information.

## 5. Functional constraints (not visual ones)
- 375×812 portrait is the frame. No landscape.
- Offline-first: no webfonts or remote assets in the UI; the map degrades to drawn geometry on a
  plain background when tiles are missing.
- The ghost status line on the Caddie is information, never a control.
- Every why-line cites a number; wording may change, the cited number may not.
- Thumb reach for the things used one-handed: score entry, hole navigation, the Caddie ↔ Match
  switch, Start.
- The map must carry a small attribution line ("© MapTiler © OpenStreetMap contributors").
- The build tag on Setup must exist somewhere visible.

## 6. Deliverables
1. Three distinct directions for the Caddie screen, tee state, before anything else.
2. After one is chosen: tokens (colour, type, spacing, radius), a component set (headers, cards,
   chips/toggles, sheets, numeric input, score entry), and the Caddie in the states listed in §4A.
3. Match, then Setup (ready and not-ready), then Summary and History.
4. A one-page rationale a Code thread can follow, screen by screen.

## 7. Attachments
Screenshots of the current five screens at 375×812, as evidence of content and density only.
The Code thread can produce them with `docs/HANDOFF-redesign.md` §9, or take them on the phone.
