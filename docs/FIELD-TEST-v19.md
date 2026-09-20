# Field test — Caddie + Hole View (v19) at Hampton Golf Village

Session 5 of the Caddie build is the on-course test. Everything below can only be checked by
walking the course with the phone. Bring a laser if you have one: it is the reference for GPS.

## Before you leave the house (on wifi)

1. Open the app. Setup should read **v19 · Sep 19** top-right.
2. Pick Hampton Golf Village and your tee. Under the ghost preview you should see
   `Hole map · 18/18 greens from OpenStreetMap`. If it says `Fetching hole map…` for more than
   30 s or `Hole map failed — tap to retry`, tap it once; Overpass rate-limits by IP and the app
   tries a second endpoint.
3. Tap `Satellite offline · 0/254 tiles — tap to save on wifi`. It should finish inside a minute
   and turn green: `Satellite saved for offline · 254 tiles`.
4. Airplane mode. Force-quit and reopen the app. Start a round. The Caddie should draw the
   satellite from cache with the hole outline; if you see a dark box with the green outline and
   no imagery, the tile cache did not take — note it and turn airplane mode off.
5. First GPS use: iOS asks for Location. Allow **While Using** with **Precise** on. The chip
   should go from `Finding GPS…` to `GPS ±N m` within ~10 s outdoors.

## On the course — every hole

Note anything that surprises you. Specific things to watch:

| Check | Expect | Note if |
|---|---|---|
| Phase on the tee | `TEE · nnn to middle` without touching anything | it says APPROACH on the tee (yardage in the API may be off, or the tee box is far from the OSM centreline start) |
| Distance vs laser | within ~5 yds to the middle | consistently long or short — say which holes and by how much |
| Front / Back | F < middle < B, spread 20–40 yds | a green shows F/B 12 yds apart (no polygon — it is using centre ∓ 12) |
| Phase after the drive | flips to APPROACH as you walk past the 40-yd band | it stays on TEE at your ball |
| Inside 50 | SHORT | it flips at the wrong spot |
| On the green | PUTT, `on the green` | it thinks you are off the green when you are on it (polygon offset) |
| Ellipse | your normal miss pattern fits inside it | it looks wildly wide/deep for a club |
| Red rim dots | red only where a miss really is wet/sand | red over fairway, or green over water |
| Club call | agrees with what you would hit for par | you overrule it — say why, that is tuning data |
| Why lines | true to your game | a number feels wrong (that is a profile.json refresh, not code) |
| Ghost line | matches the ghost score on Play | anything else |

If a hole has no green outline, stand on the middle of the green and tap
`Stand on the green · tap to mark it`. That mark persists for this course.

## After the round — what tunes

Constants live in `src/profile.json → constants`. Change one at a time, rerun `npm test`,
then compare the tee calls on the holes you disagreed with.

| Constant | Now | Moves |
|---|---|---|
| `penaltyCost` | 1.1 | how hard a penalty-prone club is punished |
| `recoveryCost` | 0.8 | same for recovery shots |
| `tightTax` | 0.15 | how much `tight` penalises clubs wider than 60 yds |
| `waterSideTax` | 0.10 | how much water on the big-miss side penalises the driver |
| `shrinkK` | 10 | how much small-sample zones are pulled toward the bench prior (do not remove) |
| `strokeToParScale` | 0.5 | one lost stroke ≈ this much chance of par |

Open decisions carried from Session 1:
- **Par-5 reach branch.** The spec scores a go-for-it second shot with `parScore(leave)`, which
  undervalues it against a layup, so driver loses to 2-hybrid on short par 5s. Watch what the
  card says on 2, 7, 12 and 17 and whether you agree. The fix is one function: `secondShot` in
  `src/caddie.js`.
- `constants.parBase` (0.60) is defined but unused by any spec formula.

Copy: every why-line is a template in `src/caddie.js`. If a line reads wrong out loud, quote it.
