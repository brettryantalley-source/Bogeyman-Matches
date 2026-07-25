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
const Trash = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></Icon>;

/* build tag — bump alongside the sw.js cache version so a deploy is confirmable on-screen */
const BUILD = "v6 · Jul 20";

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
html,body{margin:0;background:#000}`;

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
const fmtPts = (n) => Number.isInteger(n) ? `${n}` : n.toFixed(1);
const marginText = (m) => m === 0 ? "AS" : m < 0 ? `${-m}↑` : `${m}↓`;

/* ---------- Google Sheet auto last-5 differential (read-only; write-back deferred) ---------- */
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzaFF9AvD61Y6iWgCyeEVm_bCG2DVW8waalO3Fdom3tFiIC3vmGv_Oqe_9xJQikMvQexT9sTIEu7hQ/pub?gid=0&single=true&output=csv";
const DIFF_CACHE_KEY = "bogeyman-matches:diff-cache:v1";
/* minimal RFC-4180-ish CSV parser (handles quoted fields with commas) */
function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') { q = true; }
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
/* tolerant date parse — ISO first (no TZ drift), then Date.parse fallback */
function parseSheetDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) { const d = new Date(+iso[1], +iso[2] - 1, +iso[3]); return isNaN(d.getTime()) ? null : d; }
  const ms = Date.parse(t);
  return isNaN(ms) ? null : new Date(ms);
}
const fmtSheetShort = (d) => { try { return `${MONTHS[d.getMonth()]} ${d.getDate()}`; } catch (e) { return ""; } };
/* CSV text -> {diff, asOf, count} from the 5 most-recent valid rows, or null */
function computeLast5(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const header = rows[0].map(h => h.trim().toLowerCase());
  const di = header.indexOf("date");
  const fi = header.indexOf("differential");
  if (di === -1 || fi === -1) return null;
  const recs = [];
  for (let r = 1; r < rows.length; r++) {
    const d = parseSheetDate(rows[r][di]);
    const raw = (rows[r][fi] ?? "").trim();
    const v = parseFloat(raw);
    if (!d || raw === "" || isNaN(v)) continue;   // skip blanks / notes / summary rows
    recs.push({ d, v });
  }
  if (!recs.length) return null;
  recs.sort((a, b) => b.d - a.d);
  const last5 = recs.slice(0, 5);
  const avg = Math.round((last5.reduce((a, x) => a + x.v, 0) / last5.length) * 10) / 10;
  return { diff: avg, asOf: last5[0].d, count: last5.length };
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
  return {
    version: 1,
    id: base.id, date: base.date,
    course: course.name, tee: course.tee, ratingSlope: `${course.rating}/${course.slope}`,
    differentialUsed: diff,
    holeScores: scores.slice(), ghostHoleScores: ghost.holes.slice(),
    yardages: course.holes.map(h => typeof h.yards === "number" ? h.yards : null),
    yourOut, yourIn, yourTotal: m.total.yourTot, ghostTotal: ghost.gross,
    yourPoints, ghostPoints,
    result,
  };
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
function Setup({ course, setCourse, diff, setDiff, stats, onStart, onHistory }) {
  /* --- course search (golfcourseapi, debounced) --- */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchState, setSearchState] = useState("idle"); // idle | loading | done | empty | error
  const [open, setOpen] = useState(false);
  const [selectedFull, setSelectedFull] = useState(null); // full course from Call 2
  const [tees, setTees] = useState([]);                    // flattened tee options
  const [teeKey, setTeeKey] = useState("");
  const [loadState2, setLoadState2] = useState("idle");    // idle | loading | error
  const [pendingId, setPendingId] = useState(null);        // id being loaded (for retry)

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchState("idle"); return; }
    const ctrl = new AbortController();
    setSearchState("loading");
    const t = setTimeout(() => {
      searchCourses(q, ctrl.signal)
        .then(cs => { setResults(cs.slice(0, 5)); setSearchState(cs.length ? "done" : "empty"); })
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

  /* --- auto last-5 differential from Brett's published Sheet (v5, preserved) ---
     cache-first, then network, then manual. Never blocks; override is this-round-only. */
  const [source, setSource] = useState("loading"); // loading | sheet | cache | manual | none
  const [asOf, setAsOf] = useState(null);
  const overridden = React.useRef(false);
  const aliveRef = React.useRef(true);
  const syncDiff = React.useCallback(() => {
    overridden.current = false;
    let cache = null;
    try { const raw = localStorage.getItem(DIFF_CACHE_KEY); if (raw) { const cc = JSON.parse(raw); if (cc && typeof cc.diff === "number") cache = cc; } } catch (e) { /* ignore */ }
    if (cache) { setDiff(cache.diff); setAsOf(cache.asOf ? new Date(cache.asOf) : null); setSource("cache"); }
    else { setSource("loading"); }
    fetch(CSV_URL, { redirect: "follow", cache: "no-store" })
      .then(r => r.ok ? r.text() : Promise.reject(new Error("http " + r.status)))
      .then(text => {
        const res = computeLast5(text);
        if (!res) throw new Error("no valid rows");
        try { localStorage.setItem(DIFF_CACHE_KEY, JSON.stringify({ diff: res.diff, asOf: res.asOf.toISOString(), fetchedAt: nowISO() })); } catch (e) { /* quota */ }
        if (!aliveRef.current || overridden.current) return;
        setDiff(res.diff); setAsOf(res.asOf); setSource("sheet");
      })
      .catch(() => {
        if (!aliveRef.current || overridden.current) return;
        setSource(cache ? "cache" : "none");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDiff]);
  useEffect(() => { aliveRef.current = true; syncDiff(); return () => { aliveRef.current = false; }; }, [syncDiff]);
  const bumpDiff = (delta) => { overridden.current = true; setSource("manual"); setDiff(d => Math.max(0, Math.round((d + delta) * 10) / 10)); };
  const asOfLbl = asOf ? ` (${fmtSheetShort(asOf)})` : "";
  const srcLine =
    source === "loading" ? "Syncing your Sheet…" :
    source === "sheet" ? `Last-5: ${diff.toFixed(1)} · from your Sheet${asOfLbl}` :
    source === "cache" ? `Last-5: ${diff.toFixed(1)} · using last synced${asOfLbl}` :
    source === "manual" ? "Manual override · applies to this round only" :
    "No sync — set your last-5 differential manually";
  const srcColor = source === "sheet" ? C.green : source === "manual" ? C.ink : C.sub;

  const g = course ? computeGhost(course, diff) : null;
  const teeLabel = (o) => `${o.tee.tee_name || o.gender} · ${o.tee.course_rating}/${o.tee.slope_rating}${o.gender === "female" ? " (F)" : ""}`;
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 13, background: C.card, border: `1.5px solid ${C.line}`, color: C.ink, fontSize: 15, fontFamily: SANS, outline: "none" };

  return (
    <div style={{ height: "100dvh", maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 18px calc(env(safe-area-inset-bottom) + 14px)", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={16} color={C.green} />
          <span style={{ color: C.sub, letterSpacing: 2.5, fontSize: 11, fontWeight: 800 }}>BOGEYMAN MATCHES</span>
        </div>
        <span style={{ color: C.sub, fontSize: 10, fontWeight: 700, ...tnum }}>{BUILD}</span>
      </div>

      {/* record row (compact) */}
      {stats.n > 0 && (
        <div style={{ flexShrink: 0, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={lbl}>VS THE BOGEYMAN</div>
            <button onClick={onHistory} style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, background: "none", display: "flex", alignItems: "center", gap: 2 }}>HISTORY <ChevronRight size={13} /></button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <MiniStat label="RECORD" value={stats.recordText} />
            <MiniStat label="STREAK" value={stats.streakText} accent={streakAccent(stats)} />
            <MiniStat label="AVG MARGIN" value={stats.marginStr} accent={marginAccent(stats)} />
          </div>
        </div>
      )}

      {/* middle — scrolls internally so START never hides behind content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* course search */}
        <div style={{ position: "relative" }}>
          <div style={{ ...lbl, marginBottom: 8 }}>COURSE</div>
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
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: C.card2, border: `1px solid ${C.line}`, borderRadius: 13, overflow: "hidden", zIndex: 40, boxShadow: "0 12px 28px rgba(0,0,0,0.55)" }}>
              {searchState === "loading" && <div style={{ padding: "12px 14px", color: C.sub, fontSize: 13 }}>Searching…</div>}
              {searchState === "empty" && <div style={{ padding: "12px 14px", color: C.sub, fontSize: 13 }}>No courses found — try a different name or spelling.</div>}
              {searchState === "error" && <div style={{ padding: "12px 14px", color: C.red, fontSize: 13 }}>Course search unavailable — check your connection.</div>}
              {searchState === "done" && results.map(r => (
                <button key={r.id} onClick={() => pickCourse(r.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", color: C.ink, borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.15 }}>{r.club_name || r.course_name}</div>
                  <div style={{ color: C.sub, fontSize: 11, marginTop: 1 }}>
                    {[r.course_name && r.course_name !== r.club_name ? r.course_name : null, r.location && [r.location.city, r.location.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
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

        {/* differential (v5 block, reused) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={lbl}>YOUR LAST-5 DIFFERENTIAL</div>
            {source === "manual" && (
              <button onClick={syncDiff} style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, background: "none" }}>USE SHEET</button>
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
function Play({ course, ghost, scores, setScores, hole, setHole, onFinish }) {
  const m = useMemo(() => evalMatch(scores, ghost.holes), [scores, ghost]);
  const h = course.holes[hole], gh = ghost.holes[hole];
  const pending = scores[hole] ?? h.par;
  const setVal = (v) => setScores(prev => { const n = [...prev]; n[hole] = Math.max(1, v); return n; });
  const seg = m.segs[Math.floor(hole / 3)];
  const segLeft = 3 - ((hole % 3) + 1);
  const lead = m.you - m.opp;
  const commitGo = (dir) => { setScores(prev => { const n = [...prev]; if (n[hole] == null) n[hole] = h.par; return n; }); const nx = hole + dir; if (nx >= 0 && nx < 18) setHole(nx); };
  const filled = scores.filter(s => s != null).length;
  const allIn = filled === 18;
  // Finalize is offered once every hole has a score (the current hole's pending
  // value counts — it commits to par on tap). Disabled otherwise.
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
    <div style={{ height: "100dvh", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8, padding: "calc(env(safe-area-inset-top) + 8px) 12px calc(env(safe-area-inset-bottom) + 8px)", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
        <div>
          <div style={{ color: C.ink, fontWeight: 800, fontSize: 15 }}>{course.name}</div>
          <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{course.tee} · ghost {ghost.gross}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...lbl, fontSize: 10 }}>HOLE</div>
          <div style={{ fontFamily: NUM, fontWeight: 800, fontSize: 18, color: C.ink, ...tnum }}>{hole + 1}<span style={{ color: C.sub, fontSize: 12 }}>/18</span></div>
        </div>
      </div>

      {/* history rail */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {scores.map((s, i) => {
          let bg = C.card2;
          if (s != null) { const d = s - ghost.holes[i]; bg = d < 0 ? C.green : d > 0 ? C.red : "#4A4E54"; }
          return <div key={i} onClick={() => setHole(i)} style={{ flex: 1, height: 5, borderRadius: 2, background: bg, outline: i === hole ? `2px solid ${C.ink}` : "none" }} />;
        })}
      </div>

      {/* scoreboard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 16, padding: "10px 18px", flexShrink: 0 }}>
        <div>
          <div style={{ color: C.green, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>YOU</div>
          <div style={{ fontFamily: NUM, fontSize: 36, fontWeight: 800, color: C.green, lineHeight: 1, ...tnum }}>{fmtPts(m.you)}</div>
        </div>
        <div style={{ color: lead > 0 ? C.green : lead < 0 ? C.red : C.sub, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
          {lead === 0 ? "ALL SQUARE" : lead > 0 ? `${fmtPts(lead)} UP` : `${fmtPts(-lead)} DOWN`}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.slate, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>GHOST</div>
          <div style={{ fontFamily: NUM, fontSize: 36, fontWeight: 800, color: C.slate, lineHeight: 1, ...tnum }}>{fmtPts(m.opp)}</div>
        </div>
      </div>

      {/* segment strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, flexShrink: 0 }}>
        {m.segs.map((s, i) => <SegCell key={i} res={s.res} label={segLab(s)} sub={segSub(s)} margin={s.liveMargin} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, flexShrink: 0 }}>
        <StatPill label="FRONT 9" res={m.front.res} sub={nineSub(m.front)} />
        <StatPill label="BACK 9" res={m.back.res} sub={nineSub(m.back)} />
        <StatPill label="TOTAL" res={m.total.res} sub={totSub} />
      </div>

      {/* hole focus — fills remaining space, controls in thumb zone */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, minHeight: 0 }}>
        <div style={{ background: C.card, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 15, ...tnum }}>Par {h.par}</div>
              <div style={{ color: C.sub, fontSize: 12, ...tnum }}>Stroke index {h.si}</div>
            </div>
            <GhostRing value={gh} size={44} label="GHOST" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setVal(pending - 1)} style={stepBtn}><Minus size={24} /></button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontFamily: NUM, fontSize: 54, fontWeight: 800, color: scores[hole] == null ? C.sub : C.green, lineHeight: 1, ...tnum }}>{pending}</div>
              <div style={{ color: pending - h.par <= 0 ? C.green : C.sub, fontSize: 12, fontWeight: 700, marginTop: 3 }}>
                {scoreName(pending, h.par)}{scores[hole] == null ? " · tap to log" : ""}
              </div>
            </div>
            <button onClick={() => setVal(pending + 1)} style={stepBtn}><Plus size={24} /></button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card2, borderRadius: 12, padding: "8px 14px" }}>
          <span style={{ color: C.sub, fontSize: 12 }}>Segment {Math.floor(hole / 3) + 1} · {segLeft === 0 ? "last hole" : `${segLeft} to play`}</span>
          <span style={{ fontFamily: NUM, fontSize: 13, fontWeight: 700, color: seg.liveMargin < 0 ? C.green : seg.liveMargin > 0 ? C.red : C.sub }}>
            {seg.holesIn === 0 ? "—" : seg.liveMargin === 0 ? "level" : seg.liveMargin < 0 ? `${-seg.liveMargin} ahead` : `${seg.liveMargin} behind`}
          </span>
        </div>
      </div>

      {/* nav (thumb zone) */}
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={() => commitGo(-1)} disabled={hole === 0} style={{ width: 60, height: 52, borderRadius: 14, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: hole === 0 ? 0.4 : 1 }}><ChevronLeft size={22} /></button>
        {canFinalize ? (
          <button onClick={doFinalize} style={{ flex: 1, height: 52, borderRadius: 14, background: C.green, color: "#07140C", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Flag size={18} /> Finalize round</button>
        ) : (
          <button onClick={() => commitGo(1)} disabled={hole === 17} style={{ flex: 1, height: 52, borderRadius: 14, background: hole === 17 ? C.card2 : C.green, color: hole === 17 ? C.sub : "#07140C", border: hole === 17 ? `1px solid ${C.line}` : "none", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{hole === 17 ? "Finalize round" : <React.Fragment>Next hole <ChevronRight size={20} /></React.Fragment>}</button>
        )}
      </div>
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

      {/* record vs the Bogeyman (updates live as you edit) */}
      <div style={{ marginTop: 22 }}>
        <div style={{ ...lbl, marginBottom: 8 }}>VS THE BOGEYMAN</div>
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

/* ---------- history + delete ---------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const resColor = (r) => r === "W" ? C.green : r === "L" ? C.red : C.slate;

function History({ history, stats, onDelete, onBack }) {
  const [confirmId, setConfirmId] = useState(null);
  const rounds = [...history].reverse(); // most recent first
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 14px) 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ width: 44, height: 44, borderRadius: 13, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ChevronLeft size={22} /></button>
        <div>
          <h1 style={{ color: C.ink, fontSize: 24, fontWeight: 800, letterSpacing: -0.3, margin: 0 }}>Match history</h1>
          <div style={{ color: C.sub, fontSize: 12, ...tnum }}>{stats.recordText} · {stats.streakText} · {stats.marginStr}</div>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div style={{ textAlign: "center", color: C.sub, fontSize: 14, padding: "48px 0" }}>No rounds logged yet.</div>
      ) : rounds.map(r => {
        const confirming = confirmId === r.id;
        const margin = r.yourPoints - r.ghostPoints;
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.card2, color: resColor(r.result), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{r.result}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.ink, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.course}<span style={{ color: C.sub, fontWeight: 600 }}> · {r.tee}</span></div>
              <div style={{ color: C.sub, fontSize: 11, ...tnum }}>{fmtDate(r.date)} · {fmtPts(r.yourPoints)}–{fmtPts(r.ghostPoints)} · {margin >= 0 ? "+" : ""}{margin.toFixed(1)}</div>
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
    // Only restore an in-progress round when we have a valid course AND valid scores.
    const wantResume = (s.screen === "play" || s.screen === "summary") && course && scoresOk;
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
  useEffect(() => { saveState({ screen, course, diff, scores, hole, roundId }); }, [screen, course, diff, scores, hole, roundId]);
  useEffect(() => { saveHistory(history); }, [history]);
  const ghost = useMemo(() => course ? computeGhost(course, diff) : null, [course, diff]);
  const stats = useMemo(() => deriveStats(history), [history]);
  const start = () => { if (!course) return; setScores(Array(18).fill(null)); setHole(0); setRoundId(null); setScreen("play"); };
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
  const deleteRound = (id) => { setHistory(h => h.filter(r => r.id !== id)); if (id === roundId) setRoundId(null); };
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <style dangerouslySetInnerHTML={{ __html: RESET }} />
      {screen === "setup" && <Setup course={course} setCourse={setCourse} diff={diff} setDiff={setDiff} stats={stats} onStart={start} onHistory={() => setScreen("history")} />}
      {screen === "play" && course && ghost && <Play course={course} ghost={ghost} scores={scores} setScores={setScores} hole={hole} setHole={setHole} onFinish={finalize} />}
      {screen === "summary" && course && ghost && <Summary course={course} ghost={ghost} scores={scores} history={history} onEditScore={editScore} onReset={reset} />}
      {screen === "history" && <History history={history} stats={stats} onDelete={deleteRound} onBack={() => setScreen("setup")} />}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
