# Bogeyman Matches — Development Log

**Log revision:** v3 · **current through app build:** v6 (commit `147fc7b`)
**Live:** https://brettryantalley-source.github.io/Bogeyman-Matches/ · **Repo:** brettryantalley-source/Bogeyman-Matches

A self-contained single-page golf side-game PWA (React UMD, no framework), deployed
as a static site on GitHub Pages and installed on Brett's iPhone. Brett plays
head-to-head against a handicap-calibrated "ghost" scored from his last-5 rolling
differential. See `CLAUDE.md` for standing rules and `HANDOFF.md` for cross-machine
resume context.

## Working-copy rule (learned the hard way)
The project existed as two clones of the same GitHub repo — an iCloud `Claude/` clone
frozen at v4 (never `git fetch`ed) and the `ClaudeCode/` clone at v5. The stale clone
caused a false "the sheet differential was never built" conclusion (it shipped as v5).
**Single source of truth = the `ClaudeCode/` clone; sync machines via GIT, not iCloud;
always `git fetch` and check `origin/main` before judging what exists.**

## Frozen invariants (do not change without an explicit ask)
- Scoring engine `computeGhost` / `evalMatch` — verified, treat as frozen.
- localStorage schemas: in-progress round `bogeyman-matches:v1`; match history
  `bogeyman-matches:history:v1`; differential cache `bogeyman-matches:diff-cache:v1`;
  per-course cache `course_cache_{id}`.
- Deploy loop (CLAUDE.md): edit `src/app.jsx` → `./build.sh` → bump BOTH `BUILD`
  (app.jsx) and `CACHE` (sw.js) together → show a diff → wait for explicit "go" → push.

## Version history
On-screen build tags began at v4 (when the tag + sw-cache-sync rule was introduced);
earlier commits predate the counter.

| Build | Commit | Date | What shipped |
|-------|--------|------|--------------|
| v6 | `147fc7b` | Jul 20 | **Live golfcourseapi.com course search** replaces the hardcoded 14-course library (debounced search, per-course caching, male/female tee picker skipping non-18-hole tees, spec'd error states). **One-screen Setup** (START pinned, never behind a scroll). Per-hole yardage stored in rounds → scorecard yardage row. sw.js same-origin guard so live API/CSV never serve stale from cache; build.sh npx-esbuild fallback. |
| v5 | `0ed33dc` | Jul 18 | **Auto last-5 differential** from Brett's published Google Sheet CSV (read-only): cache-first → network → manual fallback, source/as-of label, per-round manual override with USE SHEET revert. Fed into the existing `diff`; write-back deferred to Phase 2. |
| v4 | `03a60e9` | Jul 18 | Docs: require bumping the on-screen build tag in sync with the sw cache on every user-facing deploy. |
| v4 | `0382b36` | Jul 18 | On-screen build tag on Setup; match history with per-round delete. (Build-tag counter starts here.) |
| v4 | `864e35e` | Jul 18 | Tier 1: Finalize → Summary, full scorecard, inline hole edit, W-L-T record. |
| — | `e96b5b6` | Jul 18 | Docs: add `CLAUDE.md` project guide. |
| — | `387eaee` | — | Add Chicopee Sch/Mill routing; step differential by 0.1. |
| — | `0ac356d` | — | Add Bogeyman Matches PWA build. |
| — | `64ef061` | — | Initial commit. |

## v6 verification (live, mobile 375×812, real API)
Search → results → select → tee picker (15 Woodmont tees) → START enables · cached
re-select makes 0 Call-2 requests · full round → Finalize → scorecard YDS row renders ·
differential still auto-pulls (6.9 from Sheet) · manual override + USE SHEET intact ·
record `1–0–0 · W1 · +8.0` + History/delete intact · build tag `v6 · Jul 20`, sw cache
`bogeyman-matches-v6` · no old course library · one screen, START pinned.

## Field-test watch-list — first real round on v6 (report back what broke)
v6 was verified in a desktop browser at phone size with the live API — NOT yet on
Brett's phone, on cellular, at a course, mid-round. On the first real round, watch:
- [ ] **Course search finds the actual course** you're playing (try the real name/spelling).
- [ ] **The tee you play is in the picker**, and its **rating / slope / stroke index look
      correct** — a wrong stroke index silently skews the ghost. Sanity-check the ghost's
      "plays to" number against expectation.
- [ ] **Signal at the first tee.** v6's course search REQUIRES connectivity the first
      time a course is loaded (it caches after). See the top next-step below.
- [ ] **Differential** still auto-pulls from the Sheet (6.9-ish) with the source label.
- [ ] **50/day API cap** — if search ever just errors, this may be why.
- [ ] Full round → **Finalize → scorecard yardage row** shows; **record/History** update.

## Next steps (suggested order)
1. **Offline "recently played courses" quick-pick (top functional gap).** v6's course
   search needs a connection to find a course the first time — but the app's whole
   premise is "runs at the first tee, often no signal." Add a quick-pick of
   cached/recent courses (from `course_cache_{id}`) so Brett can tee off offline on any
   course he's loaded before.
2. **Durable stats (Phase 2).** History + record are localStorage-only today — a cache
   wipe / reinstall / new phone erases them. Add a lightweight cloud datastore; keep it
   additive (localStorage stays as the offline cache, cloud layers on top).
3. **Friends on their own phones (Phase 2).** Per-person records via a light identity
   (name / per-device id), NOT password accounts, so friends' histories don't mix.
4. **Sheet write-back.** Deferred since v5 — the app reads the differential from the
   Sheet but never writes finished rounds back; unifying them keeps everything in Brett's
   Sheets ecosystem.
5. **Polish / untested edges:** force Call-2 failure/retry; a course with no valid
   18-hole tees; one-tee courses; an in-app way to correct a bad tee's stroke index/
   rating; a clearer "change course" affordance after New round.

Phase 2 stays "simple hosted PWA, no backend" until the app is finished. Candidate
low-friction backends to weigh later (pick one): Supabase/Firebase, Cloudflare Workers +
KV/D1, or a Google Apps Script appending rounds to a Sheet. Details in `HANDOFF.md`.
