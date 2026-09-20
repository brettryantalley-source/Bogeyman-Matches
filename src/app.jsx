import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, collection, doc, setDoc, getDocs } from "firebase/firestore";

const React = window.React;
const { useState, useMemo, useEffect } = React;
const { createRoot } = window.ReactDOM;

/* ---------- inline lucide-style icons ---------- */
const svgBase = {
  width: 24, height: 24, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round",
};
const Icon = ({ size = 24, color, children }) => (
  <svg {...svgBase} width={size} height={size} style={{ color: color || "currentColor", display: "block" }}>{children}</svg>
);
const ChevronLeft = (p) => <Icon {...p}><polyline points="15 18 9 12 15 6" /></Icon>;
const ChevronRight = (p) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>;
const Minus = (p) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const Plus = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
const Flag = (p) => <Icon {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></Icon>;
const RotateCcw = (p) => <Icon {...p}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></Icon>;
const Target = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Icon>;
const Ghost = ({ size = 24, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", color: color || "currentColor" }}>
    <path fill="currentColor" d="M4 10a8 8 0 0 1 16 0v10c-.7 1.3-3.3 1.3-4 0-.7 1.3-3.3 1.3-4 0-.7 1.3-3.3 1.3-4 0-.7 1.3-3.3 1.3-4 0z" />
  </svg>
);
const Trash = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>;
const Clock = (p) => <Icon {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>;
const MapPin = (p) => <Icon {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Icon>;
const X = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>;

/* build tag — bump alongside the sw.js cache version so a deploy is confirmable on-screen */
const BUILD = "v17 · Sep 19";

/* palette — Shot Pattern dark */
const C = {
  bg: "#000000", card: "#161719", card2: "#212327", ink: "#FFFFFF", sub: "#8A8F98",
  line: "#2A2D31", green: "#57C77F", greenDim: "rgba(87,199,127,0.15)",
  slate: "#9AA7B4", slateDim: "rgba(154,167,180,0.15)", red: "#FF5B52",
  redDim: "rgba(255,91,82,0.16)", tie: "#34373D",
};
const NUM = "-apple-system,ui-sans-serif,'SF Pro Display',system-ui,sans-serif";
const SANS = "-apple-system,ui-sans-serif,'SF Pro Text',system-ui,sans-serif";
const tnum = { fontVariantNumeric: "tabular-nums" };
const RESET = `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
button{font-family:inherit;cursor:pointer;border:none;padding:0;background:none}
html,body{margin:0;background:#000}
.dialscroll::-webkit-scrollbar{display:none}`;

/* ---------- live course source (golfcourseapi.com) ---------- */
const API_BASE = "https://api.golfcourseapi.com/v1";
const API_KEY = "Y2KP2ACTI2YKKBK5UAR244RBKA";
const apiHeaders = { Authorization: `Bearer ${API_KEY}` };
const courseCacheKey = (id) => `course_cache_${id}`;

/* Call 1 — search. Returns the `courses` array (may include inline tee data). */
async function searchCourses(query, signal) {
  const r = await fetch(`${API_BASE}/search?search_query=${encodeURIComponent(query)}&fuzzy_match=true`, { headers: apiHeaders, signal });
  if (!r.ok) throw new Error("search http " + r.status);
  const data = await r.json();
  return Array.isArray(data.courses) ? data.courses : [];
}

/* Call 2 — full course. Cache hit => no network. Miss => fetch + cache. Throws on failure. */
async function loadFullCourse(id) {
  try { const raw = localStorage.getItem(courseCacheKey(id)); if (raw) { const c = JSON.parse(raw); if (c && c.tees) return c; } } catch (e) { /* ignore */ }
  const r = await fetch(`${API_BASE}/courses/${id}`, { headers: apiHeaders });
  if (!r.ok) throw new Error("course http " + r.status);
  const data = await r.json();
  const course = data.course;
  if (!course || !course.tees) throw new Error("bad course payload");
  try { localStorage.setItem(courseCacheKey(id), JSON.stringify(course)); } catch (e) { /* quota */ }
  return course;
}

/* Flatten tees.male + tees.female into one picker list; skip any non-18-hole tee. */
function teeOptions(fullCourse) {
  const tees = fullCourse.tees || {};
  const out = [];
  ["male", "female"].forEach(gender => {
    const arr = Array.isArray(tees[gender]) ? tees[gender] : [];
    arr.forEach((tee, i) => {
      if (Array.isArray(tee.holes) && tee.holes.length === 18) out.push({ key: `${gender}:${i}`, gender, tee });
    });
  });
  return out;
}

/* Build the engine course object from a full course + a chosen tee option.
   Field mapping (do NOT rename): handicap->si, yardage->yards, course_rating->rating,
   slope_rating->slope, par_total->par. */
function buildCourse(fullCourse, teeOpt) {
  const t = teeOpt.tee;
  const name = fullCourse.club_name || fullCourse.course_name || "Course";
  return {
    id: `${fullCourse.id}:${teeOpt.key}`,
    name,
    tee: t.tee_name || teeOpt.gender,
    rating: t.course_rating,
    slope: t.slope_rating,
    par: t.par_total,
    holes: t.holes.map(h => ({ par: h.par, si: h.handicap, yards: h.yardage })),
  };
}

/* Validate a persisted course object before restoring an in-progress round. */
function validCourse(c) {
  return !!c && Array.isArray(c.holes) && c.holes.length === 18 &&
    c.holes.every(h => h && typeof h.par === "number" && typeof h.si === "number") &&
    typeof c.rating === "number" && typeof c.slope === "number" && typeof c.par === "number";
}

/* ---------- home-state filter (results have state; the API has no geo/coords) ---------- */
const HOME_STATE_KEY = "bogeyman-matches:home-state";
const GEO_URL = "https://api-bdc.io/data/reverse-geocode-client"; // free, no key, CORS-open reverse geocode
const US_STATES = [
  {c:"AL",n:"Alabama"},{c:"AK",n:"Alaska"},{c:"AZ",n:"Arizona"},{c:"AR",n:"Arkansas"},{c:"CA",n:"California"},{c:"CO",n:"Colorado"},{c:"CT",n:"Connecticut"},{c:"DE",n:"Delaware"},{c:"DC",n:"District of Columbia"},{c:"FL",n:"Florida"},{c:"GA",n:"Georgia"},{c:"HI",n:"Hawaii"},{c:"ID",n:"Idaho"},{c:"IL",n:"Illinois"},{c:"IN",n:"Indiana"},{c:"IA",n:"Iowa"},{c:"KS",n:"Kansas"},{c:"KY",n:"Kentucky"},{c:"LA",n:"Louisiana"},{c:"ME",n:"Maine"},{c:"MD",n:"Maryland"},{c:"MA",n:"Massachusetts"},{c:"MI",n:"Michigan"},{c:"MN",n:"Minnesota"},{c:"MS",n:"Mississippi"},{c:"MO",n:"Missouri"},{c:"MT",n:"Montana"},{c:"NE",n:"Nebraska"},{c:"NV",n:"Nevada"},{c:"NH",n:"New Hampshire"},{c:"NJ",n:"New Jersey"},{c:"NM",n:"New Mexico"},{c:"NY",n:"New York"},{c:"NC",n:"North Carolina"},{c:"ND",n:"North Dakota"},{c:"OH",n:"Ohio"},{c:"OK",n:"Oklahoma"},{c:"OR",n:"Oregon"},{c:"PA",n:"Pennsylvania"},{c:"RI",n:"Rhode Island"},{c:"SC",n:"South Carolina"},{c:"SD",n:"South Dakota"},{c:"TN",n:"Tennessee"},{c:"TX",n:"Texas"},{c:"UT",n:"Utah"},{c:"VT",n:"Vermont"},{c:"VA",n:"Virginia"},{c:"WA",n:"Washington"},{c:"WV",n:"West Virginia"},{c:"WI",n:"Wisconsin"},{c:"WY",n:"Wyoming"},
];
const STATE_SET = new Set(US_STATES.map(s => s.c));

/* engine (verified) — do not modify */
function computeGhost(c, d) {
  const hcp = Math.round(d * c.slope / 113 + (c.rating - c.par));
  const base = Math.floor(hcp / 18), rem = ((hcp % 18) + 18) % 18;
  const holes = c.holes.map(h => h.par + base + (h.si <= rem ? 1 : 0));
  return { holes, hcp, gross: holes.reduce((a, b) => a + b, 0) };
}
const TOTAL_PT = 1.0;
function evalMatch(scores, ghost) {
  let you = 0, opp = 0; const segs = [];
  for (let s = 0; s < 6; s++) {
    const idx = [s * 3, s * 3 + 1, s * 3 + 2];
    const played = idx.filter(i => scores[i] != null);
    const done = played.length === 3;
    const yourSum = idx.reduce((a, i) => a + (scores[i] ?? 0), 0);
    const ghostSum = idx.reduce((a, i) => a + ghost[i], 0);
    const liveMargin = played.reduce((a, i) => a + scores[i] - ghost[i], 0);
    let res = "live";
    if (done) { if (yourSum < ghostSum) { you += 1; res = "win"; } else if (yourSum > ghostSum) { opp += 1; res = "loss"; } else { you += 0.5; opp += 0.5; res = "tie"; } }
    segs.push({ idx, done, res, yourSum, ghostSum, holesIn: played.length, liveMargin });
  }
  const nine = (start) => {
    const idx = [...Array(9)].map((_, k) => start + k);
    const played = idx.filter(i => scores[i] != null);
    const done = played.length === 9;
    const yourSum = idx.reduce((a, i) => a + (scores[i] ?? 0), 0);
    const ghostSum = idx.reduce((a, i) => a + ghost[i], 0);
    let res = "live";
    if (done) res = yourSum < ghostSum ? "win" : yourSum > ghostSum ? "loss" : "tie";
    return { done, res, yourSum, ghostSum, liveMargin: played.reduce((a, i) => a + scores[i] - ghost[i], 0) };
  };
  const front = nine(0), back = nine(9);
  [front, back].forEach(n => { if (n.done) { if (n.res === "win") you += 0.5; else if (n.res === "loss") opp += 0.5; else { you += 0.25; opp += 0.25; } } });
  const allDone = scores.every(s => s != null);
  const yourTot = scores.reduce((a, s) => a + (s ?? 0), 0);
  const ghostTot = ghost.reduce((a, s) => a + s, 0);
  const liveMargin = scores.reduce((a, s, i) => s != null ? a + s - ghost[i] : a, 0);
  let totRes = "live";
  if (allDone) { if (yourTot < ghostTot) { you += TOTAL_PT; totRes = "win"; } else if (yourTot > ghostTot) { opp += TOTAL_PT; totRes = "loss"; } else { you += TOTAL_PT / 2; opp += TOTAL_PT / 2; totRes = "tie"; } }
  return { you, opp, segs, front, back, total: { res: totRes, yourTot, ghostTot, liveMargin } };
}
const scoreName = (s, par) => { const d = s - par; return d <= -3 ? "albatross" : d === -2 ? "eagle" : d === -1 ? "birdie" : d === 0 ? "par" : d === 1 ? "bogey" : d === 2 ? "double" : d === 3 ? "triple" : `+${d}`; };
// Points come in quarter increments (a tied nine splits 0.5 -> 0.25 each).
// Print them faithfully: integers plain, else up to 2 decimals with trailing zeros
// trimmed (2 -> "2", 2.5 -> "2.5", 2.25 -> "2.25", 5.75 -> "5.75"). Never round a quarter away.
const fmtPts = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/\.?0+$/, "");
const marginText = (m) => m === 0 ? "AS" : m < 0 ? `${-m}↑` : `${m}↓`;

/* ---------- auto last-5 differential, computed from the app's own finished rounds ----------
   Replaces the published-Sheet source (v5-v13). Every finalized round stores the parts
   needed to score itself; the Setup differential is the average of the most recent
   DIFF_WINDOW of them. Nothing is fetched — this works offline at the course. */
const DIFF_WINDOW = 5;
const fmtShortDate = (d) => { try { return `${MONTHS[d.getMonth()]} ${d.getDate()}`; } catch (e) { return ""; } };

/* Strokes received on each hole at a given course handicap. Same distribution the ghost
   gets in computeGhost — one stroke per hole by stroke index, hardest first, wrapping
   past 18 — so the player and the ghost are stroked off the same card. */
function strokesByHole(strokeIndex, hcp) {
  const base = Math.floor(hcp / 18), rem = ((hcp % 18) + 18) % 18;
  return strokeIndex.map(si => base + (si <= rem ? 1 : 0));
}
/* USGA-style adjusted gross: each hole capped at net double bogey (par + 2 + strokes
   received), so one blow-up hole can't inflate the differential. */
function adjustedGross(holeScores, pars, strokeIndex, hcp) {
  const str = strokesByHole(strokeIndex, hcp);
  return holeScores.reduce((a, s, i) => a + Math.min(s ?? 0, pars[i] + 2 + str[i]), 0);
}
/* Score Differential, rounded to 0.1. (No PCC — this is the simplified calc.) */
const scoreDifferential = (gross, rating, slope) => Math.round((gross - rating) * 113 / slope * 10) / 10;

/* Records written before v2 stored rating/slope only as the "70.1/125" string. */
function parseRatingSlope(s) {
  const m = /^\s*([\d.]+)\s*\/\s*(\d+)\s*$/.exec(String(s ?? ""));
  if (!m) return null;
  const rating = parseFloat(m[1]), slope = parseInt(m[2], 10);
  return isFinite(rating) && slope > 0 ? { rating, slope } : null;
}
/* One round's differential. v2 records carry pars + stroke indexes, so the gross is
   capped at net double bogey; older records have only the rating/slope string and fall
   back to an uncapped gross so they still count toward the last-5. null = unusable. */
function recordDifferential(r) {
  if (!r) return null;
  let rating = typeof r.rating === "number" ? r.rating : null;
  let slope = typeof r.slope === "number" ? r.slope : null;
  if (rating == null || slope == null) {
    const rs = parseRatingSlope(r.ratingSlope);
    if (!rs) return null;
    rating = rs.rating; slope = rs.slope;
  }
  if (!(slope > 0) || !isFinite(rating)) return null;
  const scores = Array.isArray(r.holeScores) ? r.holeScores : null;
  const canCap = !!scores && scores.length === 18 &&
    Array.isArray(r.pars) && r.pars.length === 18 &&
    Array.isArray(r.strokeIndex) && r.strokeIndex.length === 18 &&
    typeof r.par === "number" && typeof r.differentialUsed === "number";
  const gross = canCap
    ? adjustedGross(scores, r.pars, r.strokeIndex, Math.round(r.differentialUsed * slope / 113 + (rating - r.par)))
    : (typeof r.yourTotal === "number" ? r.yourTotal : null);
  if (gross == null || !isFinite(gross) || gross <= 0) return null;
  return scoreDifferential(gross, rating, slope);
}
/* Brett's official last-5 (GHIN) as of Sep 19 2026, so the app starts calibrated instead
   of cold. These seed the differential ONLY — they are not match records, so they never
   touch the W-L-T. Each in-app round played after Sep 5 2026 pushes one further out of
   the window; once five newer rounds exist these stop counting on their own. Gross only
   (no hole detail came across), so no net-double cap is applied to them. */
const SEED_ROUNDS = [
  { date: "2026-09-05", course: "Beachwood Golf Club",              tee: "Blue",  rating: 71.6, slope: 127, gross: 86 },
  { date: "2026-08-15", course: "Chicopee Woods · School/Village",  tee: "Gold",  rating: 73.6, slope: 137, gross: 81 },
  { date: "2026-08-09", course: "RiverPines Golf Course",           tee: "Black", rating: 71.1, slope: 132, gross: 80 },
  { date: "2026-08-03", course: "Chicopee Woods · Village/Mill",    tee: "Gold",  rating: 72.7, slope: 133, gross: 78 },
  { date: "2026-07-26", course: "Sugar Creek Golf Course",          tee: "Blue",  rating: 70.1, slope: 125, gross: 81 },
];

/* {diff, asOf, count, total, seeded} over the DIFF_WINDOW most recent rounds — played
   rounds and seeds pooled together and taken by date — or null when there's nothing
   scorable. Recomputed whenever history changes. */
function computeAutoDiff(history) {
  const recs = (history || [])
    .map(r => ({ d: new Date(r && r.date), v: recordDifferential(r), seed: false }))
    .filter(x => x.v != null && !isNaN(x.d.getTime()));
  SEED_ROUNDS.forEach(s => {
    const d = new Date(s.date + "T12:00:00");           // noon: no TZ drift across the date line
    if (!isNaN(d.getTime()) && s.slope > 0) recs.push({ d, v: scoreDifferential(s.gross, s.rating, s.slope), seed: true });
  });
  if (!recs.length) return null;
  recs.sort((a, b) => b.d - a.d);
  const last = recs.slice(0, DIFF_WINDOW);
  const avg = Math.round((last.reduce((a, x) => a + x.v, 0) / last.length) * 10) / 10;
  return { diff: avg, asOf: last[0].d, count: last.length, total: recs.length, seeded: last.filter(x => x.seed).length };
}

/* ---------- history records (reuses evalMatch; no engine changes) ---------- */
const nowISO = () => new Date().toISOString();
const newId = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function buildRecord(base, course, diff, scores, ghost) {
  const m = evalMatch(scores, ghost.holes);
  const yourOut = scores.slice(0, 9).reduce((a, s) => a + (s ?? 0), 0);
  const yourIn = scores.slice(9).reduce((a, s) => a + (s ?? 0), 0);
  const yourPoints = m.you, ghostPoints = m.opp;
  const result = yourPoints > 4.0001 ? "W" : yourPoints < 3.9999 ? "L" : "T";
  const rec = {
    version: 3,
    id: base.id, date: base.date,
    // v3: when this record last changed — the tiebreaker when the same round
    // exists on two devices. Set on every build, including an inline edit.
    updatedAt: Date.now(),
    course: course.name, tee: course.tee, ratingSlope: `${course.rating}/${course.slope}`,
    // v2: rating/slope/par and the per-hole card as NUMBERS, so the round can score its
    // own differential later without re-parsing the display string.
    rating: course.rating, slope: course.slope, par: course.par,
    pars: course.holes.map(h => h.par), strokeIndex: course.holes.map(h => h.si),
    differentialUsed: diff,
    holeScores: scores.slice(), ghostHoleScores: ghost.holes.slice(),
    yardages: course.holes.map(h => typeof h.yards === "number" ? h.yards : null),
    yourOut, yourIn, yourTotal: m.total.yourTot, ghostTotal: ghost.gross,
    yourPoints, ghostPoints,
    result,
  };
  // This round's own Score Differential — the thing the last-5 averages.
  rec.differential = recordDifferential(rec);
  return rec;
}
function deriveStats(history) {
  const n = history.length;
  let w = 0, l = 0, t = 0;
  history.forEach(r => { if (r.result === "W") w++; else if (r.result === "L") l++; else t++; });
  let streak = null; // consecutive most-recent W or L; a T ends any streak
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i].result;
    if (r === "T") break;
    if (!streak) streak = { type: r, count: 1 };
    else if (streak.type === r) streak.count++;
    else break;
  }
  const margin = n ? history.reduce((a, r) => a + (r.yourPoints - r.ghostPoints), 0) / n : 0;
  return {
    n, w, l, t, streak, margin,
    recordText: `${w}–${l}–${t}`,
    streakText: streak ? `${streak.type}${streak.count}` : "—",
    marginStr: n ? `${margin >= 0 ? "+" : ""}${margin.toFixed(1)}` : "—",
  };
}

/* ghost dispersion ring */
function GhostRing({ value, size = 44, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${C.slate}`, opacity: 0.3 }} />
        <div style={{ position: "absolute", inset: size * 0.13, borderRadius: "50%", border: `2px solid ${C.slate}`, background: C.slateDim }} />
        <span style={{ position: "relative", fontFamily: NUM, fontWeight: 800, color: C.slate, fontSize: size * 0.4, ...tnum }}>{value}</span>
      </div>
      {label && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: C.slate }}>{label}</span>}
    </div>
  );
}

/* segment cell */
function SegCell({ res, label, sub, margin }) {
  let bg = C.card2, fg = C.sub, sc = C.sub;
  if (res === "win") { bg = C.green; fg = "#07140C"; sc = "rgba(7,20,12,0.7)"; }
  else if (res === "loss") { bg = C.red; fg = "#fff"; sc = "rgba(255,255,255,0.85)"; }
  else if (res === "tie") { bg = C.tie; fg = "#fff"; sc = "rgba(255,255,255,0.6)"; }
  else { sc = margin < 0 ? C.green : margin > 0 ? C.red : C.sub; }
  return (
    <div style={{ background: bg, border: res === "live" ? `1px solid ${C.line}` : "none", borderRadius: 10, padding: "5px 1px", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: fg }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: sc, fontFamily: NUM, ...tnum }}>{sub}</div>
    </div>
  );
}
function StatPill({ label, res, sub }) {
  let bg = C.card2, fg = C.sub, sc = C.sub;
  if (res === "win") { bg = C.greenDim; fg = C.green; sc = C.green; }
  else if (res === "loss") { bg = C.redDim; fg = C.red; sc = C.red; }
  else if (res === "tie") { bg = C.tie; fg = "#fff"; sc = "rgba(255,255,255,0.7)"; }
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "5px 2px", textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: fg }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: sc, fontFamily: NUM, ...tnum }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "9px 6px", textAlign: "center" }}>
      <div style={{ color: C.sub, fontSize: 9, fontWeight: 800, letterSpacing: 0.6 }}>{label}</div>
      <div style={{ color: accent || C.ink, fontFamily: NUM, fontSize: 17, fontWeight: 800, marginTop: 2, ...tnum }}>{value}</div>
    </div>
  );
}
const streakAccent = (stats) => stats.streak ? (stats.streak.type === "W" ? C.green : C.red) : C.sub;
const marginAccent = (stats) => stats.n ? (stats.margin > 0 ? C.green : stats.margin < 0 ? C.red : C.ink) : C.sub;

const stepBtn = { width: 54, height: 54, borderRadius: 15, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const lbl = { color: C.sub, fontSize: 11, fontWeight: 800, letterSpacing: 1 };

/* ---------- setup (one screen: search course · pick tee · differential · start) ---------- */
function Setup({ course, setCourse, diff, setDiff, stats, history, onStart, onHistory }) {
  /* --- course search (golfcourseapi, debounced) --- */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);              // raw API results (up to 40)
  const [searchState, setSearchState] = useState("idle"); // idle | loading | done | empty | error
  const [open, setOpen] = useState(false);
  const [selectedFull, setSelectedFull] = useState(null); // full course from Call 2
  const [tees, setTees] = useState([]);                    // flattened tee options
  const [teeKey, setTeeKey] = useState("");
  const [loadState2, setLoadState2] = useState("idle");    // idle | loading | error
  const [pendingId, setPendingId] = useState(null);        // id being loaded (for retry)

  /* home state: sort in-state courses first (the API has no coords, so no true "near me") */
  const [homeState, setHomeState] = useState(() => { try { return localStorage.getItem(HOME_STATE_KEY) || ""; } catch (e) { return ""; } });
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState("");
  const saveHomeState = (s) => { setHomeState(s); setLocMsg(""); try { s ? localStorage.setItem(HOME_STATE_KEY, s) : localStorage.removeItem(HOME_STATE_KEY); } catch (e) { /* quota */ } };
  const detectState = () => {
    if (!navigator.geolocation) { setLocMsg("Location isn't available — pick your state."); return; }
    setLocating(true); setLocMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`${GEO_URL}?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error("http " + r.status)))
          .then(d => {
            const code = String(d.principalSubdivisionCode || "").split("-").pop();
            if (d.countryCode === "US" && STATE_SET.has(code)) saveHomeState(code);
            else setLocMsg("Couldn't match your state — pick it below.");
          })
          .catch(() => setLocMsg("Location lookup failed — pick your state."))
          .finally(() => setLocating(false));
      },
      () => { setLocating(false); setLocMsg("Location off or denied — pick your state."); },
      { timeout: 8000, maximumAge: 300000 }
    );
  };
  const CAP = 12;
  const stateOf = (r) => (r.location && r.location.state) || "";
  const displayed = useMemo(() => {
    if (!homeState) return results.slice(0, CAP);
    const inState = results.filter(r => stateOf(r) === homeState);
    const rest = results.filter(r => stateOf(r) !== homeState);
    return [...inState, ...rest].slice(0, CAP);
  }, [results, homeState]);
  const more = results.length > CAP;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchState("idle"); return; }
    const ctrl = new AbortController();
    setSearchState("loading");
    const t = setTimeout(() => {
      searchCourses(q, ctrl.signal)
        .then(cs => { setResults(cs.slice(0, 40)); setSearchState(cs.length ? "done" : "empty"); })
        .catch(err => { if (err.name !== "AbortError") { setResults([]); setSearchState("error"); } });
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const pickCourse = (id) => {
    setOpen(false);
    setCourse(null); setTees([]); setTeeKey("");
    setPendingId(id); setLoadState2("loading");
    loadFullCourse(id)
      .then(full => {
        const opts = teeOptions(full);
        setSelectedFull(full); setTees(opts); setLoadState2("idle");
      })
      .catch(() => { setSelectedFull(null); setTees([]); setLoadState2("error"); });
  };
  const pickTee = (key) => {
    setTeeKey(key);
    const opt = tees.find(o => o.key === key);
    setCourse(opt && selectedFull ? buildCourse(selectedFull, opt) : null);
  };

  /* --- auto last-5 differential from your own finished rounds (v14) ---
     Derived from history, so it updates the moment a round is finalized, edited or
     deleted. Manual override is this-round-only (Setup remounts fresh each round). */
  const auto = useMemo(() => computeAutoDiff(history), [history]);
  const [manual, setManual] = useState(false);
  useEffect(() => { if (!manual && auto) setDiff(auto.diff); }, [manual, auto, setDiff]);
  const bumpDiff = (delta) => { setManual(true); setDiff(d => Math.max(0, Math.round((d + delta) * 10) / 10)); };
  const useAuto = () => { setManual(false); if (auto) setDiff(auto.diff); };
  const asOfLbl = auto && auto.asOf ? ` (${fmtShortDate(auto.asOf)})` : "";
  const srcLine =
    manual ? "Manual override · applies to this round only" :
    !auto ? "No rounds yet — set your differential manually" :
    auto.count < DIFF_WINDOW ? `Last-${auto.count}: ${diff.toFixed(1)} · from your rounds (${auto.count} of ${DIFF_WINDOW})` :
    auto.seeded === auto.count ? `Last-${DIFF_WINDOW}: ${diff.toFixed(1)} · your official last-5${asOfLbl}` :
    auto.seeded ? `Last-${DIFF_WINDOW}: ${diff.toFixed(1)} · ${auto.count - auto.seeded} played + ${auto.seeded} seeded` :
    `Last-${DIFF_WINDOW}: ${diff.toFixed(1)} · from your rounds${asOfLbl}`;
  const srcColor = manual ? C.ink : auto && auto.count >= DIFF_WINDOW ? C.green : C.sub;

  const g = course ? computeGhost(course, diff) : null;
  const teeLabel = (o) => `${o.tee.tee_name || o.gender} · ${o.tee.course_rating}/${o.tee.slope_rating}${o.gender === "female" ? " (F)" : ""}`;
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 13, background: C.card, border: `1.5px solid ${C.line}`, color: C.ink, fontSize: 15, fontFamily: SANS, outline: "none" };

  return (
    <div style={{ height: "100dvh", maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 18px calc(env(safe-area-inset-bottom) + 14px)", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ghost size={18} color={C.green} />
          <span style={{ color: C.sub, letterSpacing: 2.5, fontSize: 11, fontWeight: 800 }}>GHOST MATCH</span>
        </div>
        <span style={{ color: C.sub, fontSize: 10, fontWeight: 700, ...tnum }}>{BUILD}</span>
      </div>

      {/* record row (compact) */}
      {stats.n > 0 && (
        <div style={{ flexShrink: 0, marginBottom: 10 }}>
          <div style={{ ...lbl, marginBottom: 6 }}>VS THE GHOST</div>
          <div style={{ display: "flex", gap: 8 }}>
            <MiniStat label="RECORD" value={stats.recordText} />
            <MiniStat label="STREAK" value={stats.streakText} accent={streakAccent(stats)} />
            <MiniStat label="AVG MARGIN" value={stats.marginStr} accent={marginAccent(stats)} />
          </div>
        </div>
      )}

      {/* round history — always available on the main menu; opens the delete-capable list */}
      <button onClick={onHistory} style={{ flexShrink: 0, marginBottom: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 13, background: C.card, border: `1px solid ${C.line}`, color: C.ink }}>
        <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, fontWeight: 700 }}>
          <Clock size={17} color={C.sub} /> Round history
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.sub, fontSize: 12, fontWeight: 700, ...tnum }}>
          {stats.n} {stats.n === 1 ? "round" : "rounds"} <ChevronRight size={15} />
        </span>
      </button>

      {/* middle — scrolls internally so START never hides behind content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* course search */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
            <div style={lbl}>COURSE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={detectState} disabled={locating} aria-label="Use my location" style={{ width: 30, height: 30, borderRadius: 8, background: C.card2, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: locating ? 0.6 : 1 }}>
                <MapPin size={15} color={locating ? C.green : C.sub} />
              </button>
              <select value={homeState} onChange={(e) => saveHomeState(e.target.value)} aria-label="Home state" style={{ appearance: "none", WebkitAppearance: "none", background: C.card2, color: homeState ? C.ink : C.sub, border: `1px solid ${homeState ? C.green : C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, fontFamily: SANS, maxWidth: 150 }}>
                <option value="">All states</option>
                {US_STATES.map(s => <option key={s.c} value={s.c}>{s.n}</option>)}
              </select>
            </div>
          </div>
          {locMsg && <div style={{ color: C.sub, fontSize: 11, marginBottom: 8 }}>{locMsg}</div>}
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder="Search for a course…"
            autoCapitalize="words" autoCorrect="off" spellCheck={false}
            style={inputStyle}
          />
          {/* results dropdown — absolutely positioned, overlays (never pushes START) */}
          {open && query.trim().length >= 2 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: C.card2, border: `1px solid ${C.line}`, borderRadius: 13, overflowY: "auto", maxHeight: "min(58vh, 460px)", WebkitOverflowScrolling: "touch", zIndex: 40, boxShadow: "0 12px 28px rgba(0,0,0,0.55)" }}>
              {searchState === "loading" && <div style={{ padding: "12px 14px", color: C.sub, fontSize: 13 }}>Searching…</div>}
              {searchState === "empty" && <div style={{ padding: "12px 14px", color: C.sub, fontSize: 13 }}>No courses found — try a different name or spelling.</div>}
              {searchState === "error" && <div style={{ padding: "12px 14px", color: C.red, fontSize: 13 }}>Course search unavailable — check your connection.</div>}
              {searchState === "done" && displayed.map(r => {
                const outState = homeState && stateOf(r) !== homeState;
                return (
                  <button key={r.id} onClick={() => pickCourse(r.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", color: C.ink, borderBottom: `1px solid ${C.line}`, opacity: outState ? 0.5 : 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.15 }}>{r.club_name || r.course_name}</div>
                    <div style={{ color: C.sub, fontSize: 11, marginTop: 1 }}>
                      {[r.course_name && r.course_name !== r.club_name ? r.course_name : null, r.location && [r.location.city, r.location.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </div>
                  </button>
                );
              })}
              {searchState === "done" && more && (
                <div style={{ padding: "9px 14px", color: C.sub, fontSize: 11, textAlign: "center", borderTop: `1px solid ${C.line}`, background: C.card }}>
                  Showing top 12 — type more of the name to narrow.
                </div>
              )}
            </div>
          )}
        </div>

        {/* tee picker — only after Call 2 resolves; retry on failure */}
        {loadState2 === "loading" && <div style={{ color: C.sub, fontSize: 13 }}>Loading course data…</div>}
        {loadState2 === "error" && (
          <button onClick={() => pendingId && pickCourse(pendingId)} style={{ textAlign: "left", color: C.red, fontSize: 13, fontWeight: 600, background: "none" }}>Couldn't load course data — tap to retry.</button>
        )}
        {loadState2 === "idle" && selectedFull && (
          <div>
            <div style={{ ...lbl, marginBottom: 8 }}>TEE — {selectedFull.club_name || selectedFull.course_name}</div>
            {tees.length === 0 ? (
              <div style={{ color: C.sub, fontSize: 13 }}>No 18-hole tees available for this course.</div>
            ) : (
              <select value={teeKey} onChange={(e) => pickTee(e.target.value)} style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none" }}>
                <option value="">Select tee…</option>
                {tees.map(o => <option key={o.key} value={o.key}>{teeLabel(o)}</option>)}
              </select>
            )}
          </div>
        )}

        {/* differential — auto from your last-5 rounds, with a manual override */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={lbl}>YOUR LAST-{DIFF_WINDOW} DIFFERENTIAL</div>
            {manual && auto && (
              <button onClick={useAuto} style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, background: "none" }}>USE AUTO</button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 4px" }}>
            <button onClick={() => bumpDiff(-0.1)} style={stepBtn}><Minus size={20} /></button>
            <div style={{ flex: 1, textAlign: "center", fontFamily: NUM, fontSize: 34, fontWeight: 800, color: C.green, ...tnum }}>{diff.toFixed(1)}</div>
            <button onClick={() => bumpDiff(0.1)} style={stepBtn}><Plus size={20} /></button>
          </div>
          <div style={{ color: srcColor, fontSize: 11, fontWeight: 600, ...tnum }}>{srcLine}</div>
        </div>

        {/* ghost preview — only when course + tee resolved */}
        {g && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "14px 18px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}<span style={{ color: C.sub, fontWeight: 600 }}> · {course.tee}</span></div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 3, ...tnum }}>Ghost plays to {g.hcp} · par {course.par} · {course.rating}/{course.slope}</div>
            </div>
            <GhostRing value={g.gross} size={58} />
          </div>
        )}
      </div>

      {/* start — pinned */}
      <button onClick={onStart} disabled={!course} style={{ flexShrink: 0, marginTop: 14, width: "100%", padding: "15px 0", background: course ? C.green : C.card2, color: course ? "#07140C" : C.sub, border: course ? "none" : `1px solid ${C.line}`, borderRadius: 16, fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>
        {course ? "Start round" : "Select a course & tee"}
      </button>
    </div>
  );
}

/* ---------- play (fixed one screen) ---------- */
/* running strokes-vs-ghost chart (derived from scores; no engine changes) */
function GhostChart({ scores, ghost }) {
  const W = 280, H = 78, top = 11, bot = 71;
  let cum = 0; const played = [];
  for (let i = 0; i < 18; i++) { if (scores[i] != null) { cum += scores[i] - ghost.holes[i]; played.push({ i, m: cum }); } }
  const cur = played.length ? played[played.length - 1].m : 0;
  const maxAbs = Math.max(3, ...played.map(p => Math.abs(p.m)));
  const evenY = top + (bot - top) * 0.30;
  const yOf = (m) => m >= 0 ? evenY + (m / maxAbs) * (bot - evenY) : evenY + (m / maxAbs) * (evenY - top);
  const xOf = (i) => ((i + 1) / 18) * W;
  const linePts = [[0, evenY]].concat(played.map(p => [xOf(p.i), yOf(p.m)]));
  const lineStr = linePts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastX = linePts[linePts.length - 1][0], lastY = linePts[linePts.length - 1][1];
  const areaStr = `${lineStr} ${lastX.toFixed(1)},${H} 0,${H}`;
  const accent = cur > 0 ? C.red : cur < 0 ? C.green : C.slate;
  const fill = cur > 0 ? "rgba(255,91,82,0.14)" : cur < 0 ? "rgba(87,199,127,0.14)" : "rgba(154,167,180,0.12)";
  const status = played.length === 0 ? "not started" : cur > 0 ? `+${cur} · behind` : cur < 0 ? `${cur} · ahead` : "even";
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 15, padding: "9px 12px 5px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ ...lbl, fontSize: 9 }}>STROKES VS GHOST</span>
        <span style={{ fontFamily: NUM, fontSize: 11, fontWeight: 800, color: accent, ...tnum }}>{status}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        <line x1="0" y1={evenY} x2={W} y2={evenY} stroke={C.line} strokeWidth="1" strokeDasharray="3 4" />
        <text x="3" y={evenY - 3} fill={C.sub} fontSize="8">even</text>
        {played.length > 0 && <polygon points={areaStr} fill={fill} />}
        {played.length > 0 && <polyline points={lineStr} fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {played.length > 0 && <circle cx={lastX} cy={lastY} r="5" fill={accent} stroke="#000" strokeWidth="2" />}
        <text x={W - 3} y={evenY - 3} fill={C.sub} fontSize="8" textAnchor="end">18</text>
      </svg>
    </div>
  );
}

/* score picker wheel — par centered & enlarged, roll to your number, tap to log */
function ScoreDial({ par, si, ghost, value, onPick }) {
  const ref = React.useRef(null);
  const raf = React.useRef(0);
  const W = 56;
  const min = Math.max(1, par - 4), max = par + 8;
  const nums = []; for (let n = min; n <= max; n++) nums.push(n);
  const [center, setCenter] = useState(value != null ? value : par);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const sel = value != null ? value : par;
    el.scrollLeft = (sel - min) * W;
    setCenter(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = ref.current; if (!el) return;
      setCenter(Math.min(max, Math.max(min, min + Math.round(el.scrollLeft / W))));
    });
  };
  const pick = (n) => { onPick(n); setCenter(n); const el = ref.current; if (el) el.scrollTo({ left: (n - min) * W, behavior: "smooth" }); };
  const size = (d) => d === 0 ? 42 : d === 1 ? 27 : d === 2 ? 20 : 16;
  const op = (d) => d === 0 ? 1 : d === 1 ? 0.82 : d === 2 ? 0.55 : 0.38;
  const logged = value != null && value === center;
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px 5px" }}>
        <span style={{ color: C.sub, fontSize: 11, fontWeight: 700, ...tnum }}>PAR {par} · SI {si}</span>
        <span style={{ color: logged ? C.green : C.ink, fontSize: 12, fontWeight: 800 }}>{scoreName(center, par)}{logged ? " · logged ✓" : " · tap to log"}</span>
        <span style={{ color: C.slate, fontSize: 11, fontWeight: 700, ...tnum }}>GHOST {ghost}</span>
      </div>
      <div style={{ position: "relative", height: 66 }}>
        <div style={{ position: "absolute", top: 3, left: "50%", transform: "translateX(-50%)", width: 60, height: 60, borderRadius: 15, border: `1.5px solid ${C.green}`, background: C.greenDim, pointerEvents: "none" }} />
        <div ref={ref} onScroll={onScroll} className="dialscroll" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", paddingInline: "calc(50% - 28px)", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          {nums.map(n => {
            const d = Math.abs(n - center);
            return (
              <button key={n} onClick={() => pick(n)} style={{ scrollSnapAlign: "center", flex: "0 0 56px", width: 56, height: 66, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", padding: 0 }}>
                <span style={{ fontFamily: NUM, fontWeight: d === 0 ? 800 : 700, fontSize: size(d), lineHeight: 1, color: n === value ? C.green : d === 0 ? C.ink : C.sub, opacity: op(d), ...tnum }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Play({ course, ghost, scores, setScores, hole, setHole, onFinish, onExit }) {
  const [confirmExit, setConfirmExit] = useState(false);
  const m = useMemo(() => evalMatch(scores, ghost.holes), [scores, ghost]);
  const h = course.holes[hole], gh = ghost.holes[hole];
  /* Tap a score -> log it, then hand over the next hole. The short pause lets the
     "logged ✓" confirmation register before the dial swaps to the new par; the
     guard means a hole you picked yourself mid-pause wins over the auto-advance. */
  const advance = React.useRef(0);
  useEffect(() => () => clearTimeout(advance.current), []);
  const setVal = (v) => {
    setScores(prev => { const n = [...prev]; n[hole] = Math.max(1, v); return n; });
    if (hole < 17) {
      clearTimeout(advance.current);
      advance.current = setTimeout(() => setHole(h => (h === hole ? h + 1 : h)), 350);
    }
  };
  const lead = m.you - m.opp;
  const filled = scores.filter(s => s != null).length;
  const allIn = filled === 18;
  // Finalize once every hole has a score (the current hole's pending value counts).
  const onlyCurrentMissing = scores.every((s, i) => s != null || i === hole);
  const canFinalize = allIn || onlyCurrentMissing;
  const doFinalize = () => {
    const committed = scores.map((s, i) => s == null ? course.holes[i].par : s);
    setScores(committed);
    onFinish(committed);
  };

  const segSub = (s) => s.done ? `${s.yourSum}–${s.ghostSum}` : (s.holesIn === 0 ? "·" : marginText(s.liveMargin));
  const segLab = (s) => s.done ? (s.res === "win" ? "WON" : s.res === "loss" ? "LOST" : "HALF") : `S${s.idx[0] / 3 + 1}`;
  const nineSub = (n) => n.done ? `${n.yourSum}–${n.ghostSum}` : marginText(n.liveMargin);
  const totSub = m.total.res !== "live" ? `${m.total.yourTot}–${m.total.ghostTot}` : marginText(m.total.liveMargin);

  return (
    <div style={{ height: "100dvh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8, padding: "calc(env(safe-area-inset-top) + 10px) 14px calc(env(safe-area-inset-bottom) + 10px)", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button onClick={() => (filled === 0 ? onExit() : setConfirmExit(true))} aria-label="Exit round" style={{ width: 34, height: 34, borderRadius: 10, background: C.card2, color: C.sub, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={18} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.ink, fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</div>
            <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{course.tee} · ghost {ghost.gross}</div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...lbl, fontSize: 10 }}>HOLE</div>
          <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 18, color: C.ink, ...tnum }}>{hole + 1}<span style={{ color: C.sub, fontSize: 12 }}>/18</span></div>
        </div>
      </div>

      {/* exit confirmation */}
      {confirmExit && (
        <div onClick={() => setConfirmExit(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.card, borderRadius: "20px 20px 0 0", border: `1px solid ${C.line}`, padding: "18px 18px calc(env(safe-area-inset-bottom) + 18px)" }}>
            <div style={{ color: C.ink, fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Leave this round?</div>
            <div style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>You're on hole {hole + 1}. This round isn't finished, so it won't be saved to your record.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmExit(false)} style={{ flex: 1, height: 50, borderRadius: 14, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 800, fontSize: 15 }}>Keep playing</button>
              <button onClick={() => { setConfirmExit(false); onExit(); }} style={{ flex: 1, height: 50, borderRadius: 14, background: C.red, color: "#fff", fontWeight: 800, fontSize: 15 }}>Leave round</button>
            </div>
          </div>
        </div>
      )}

      {/* scoreboard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 16, padding: "9px 18px", flexShrink: 0 }}>
        <div>
          <div style={{ color: C.green, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>YOU</div>
          <div style={{ fontFamily: NUM, fontSize: 34, fontWeight: 800, color: C.green, lineHeight: 1, ...tnum }}>{fmtPts(m.you)}</div>
        </div>
        <div style={{ color: lead > 0 ? C.green : lead < 0 ? C.red : C.sub, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
          {lead === 0 ? "ALL SQUARE" : lead > 0 ? `${fmtPts(lead)} UP` : `${fmtPts(-lead)} DOWN`}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.slate, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>GHOST</div>
          <div style={{ fontFamily: NUM, fontSize: 34, fontWeight: 800, color: C.slate, lineHeight: 1, ...tnum }}>{fmtPts(m.opp)}</div>
        </div>
      </div>

      {/* running chart */}
      <GhostChart scores={scores} ghost={ghost} />

      {/* segment strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, flexShrink: 0 }}>
        {m.segs.map((s, i) => <SegCell key={i} res={s.res} label={segLab(s)} sub={segSub(s)} margin={s.liveMargin} />)}
      </div>

      {/* front / back / total */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, flexShrink: 0 }}>
        <StatPill label="FRONT 9" res={m.front.res} sub={nineSub(m.front)} />
        <StatPill label="BACK 9" res={m.back.res} sub={nineSub(m.back)} />
        <StatPill label="TOTAL" res={m.total.res} sub={totSub} />
      </div>

      {/* 18-hole board — result at a glance; tap any hole to jump */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 5, flexShrink: 0 }}>
        {scores.map((s, i) => {
          let bg = C.card2, col = C.sub, border = `1px solid ${C.line}`;
          if (s != null) { const d = s - ghost.holes[i]; if (d < 0) { bg = C.green; col = "#07140C"; border = "none"; } else if (d > 0) { bg = C.red; col = "#fff"; border = "none"; } else { bg = "#4A4E54"; col = "#fff"; border = "none"; } }
          const now = i === hole;
          return <button key={i} onClick={() => setHole(i)} style={{ height: 30, borderRadius: 8, background: bg, color: col, border: now ? `2px solid ${C.ink}` : border, fontFamily: NUM, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", ...tnum }}>{i + 1}</button>;
        })}
      </div>

      {/* score entry — roll the dial to your number, tap to log (par is centered) */}
      <ScoreDial key={hole} par={h.par} si={h.si} ghost={gh} value={scores[hole]} onPick={setVal} />

      {/* finalize — appears once the round is complete */}
      {canFinalize && (
        <button onClick={doFinalize} style={{ flexShrink: 0, height: 50, borderRadius: 14, background: C.green, color: "#07140C", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Flag size={18} /> Finalize round</button>
      )}
    </div>
  );
}

/* ---------- scorecard (Shot-Pattern visual language) ---------- */
const cellBase = { display: "flex", alignItems: "center", justifyContent: "center", height: 26, fontFamily: NUM, ...tnum };
const segWash = (res) => res === "win" ? C.greenDim : res === "loss" ? C.slateDim : "transparent";

// par-relative notation: circle=birdie, double circle=eagle+, square=bogey, double square=double+
function ScoreMark({ score, par }) {
  if (score == null) return <span style={{ color: C.sub, fontSize: 12 }}>·</span>;
  const d = score - par;
  const shape = d <= -2 ? 2 : d === -1 ? 1 : d === 0 ? 0 : d === 1 ? -1 : -2;
  const ring = Math.abs(shape) >= 1, dbl = Math.abs(shape) >= 2;
  const ringCol = shape > 0 ? C.green : C.sub;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 18, height: 18, padding: "0 2px", fontFamily: NUM, fontWeight: 800, fontSize: 11, ...tnum,
      color: shape > 0 ? C.green : C.ink,
      borderRadius: shape > 0 ? "50%" : "3px",
      border: ring ? `1.5px solid ${ringCol}` : "none",
      outline: dbl ? `1.5px solid ${ringCol}` : "none",
      outlineOffset: dbl ? "1.5px" : 0,
    }}>{score}</span>
  );
}

function ScoreCard({ course, ghost, scores, m, onTapHole }) {
  const hasYardage = course.holes.some(h => typeof h.yards === "number");
  const cols = "26px repeat(9,1fr) 26px 30px";
  const renderNine = (start) => {
    const isIn = start === 9;
    const idx = [...Array(9)].map((_, k) => start + k);
    const parSum = idx.reduce((a, i) => a + course.holes[i].par, 0);
    const youSum = idx.reduce((a, i) => a + (scores[i] ?? 0), 0);
    const ghSum = idx.reduce((a, i) => a + ghost.holes[i], 0);
    return (
      <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 1, rowGap: 2, marginBottom: isIn ? 0 : 10 }}>
        {/* hole numbers */}
        <div style={{ ...cellBase, height: 18 }} />
        {idx.map(i => <div key={"h" + i} style={{ ...cellBase, fontSize: 10, fontWeight: 800, color: C.sub, height: 18 }}>{i + 1}</div>)}
        <div style={{ ...cellBase, fontSize: 9, fontWeight: 800, color: C.sub, height: 18 }}>{isIn ? "IN" : "OUT"}</div>
        <div style={{ ...cellBase, fontSize: 9, fontWeight: 800, color: C.sub, height: 18 }}>{isIn ? "TOT" : ""}</div>
        {/* yardage (rendered only when course data carries it) */}
        {hasYardage && (
          <React.Fragment>
            <div style={{ ...cellBase, justifyContent: "flex-start", fontSize: 9, fontWeight: 800, color: C.sub, height: 16 }}>YDS</div>
            {idx.map(i => <div key={"y" + i} style={{ ...cellBase, fontSize: 9, color: C.sub, height: 16 }}>{course.holes[i].yards ?? "·"}</div>)}
            <div style={{ ...cellBase, fontSize: 9, color: C.sub, height: 16 }}>{idx.reduce((a, i) => a + (course.holes[i].yards ?? 0), 0) || ""}</div>
            <div style={{ ...cellBase, fontSize: 9, color: C.sub, height: 16 }}>{isIn ? (course.holes.reduce((a, h) => a + (h.yards ?? 0), 0) || "") : ""}</div>
          </React.Fragment>
        )}
        {/* par */}
        <div style={{ ...cellBase, justifyContent: "flex-start", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: C.sub }}>PAR</div>
        {idx.map(i => <div key={"p" + i} style={{ ...cellBase, fontSize: 10, color: C.sub }}>{course.holes[i].par}</div>)}
        <div style={{ ...cellBase, fontSize: 10, fontWeight: 700, color: C.sub }}>{parSum}</div>
        <div style={{ ...cellBase, fontSize: 10, fontWeight: 700, color: C.sub }}>{isIn ? course.par : ""}</div>
        {/* you — tappable, segment-shaded */}
        <div style={{ ...cellBase, justifyContent: "flex-start", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: C.green }}>YOU</div>
        {idx.map(i => (
          <button key={"u" + i} onClick={() => onTapHole(i)} style={{ ...cellBase, background: segWash(m.segs[Math.floor(i / 3)].res), borderRadius: 4, padding: 0 }}>
            <ScoreMark score={scores[i]} par={course.holes[i].par} />
          </button>
        ))}
        <div style={{ ...cellBase, fontSize: 12, fontWeight: 800, color: C.green }}>{youSum}</div>
        <div style={{ ...cellBase, fontSize: 12, fontWeight: 800, color: C.green }}>{isIn ? scores.reduce((a, s) => a + (s ?? 0), 0) : ""}</div>
        {/* ghost — projected line, plain numbers in dispersion accent */}
        <div style={{ ...cellBase, justifyContent: "flex-start", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: C.slate }}>GHOST</div>
        {idx.map(i => <div key={"g" + i} style={{ ...cellBase, background: segWash(m.segs[Math.floor(i / 3)].res), borderRadius: 4, color: C.slate, fontSize: 11, fontWeight: 700 }}>{ghost.holes[i]}</div>)}
        <div style={{ ...cellBase, fontSize: 12, fontWeight: 800, color: C.slate }}>{ghSum}</div>
        <div style={{ ...cellBase, fontSize: 12, fontWeight: 800, color: C.slate }}>{isIn ? ghost.gross : ""}</div>
      </div>
    );
  };
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: "12px 10px", marginTop: 12 }}>
      {renderNine(0)}
      {renderNine(9)}
    </div>
  );
}

/* ---------- summary ---------- */
function Summary({ course, ghost, scores, history, onEditScore, onReset }) {
  const m = evalMatch(scores, ghost.holes);
  const won = m.you > m.opp, tie = m.you === m.opp;
  const stats = deriveStats(history);
  const yourTotal = m.total.yourTot;
  const toPar = yourTotal - course.par;
  const tp = toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;
  const yourOut = scores.slice(0, 9).reduce((a, s) => a + (s ?? 0), 0);
  const yourIn = scores.slice(9).reduce((a, s) => a + (s ?? 0), 0);
  const segSub = (s) => `${s.yourSum}–${s.ghostSum}`;
  const segLab = (s) => s.res === "win" ? "WON" : s.res === "loss" ? "LOST" : "HALF";
  const [editHole, setEditHole] = useState(null);
  const [editVal, setEditVal] = useState(0);
  const openEdit = (i) => { setEditVal(scores[i] ?? course.holes[i].par); setEditHole(i); };
  const saveEdit = () => { onEditScore(editHole, editVal); setEditHole(null); };
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 18px) 18px 40px" }}>
      <div style={{ color: C.sub, letterSpacing: 2.5, fontSize: 11, fontWeight: 800, textAlign: "center" }}>FINAL · {course.name}</div>
      <h1 style={{ textAlign: "center", margin: "4px 0 18px", fontSize: 28, fontWeight: 800, letterSpacing: -0.3, color: won ? C.green : tie ? C.ink : C.red }}>
        {won ? "You beat the ghost" : tie ? "Dead heat" : "Ghost takes it"}
      </h1>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.green, fontSize: 12, fontWeight: 800 }}>YOU</div>
          <div style={{ fontFamily: NUM, fontSize: 48, fontWeight: 800, color: C.green, lineHeight: 1, ...tnum }}>{fmtPts(m.you)}</div>
          <div style={{ color: C.sub, fontSize: 12, ...tnum }}>gross {m.total.yourTot}</div>
        </div>
        <div style={{ color: C.line, fontSize: 26 }}>·</div>
        <div style={{ textAlign: "center" }}>
          <GhostRing value={fmtPts(m.opp)} size={56} />
          <div style={{ color: C.sub, fontSize: 12, marginTop: 2, ...tnum }}>gross {ghost.gross}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, marginBottom: 5 }}>
        {m.segs.map((s, i) => <SegCell key={i} res={s.res} label={segLab(s)} sub={segSub(s)} margin={s.liveMargin} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
        <StatPill label="FRONT 9" res={m.front.res} sub={`${m.front.yourSum}–${m.front.ghostSum}`} />
        <StatPill label="BACK 9" res={m.back.res} sub={`${m.back.yourSum}–${m.back.ghostSum}`} />
        <StatPill label="TOTAL" res={m.total.res} sub={`${m.total.yourTot}–${m.total.ghostTot}`} />
      </div>

      {/* scorecard header + grid */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22 }}>
        <div>
          <div style={{ color: C.ink, fontWeight: 800, fontSize: 15 }}>{course.name}</div>
          <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{course.tee} · {course.rating}/{course.slope}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.green, fontWeight: 800, fontSize: 16, ...tnum }}>{tp}</div>
          <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{yourOut} · {yourIn} | {yourTotal}</div>
        </div>
      </div>
      <ScoreCard course={course} ghost={ghost} scores={scores} m={m} onTapHole={openEdit} />
      <div style={{ textAlign: "center", color: C.sub, fontSize: 11, marginTop: 8 }}>Tap any hole in your row to edit</div>

      {/* record vs the Ghost (updates live as you edit) */}
      <div style={{ marginTop: 22 }}>
        <div style={{ ...lbl, marginBottom: 8 }}>VS THE GHOST</div>
        <div style={{ display: "flex", gap: 8 }}>
          <MiniStat label="RECORD" value={stats.recordText} />
          <MiniStat label="STREAK" value={stats.streakText} accent={streakAccent(stats)} />
          <MiniStat label="AVG MARGIN" value={stats.marginStr} accent={marginAccent(stats)} />
        </div>
      </div>

      <button onClick={onReset} style={{ width: "100%", marginTop: 22, padding: "15px 0", background: C.card, color: C.ink, borderRadius: 16, border: `1px solid ${C.line}`, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><RotateCcw size={18} /> New round</button>

      {/* inline hole editor */}
      {editHole != null && (
        <div onClick={() => setEditHole(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.card, borderRadius: "20px 20px 0 0", border: `1px solid ${C.line}`, padding: "18px 18px calc(env(safe-area-inset-bottom) + 18px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ color: C.ink, fontWeight: 800, fontSize: 16 }}>Hole {editHole + 1}</div>
                <div style={{ color: C.sub, fontSize: 12, ...tnum }}>Par {course.holes[editHole].par} · stroke index {course.holes[editHole].si}</div>
              </div>
              <GhostRing value={ghost.holes[editHole]} size={44} label="GHOST" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <button onClick={() => setEditVal(v => Math.max(1, v - 1))} style={stepBtn}><Minus size={24} /></button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontFamily: NUM, fontSize: 52, fontWeight: 800, color: C.green, lineHeight: 1, ...tnum }}>{editVal}</div>
                <div style={{ color: editVal - course.holes[editHole].par <= 0 ? C.green : C.sub, fontSize: 12, fontWeight: 700, marginTop: 3 }}>{scoreName(editVal, course.holes[editHole].par)}</div>
              </div>
              <button onClick={() => setEditVal(v => v + 1)} style={stepBtn}><Plus size={24} /></button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditHole(null)} style={{ flex: 1, height: 50, borderRadius: 14, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 800, fontSize: 15 }}>Cancel</button>
              <button onClick={saveEdit} style={{ flex: 1, height: 50, borderRadius: 14, background: C.green, color: "#07140C", fontWeight: 800, fontSize: 15 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- cloud sync (Firebase Auth + Firestore) ----------
   Local-first by design: localStorage stays the read path, so the app opens
   instantly and a round can be played and finalized with no signal at all. When
   signed in, each round mirrors to users/{uid}/rounds/{id}; Firestore's own
   offline cache queues writes made in a dead zone and flushes them on reconnect.
   Merge is by id with last-write-wins on updatedAt. Deletes are tombstones, so
   deleting on one device doesn't get undone by a stale copy on another. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkKB_5MjvKRDQYdi6VPpARkkM5Gkx1jvE",
  authDomain: "ghost-match-cd04d.firebaseapp.com",
  projectId: "ghost-match-cd04d",
  storageBucket: "ghost-match-cd04d.firebasestorage.app",
  messagingSenderId: "46156778167",
  appId: "1:46156778167:web:e54c74a6d907c14f2b5b32",
};
const TOMB_KEY = "bogeyman-matches:tombstones:v1";

let fb = null;
/* Lazy so a Firebase failure can never stop the golf app from loading. */
function initCloud() {
  if (fb !== null) return fb || null;
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
    });
    fb = { app, auth, db };
  } catch (e) { fb = false; }
  return fb || null;
}
/* An installed iOS PWA has no reliable popup window; redirect is the supported
   path there. Popup elsewhere keeps you in the page. */
const isStandalone = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
  window.navigator.standalone === true;

async function cloudSignIn() {
  const c = initCloud();
  if (!c) throw new Error("cloud unavailable");
  const provider = new GoogleAuthProvider();
  if (isStandalone()) return signInWithRedirect(c.auth, provider);
  try { return await signInWithPopup(c.auth, provider); }
  catch (e) {
    const code = (e && e.code) || "";
    if (/popup-blocked|popup-closed|operation-not-supported|cancelled-popup/.test(code)) {
      return signInWithRedirect(c.auth, provider);
    }
    throw e;
  }
}
const cloudSignOut = () => { const c = initCloud(); if (c) fbSignOut(c.auth).catch(() => {}); };

const stampOf = (r) => (r && typeof r.updatedAt === "number" ? r.updatedAt : Date.parse(r && r.date) || 0);
const roundDoc = (c, uid, id) => doc(c.db, "users", uid, "rounds", id);
async function cloudFetchAll(c, uid) {
  const snap = await getDocs(collection(c.db, "users", uid, "rounds"));
  const out = []; snap.forEach(d => out.push(d.data())); return out;
}
const cloudPut = (c, uid, rec) => setDoc(roundDoc(c, uid, rec.id), rec);

/* Union local + cloud by id, newest updatedAt wins, tombstones drop out of the
   active list but survive as markers. toPush is what the cloud is missing or
   holds an older copy of. */
function mergeRounds(local, localTombs, cloudDocs) {
  const byId = new Map();
  const put = (r, from) => {
    const hit = byId.get(r.id);
    if (!hit || stampOf(r) >= stampOf(hit.r)) byId.set(r.id, { r, from });
  };
  (cloudDocs || []).forEach(r => { if (r && r.id) put(r, "cloud"); });
  (local || []).forEach(r => { if (r && r.id) put(r, "local"); });
  (localTombs || []).forEach(t => { if (t && t.id) put({ id: t.id, deleted: true, updatedAt: t.updatedAt }, "local"); });
  const all = [...byId.values()];
  return {
    merged: all.filter(x => !x.r.deleted).map(x => x.r).sort((a, b) => new Date(a.date) - new Date(b.date)),
    tombs: all.filter(x => x.r.deleted).map(x => ({ id: x.r.id, updatedAt: stampOf(x.r) })),
    toPush: all.filter(x => x.from === "local").map(x => x.r),
  };
}

/* off | signed-out | syncing | synced | error */
function useCloudSync(history, setHistory, tombs, setTombs) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("off");
  const pushed = React.useRef(new Map());   // id -> updatedAt already accepted by the server
  const ready = React.useRef(false);
  const stateRef = React.useRef({ history, tombs });
  stateRef.current = { history, tombs };

  useEffect(() => {
    const c = initCloud();
    if (!c) { setStatus("error"); return; }
    getRedirectResult(c.auth).catch(() => {});   // completes an iOS redirect sign-in
    return onAuthStateChanged(c.auth, (u) => {
      setUser(u || null);
      if (!u) { ready.current = false; pushed.current = new Map(); setStatus("signed-out"); }
    });
  }, []);

  // One reconcile per sign-in: pull everything, merge, push what's only local.
  useEffect(() => {
    if (!user) return;
    const c = initCloud(); if (!c) return;
    let alive = true;
    setStatus("syncing");
    (async () => {
      try {
        const cloud = await cloudFetchAll(c, user.uid);
        if (!alive) return;
        const { history: h, tombs: t } = stateRef.current;
        const m = mergeRounds(h, t, cloud);
        cloud.forEach(r => pushed.current.set(r.id, stampOf(r)));
        setHistory(m.merged); setTombs(m.tombs);
        for (const r of m.toPush) { await cloudPut(c, user.uid, r); pushed.current.set(r.id, stampOf(r)); }
        if (!alive) return;
        ready.current = true; setStatus("synced");
      } catch (e) { if (alive) { ready.current = true; setStatus("error"); } }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Mirror later changes (a finalized round, an inline edit, a delete).
  useEffect(() => {
    if (!user || !ready.current) return;
    const c = initCloud(); if (!c) return;
    const pending = [];
    history.forEach(r => { if (r && r.id && pushed.current.get(r.id) !== stampOf(r)) pending.push(r); });
    tombs.forEach(t => {
      if (t && t.id && pushed.current.get(t.id) !== t.updatedAt) pending.push({ id: t.id, deleted: true, updatedAt: t.updatedAt });
    });
    if (!pending.length) return;
    let alive = true;
    setStatus("syncing");
    Promise.all(pending.map(r => cloudPut(c, user.uid, r).then(() => pushed.current.set(r.id, stampOf(r)))))
      .then(() => { if (alive) setStatus("synced"); })
      .catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, [history, tombs, user]);

  return { user, status };
}

/* ---------- backup: export / import rounds as JSON ----------
   History lives only in localStorage, and since v14 the differential is derived from it,
   so a cache wipe would reset the ghost's calibration too. Until durable cloud stats
   land, this turns total loss into "lost since my last export". Seeds aren't included —
   they ship in the bundle and survive a wipe on their own. */
const BACKUP_TAG = "ghost-match";
function backupPayload(history) {
  return JSON.stringify({ app: BACKUP_TAG, schema: 1, exportedAt: nowISO(), rounds: history }, null, 2);
}
const backupName = () => `ghost-match-rounds-${new Date().toISOString().slice(0, 10)}.json`;
/* On an installed iPhone PWA the share sheet ("Save to Files") is the reliable way out;
   <a download> is the desktop/browser fallback. */
async function exportRounds(history) {
  const text = backupPayload(history), name = backupName();
  try {
    const file = new File([text], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Ghost Match rounds" });
      return "Saved";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return null;   // user dismissed the share sheet
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "Downloaded";
  } catch (e) { return "Export failed"; }
}
/* Accepts a wrapped backup or a bare array; keeps only records the app can actually read
   (same shape loadHistory enforces). Returns null when the file isn't a backup at all. */
function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  const rounds = Array.isArray(data) ? data : (data && Array.isArray(data.rounds) ? data.rounds : null);
  if (!rounds) return null;
  return rounds.filter(r => r && typeof r === "object" && typeof r.id === "string" &&
    Array.isArray(r.holeScores) && Array.isArray(r.ghostHoleScores));
}

/* ---------- history + delete ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const resColor = (r) => r === "W" ? C.green : r === "L" ? C.red : C.slate;

function History({ history, stats, cloud, onDelete, onImport, onBack }) {
  const [confirmId, setConfirmId] = useState(null);
  const [msg, setMsg] = useState("");
  const fileRef = React.useRef(null);
  const rounds = [...history].reverse(); // most recent first
  const doExport = async () => {
    if (!history.length) { setMsg("Nothing to export yet."); return; }
    const r = await exportRounds(history);
    if (r) setMsg(`${r} ${history.length} round${history.length === 1 ? "" : "s"}.`);
  };
  /* cloud status, rendered from the hook's state */
  const cu = (cloud && cloud.user) || null;
  const cstatus = (cloud && cloud.status) || "off";
  const signedIn = !!cu;
  const [busy, setBusy] = useState(false);
  const doSignIn = async () => {
    setBusy(true); setMsg("");
    try { await cloudSignIn(); }
    catch (e) { setMsg("Couldn't sign in — " + ((e && e.code) || "try again")); }
    finally { setBusy(false); }
  };
  const syncDot =
    cstatus === "synced" ? C.green :
    cstatus === "syncing" ? C.slate :
    cstatus === "error" ? C.red : C.line;
  const syncTitle =
    !signedIn ? "Not backed up" :
    cstatus === "synced" ? "Backed up" :
    cstatus === "syncing" ? "Syncing…" :
    cstatus === "error" ? "Sync problem" : "Connecting…";
  const syncNote =
    !signedIn ? "Sign in once. Rounds then save themselves — and survive a wipe." :
    cstatus === "error" ? "Saved on this phone. Will retry when you're back online." :
    cstatus === "syncing" ? `${history.length} round${history.length === 1 ? "" : "s"} · ${cu.email || "signed in"}` :
    `${history.length} round${history.length === 1 ? "" : "s"} · ${cu.email || "signed in"}`;

  const doImport = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";                       // let the same file be picked again
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const rounds = parseBackup(String(fr.result));
      if (!rounds) { setMsg("That doesn't look like a Ghost Match backup."); return; }
      if (!rounds.length) { setMsg("No usable rounds in that file."); return; }
      const { added, skipped } = onImport(rounds);
      setMsg(added ? `Added ${added} round${added === 1 ? "" : "s"}${skipped ? `, ${skipped} already here` : ""}.`
                   : "Already up to date — nothing new to add.");
    };
    fr.onerror = () => setMsg("Couldn't read that file.");
    fr.readAsText(f);
  };
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 14px) 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ width: 44, height: 44, borderRadius: 13, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ChevronLeft size={22} /></button>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 800, letterSpacing: -0.3, margin: 0 }}>Round history</h1>
          <div style={{ color: C.sub, fontSize: 12, ...tnum }}>{stats.recordText} · {stats.streakText} · {stats.marginStr}</div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div style={{ textAlign: "center", color: C.sub, fontSize: 14, padding: "48px 0" }}>No rounds logged yet.</div>
      ) : rounds.map(r => {
        const confirming = confirmId === r.id;
        const margin = r.yourPoints - r.ghostPoints;
        const rd = recordDifferential(r); // this round's differential — feeds the last-5
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.card2, color: resColor(r.result), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{r.result}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.course}<span style={{ color: C.sub, fontWeight: 600 }}> · {r.tee}</span></div>
              <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{fmtDate(r.date)} · {fmtPts(r.yourPoints)}–{fmtPts(r.ghostPoints)} · {margin >= 0 ? "+" : ""}{margin.toFixed(1)}{rd != null ? ` · diff ${rd.toFixed(1)}` : ""}</div>
            </div>
            {confirming ? (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setConfirmId(null)} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 800, fontSize: 12 }}>Cancel</button>
                <button onClick={() => { onDelete(r.id); setConfirmId(null); }} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12 }}>Delete</button>
              </div>
            ) : (
              <button onClick={() => setConfirmId(r.id)} style={{ width: 34, height: 34, borderRadius: 9, background: C.card2, color: C.sub, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash size={16} /></button>
            )}
          </div>
        );
      })}

      {/* cloud sync — the durable copy; export/import below is the manual fallback */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.line}` }}>
        <div style={{ ...lbl, marginBottom: 8 }}>CLOUD BACKUP</div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: syncDot, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 13 }}>{syncTitle}</div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 2, lineHeight: 1.4, overflowWrap: "anywhere" }}>{syncNote}</div>
            </div>
            {signedIn ? (
              <button onClick={cloudSignOut} style={{ color: C.sub, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, background: "none", flexShrink: 0 }}>SIGN OUT</button>
            ) : (
              <button onClick={doSignIn} disabled={busy} style={{ height: 34, padding: "0 14px", borderRadius: 9, background: C.green, color: "#07140C", fontWeight: 800, fontSize: 12, flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
                {busy ? "…" : "Turn on"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ ...lbl, marginBottom: 8 }}>MANUAL BACKUP</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={doExport} style={{ flex: 1, height: 46, borderRadius: 13, background: C.card, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 800, fontSize: 14 }}>Export rounds</button>
          <button onClick={() => fileRef.current && fileRef.current.click()} style={{ flex: 1, height: 46, borderRadius: 13, background: C.card, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 800, fontSize: 14 }}>Import</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} style={{ display: "none" }} />
        <div style={{ color: msg ? C.ink : C.sub, fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
          {msg || "A file copy you control. Export saves to Files/iCloud; import merges a backup back in without touching rounds you already have."}
        </div>
      </div>
    </div>
  );
}

/* ---------- localStorage persistence ---------- */
const LS_KEY = "bogeyman-matches:v1";
const HIST_KEY = "bogeyman-matches:history:v1";
const DEFAULT_STATE = { screen: "setup", course: null, diff: 7.9, scores: Array(18).fill(null), hole: 0, roundId: null };
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return DEFAULT_STATE;
    const course = validCourse(s.course) ? s.course : null;
    const scoresOk = Array.isArray(s.scores) && s.scores.length === 18;
    const scores = scoresOk ? s.scores.map(v => (typeof v === "number" && v > 0 ? v : null)) : Array(18).fill(null);
    const played = scores.filter(v => v != null).length;
    // Resume ONLY a genuinely in-progress round: the play screen with at least one
    // hole scored. An empty just-started round or a finished summary opens the menu.
    const wantResume = s.screen === "play" && course && scoresOk && played >= 1;
    return {
      screen: wantResume ? s.screen : "setup",
      course,
      diff: typeof s.diff === "number" ? s.diff : 7.9,
      scores,
      hole: Number.isInteger(s.hole) && s.hole >= 0 && s.hole < 18 ? s.hole : 0,
      roundId: typeof s.roundId === "string" ? s.roundId : null,
    };
  } catch (e) {
    return DEFAULT_STATE;
  }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* quota / private mode */ }
}
function loadHistory() {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter(r => r && typeof r === "object" && Array.isArray(r.holeScores) && Array.isArray(r.ghostHoleScores)) : [];
  } catch (e) { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) { /* quota / private mode */ }
}
/* Deleted rounds leave a marker so the delete replicates instead of being undone
   by a stale copy still sitting in the cloud. */
