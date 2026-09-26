# Design brief — Ghost Match (redesign directions)

A brief for a Claude Design session to explore fresh visual/UX directions for the
Ghost Match golf side-game. Scope is the ghost match ONLY — no caddie, club, aim, or
satellite features.

---

Design the phone screens (**375×812**) for **Ghost Match** — a golf side-game one person
plays against a "ghost": a projected opponent scored from the player's own recent form
(their last-5 handicap differential) laid onto the course being played. It's used
**outdoors, in sunlight, one-handed, often with no signal** — so: high contrast, big
legible numbers, thumb-reachable controls, and nothing that depends on live network, maps,
or satellite imagery.

**The game (so the screens carry the right info):** over 18 holes you win/lose/tie six
3-hole segments (1 pt, tie ½), the front 9 (½), the back 9 (½), and the total (1) — **8
points**. You log one score per hole; the ghost's per-hole number is fixed (no variance).
The feeling to capture: a head-to-head match against a silent, ever-present opponent —
competitive, a little haunted, quietly satisfying to track hole by hole.

**Real content — use this, no lorem:**
- Course: **Sugar Creek Golf Club — Blue tee, 70.1/125, par 71.** The ghost plays to a **78**.
- Currently **hole 7, par 4, stroke index 5**; the ghost makes **4** here.
- Match so far: **YOU 2.5 · GHOST 0.5 → "1 UP."** Segments: S1 **WON** (14–15), S2 **WON**
  (14–16), S3–S6 not yet played. Front 9 leading; back and total still open.
- Record vs the ghost: **4–2–1**, streak **W2**, avg margin **+1.4**. Last-5 differential: **6.9**.
- Per-hole result so far (you vs ghost): H1 tie, H2 loss, H3 win, H4 win, H5 win, H6 win.

**Screens to explore** (design the first two; add the third if it helps sell the direction):
1. **Mid-round — the hero.** Where the whole round is spent. It must: make the current hole
   unmistakable at a glance, let you **log a score fast** (one tap for par is the goal),
   **jump between holes**, and show **how the match stands** against the ghost.
2. **Course + round setup.** Pick course/tee, see your record vs the ghost, confirm the
   differential, start the round.
3. **Final / result.** Did you beat the ghost, the point breakdown, the scorecard.

**For context (don't feel bound by it):** today's mid-round shows a running "strokes vs
ghost" line, a segment + front/back/total breakdown, an 18-hole result board, and a
score-picker dial. Keep the information that earns its place; you're free to reorganize,
simplify, or drop the rest.

**Identity:** currently a dark, near-black theme with a single green accent (**#57C77F**)
and a hand-drawn ghost mark. **Treat that as one option, not a rule** — you can depart from
it entirely.

**Give me three distinct directions, not variations of one** — different enough in layout,
typography, and overall feel that choosing between them is a real decision. **No caddie,
club-recommendation, aim, or satellite features — this is only the ghost match.**
