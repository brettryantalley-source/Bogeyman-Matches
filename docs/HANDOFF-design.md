# Design brief: Ghost Match redesign

For a **Claude Design** thread. Output is a visual direction that a Code thread will rebuild in the
repo; nothing here is implemented directly. The engineering handoff is `docs/HANDOFF-redesign.md`.

---

## 1. The product in three sentences
Ghost Match is a golf PWA one person uses, on an iPhone, on the course. Brett plays a match against
a "ghost" — his own recent form projected onto the course — and, since v18, has a caddie that tells
him which club, where to aim, and why, with the "why" always citing one of his own numbers. It runs
alongside Shot Pattern (his shot tracker) and borrows that app's dark look.

## 2. Who, where, how
- **One user.** Brett, mid-handicap (last-5 differential ≈ 8), plays for par on every hole.
- **Outdoors, in sunlight,** phone in one hand, glove on the other, often no signal. Glanceable
  beats complete. Big numbers, few words, high contrast on a black ground.
- **Cadence:** look at the Caddie before every shot (~70 times a round), tap a score on Play after
  every hole (18 times), touch Setup once per round, Summary and History rarely.
- Tone of voice: casual, competitive, second person, present tense, no exclamation points,
  numbers not adjectives. "130–150 is your best number: 73% GIR, ~26 ft." not "Great zone!"

## 3. What exists today (design tokens and idiom)
```
Ground      #000000        cards #161719 / #212327      hairline #2A2D31
Ink         #FFFFFF        secondary #8A8F98
Brand green #57C77F  (icon, YOU, ghost ring, best zone, GPS-filled numbers)
Ghost slate #9AA7B4  (everything the ghost owns, incl. the "Ghost: 5" status line)
Red         #FF5B52  (losses, water)   amber #D4A94A (bunkers, neutral zone)   worst zone #C9645E
Type        system (SF Pro Display for numerals, SF Pro Text otherwise), tabular numerals,
            800-weight labels at 11px with 1px tracking, hero numerals 34–46px
Shapes      16–18px radius cards, 10px radius chips, 1px hairlines, no shadows
Icons       thin-stroke lucide (X, chevrons, flag, ghost mark)
```
Keep the black ground and the brand green. Everything else is negotiable.

## 4. Screens to design, in priority order

### A. Caddie (the one that matters)
Content on screen, top to bottom today: header (exit · course · GHOST toggle · HOLE 1/18) →
satellite map, hole-up, ~36% of the height → a phase line (`APPROACH · 140 to middle · F 125 · B 158`,
tap to override, AUTO to hand back) → two status chips (`GPS ±5 m`, `OSM green`) → a 46-px
distance number (green when GPS filled it, white when typed) → lie chips (approach only:
fairway / rough) → flag chips (tight · water L · water R | wet · wind) → **the card** (club name
big, swing tag, a coloured zone line, two why-lines, `Ghost: 5` in slate) → alternative-club chips
(`PW 136 · 9i 152 · 8i 169`, 4-hybrid struck through on the tee) → hole nav (‹ · Score this hole · ›).

Problems to solve:
1. The card is the point of the screen and it sits below the fold on the tee.
2. The distance number reads as the headline; the club name should.
3. Status chips and the hole-map line matter only when something is wrong (no GPS, no green,
   map still fetching). Design their error states, then make the happy state nearly invisible.
4. Flags are set once per hole at most. They do not need a permanent row.
5. The phase line carries four facts (phase, middle, front, back) plus two affordances.

States to show: on the tee with GPS · approach at 140 · inside 50 · on the green (putt: no map
ellipse, typed feet, a hint that GPS cannot read feet) · no GPS fix · no green for this hole
("stand on it and tap to mark") · hole map fetching / failed · wet flag on (club goes up two).

Real copy to use in mockups (do not invent numbers):
- Tee: **2-HYBRID** · stock · `leaves ~138 · GREEN ZONE` · "130–150 is your best number: 73% GIR,
  ~26 ft." · "Driver leaves 107 — red zone — and 1 in 4 drives finds trouble." · `Ghost: 4`
- Tee, tight: second line becomes "Your driver corridor is 108 yds. Need 50 clear each side."
- Approach 140: **9-IRON** · stock · `140 · GREEN ZONE · center` · "130–150 is your best number —
  go at it. 73% GIR, ~26 ft."
- Approach 108: **GW** · easy · `108 · RED ZONE · back-center` · "100–130 is a damage-control
  number (36% GIR). Center of the green, take the 30-footer." · "GW comes up short 24%. Long
  almost never. Back-center."