function loadTombs() {
  try {
    const a = JSON.parse(localStorage.getItem(TOMB_KEY) || "[]");
    return Array.isArray(a) ? a.filter(t => t && typeof t.id === "string") : [];
  } catch (e) { return []; }
}
function saveTombs(t) {
  try { localStorage.setItem(TOMB_KEY, JSON.stringify(t)); } catch (e) { /* quota */ }
}

/* ---------- app ---------- */
function App() {
  const initial = loadState();
  const [screen, setScreen] = useState(initial.screen);
  const [course, setCourse] = useState(initial.course);
  const [diff, setDiff] = useState(initial.diff);
  const [scores, setScores] = useState(initial.scores);
  const [hole, setHole] = useState(initial.hole);
  const [roundId, setRoundId] = useState(initial.roundId);
  const [history, setHistory] = useState(loadHistory());
  const [tombs, setTombs] = useState(loadTombs());
  const cloud = useCloudSync(history, setHistory, tombs, setTombs);
  useEffect(() => { saveState({ screen, course, diff, scores, hole, roundId }); }, [screen, course, diff, scores, hole, roundId]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveTombs(tombs); }, [tombs]);
  const ghost = useMemo(() => course ? computeGhost(course, diff) : null, [course, diff]);
  const stats = useMemo(() => deriveStats(history), [history]);
  const start = () => { if (!course) return; setScores(Array(18).fill(null)); setHole(0); setRoundId(null); setScreen("play"); };
  // Exit an unfinished round without saving it: clear scores and return to the menu.
  const exitRound = () => { setScores(Array(18).fill(null)); setHole(0); setRoundId(null); setScreen("setup"); };
  // Finalize: persist the finished round, then a soft (editable) transition to summary.
  const finalize = (finalScores) => {
    const rec = buildRecord({ id: newId(), date: nowISO() }, course, diff, finalScores, ghost);
    setHistory(h => [...h, rec]);
    setRoundId(rec.id);
    setScreen("summary");
  };
  // Edit a hole from the summary: recompute in place; if finalized, update the stored round.
  const editScore = (i, v) => {
    const ns = scores.map((s, k) => k === i ? Math.max(1, v) : s);
    setScores(ns);
    if (roundId) setHistory(h => h.map(r => r.id === roundId ? buildRecord({ id: r.id, date: r.date }, course, diff, ns, ghost) : r));
  };
  const reset = () => { setRoundId(null); setScreen("setup"); };
  // Delete a stored round so test rounds never pollute the record.
  const deleteRound = (id) => {
    setHistory(h => h.filter(r => r.id !== id));
    setTombs(t => [...t.filter(x => x.id !== id), { id, updatedAt: Date.now() }]);
    if (id === roundId) setRoundId(null);
  };
  // Restore a backup: merge by id so an old export can never delete newer rounds, and
  // keep history in date order (deriveStats reads the streak off the end).
  const importRounds = (incoming) => {
    const seen = new Set(history.map(r => r.id));
    const add = incoming.filter(r => !seen.has(r.id));
    if (add.length) setHistory(h => [...h, ...add].sort((a, b) => new Date(a.date) - new Date(b.date)));
    return { added: add.length, skipped: incoming.length - add.length };
  };
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <style dangerouslySetInnerHTML={{ __html: RESET }} />
      {screen === "setup" && <Setup course={course} setCourse={setCourse} diff={diff} setDiff={setDiff} stats={stats} history={history} onStart={start} onHistory={() => setScreen("history")} />}
      {screen === "play" && course && ghost && <Play course={course} ghost={ghost} scores={scores} setScores={setScores} hole={hole} setHole={setHole} onFinish={finalize} onExit={exitRound} />}
      {screen === "summary" && course && ghost && <Summary course={course} ghost={ghost} scores={scores} history={history} onEditScore={editScore} onReset={reset} />}
      {screen === "history" && <History history={history} stats={stats} cloud={cloud} onDelete={deleteRound} onImport={importRounds} onBack={() => setScreen("setup")} />}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