- Approach 165 from rough: **8-IRON** · "150–180 is a damage-control number (34% GIR). Center of
  the green, take the 30-footer." · "From the rough you're fine — PW 83%, 9i 75% GIR from rough.
  Don't over-protect."
- Wet at 140: **7-IRON** · `carry the number` · "Wet: no roll-out. 7-iron is 2 clubs up from your
  stock 9-iron so 140 carries."
- Short, 30 yds: "Land it pin-high or past — you're short 27% inside 25. From here your median is
  14 ft; the up-and-down is the putt."
- Putt, 18 ft: "Start it a ball-width left of your read — 62% of your misses out here are right."
- Putt, 30 ft: "Two-putt. Finish inside 3 ft, not 6 — your 4–6 footer is 42%."
- Small sample suffix: "180–190 is your best number — go at it. 83% GIR, ~23 ft. (small sample)"
- Tapping 4-hybrid on the tee: "4-hybrid off the tee: 36% trouble off the tee, −0.32 SG/shot."

Map layers (given, from the engineering side): satellite, hole-up; bunkers in amber outline, water
in red; dashed centreline; green outline in brand green; the club's landing ellipse (white hairline,
faint fill) with 48 rim dots, green normally and red where a miss lands in trouble; accuracy ring
when GPS is worse than 8 m; white player dot. Attribution `© MapTiler © OpenStreetMap contributors`
must stay legible in a corner.

### B. Play (the ghost match)
Fixed full-height, nothing scrolls: header (exit · course · CADDIE toggle · HOLE) → scoreboard
(YOU 3 · 1 UP · GHOST 2, 34-px numerals) → running strokes-vs-ghost chart → six 3-hole segment
cells (S1…S6 with won/lost/half or live margin) → FRONT 9 / BACK 9 / TOTAL pills → an 18-cell hole
board (green = beat the ghost, red = lost, grey = tie, current hole outlined) → the score dial
(roll to your number, tap to log; par centred) → Finalize button when the round is complete.
Tapping a score auto-advances the hole. The Play ↔ Caddie toggle sits in the same header slot on
both screens so it reads as one control; a segmented control or a swipe are both fair game.

### C. Setup
Build tag top-right (`v19 · Sep 19`, the deploy counter Brett reads to confirm a new build) →
Round history row → course search (debounced, with a state filter) → YOUR LAST-5 DIFFERENTIAL
stepper with a source line (`Last-5: 8.2 · your official last-5 (Sep 5)`) → the selected course
card: name · tee · "Ghost plays to 8 · par 72 · 71.2/128" · a ghost ring showing 80 · then two
status lines that grew in v18.5/v19: `Hole map · 18/18 greens from OpenStreetMap` and `Satellite
saved for offline · 254 tiles` (or `Satellite offline · 0/254 tiles — tap to save on wifi`) →
START pinned at the bottom. The pre-round checklist ("ready for offline") wants a real home.

### D. Summary and E. History
Lower priority. Summary: FINAL · course, a full scorecard in Shot Pattern notation (circle =
birdie, double circle = eagle, square = bogey, double square = double+), per-hole edit, New round.
History: rounds list with per-round delete, W-L-T record, cloud backup panel (Google sign-in),
manual export/import as JSON. Bring them into the same system; do not redesign their information.

## 5. Constraints that are not up for discussion
- Black ground, the brand green, system type (no webfonts: offline-first, no signal at the course).
- The ghost is a **status line** on the Caddie, never a control. `Ghost: 5` stays slate and quiet.
- Every why-line cites a number. Wording can change; the number cited cannot.
- Two screens with a toggle. A round opens on the Caddie. Play must be one tap away and back.
- Thumb reach: the score dial, the hole nav, START, and the toggle are used one-handed.
- The map's attribution line, the build tag on Setup, and the hole map / satellite status must
  exist somewhere visible.
- 375×812 is the design frame. No landscape.

## 6. Deliverables
1. Tokens: colour (with the light-on-black contrast checked for sunlight), type scale, spacing,
   radius, one chip system, one card system, one header pattern, one bottom sheet.
2. Caddie: the eight states in §4A at 375×812.
3. Play: one screen, plus the toggle interaction.
4. Setup: one screen showing the pre-round-ready state and the not-ready state.
5. Summary and History: one screen each, tokens applied, no new information.
6. A one-page rationale a Code thread can follow: what changed and why, screen by screen.

## 7. Inputs to attach
Screenshots of the current five screens at 375×812. The Code thread can produce these with the
recipe in `docs/HANDOFF-redesign.md` §9, or take them on the phone. The app icon is
`icon-512.png` in the repo root.
