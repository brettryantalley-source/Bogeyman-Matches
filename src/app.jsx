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
const BUILD = "v4 · Jul 18";

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

/* courses */
const mk = (p, s) => p.map((par, i) => ({ par, si: s[i] }));
const COURSES = [
  { id: "rp-black", name: "RiverPines", tee: "Black", rating: 71.1, slope: 132, par: 70, holes: mk([4,4,3,4,3,4,4,5,4,4,4,4,4,3,4,3,5,4],[7,9,17,1,13,5,11,3,15,12,6,14,8,18,4,16,10,2]) },
  { id: "wood", name: "Woodmont G&CC", tee: "Medal", rating: 71.3, slope: 135, par: 72, holes: mk([5,3,4,4,4,3,4,4,5,5,3,4,3,4,3,5,4,5],[15,11,9,1,5,17,7,3,13,12,18,6,14,2,10,4,8,16]) },
  { id: "bear", name: "Bear Slide", tee: "Blue", rating: 72.3, slope: 134, par: 71, holes: mk([4,4,5,3,4,3,4,5,4,4,4,5,4,3,4,3,4,4],[3,13,17,7,5,11,9,15,1,4,16,10,6,12,14,18,8,2]) },
  { id: "hamp", name: "Hampton GV", tee: "Blue", rating: 69.9, slope: 131, par: 71, holes: mk([4,3,4,4,5,4,4,3,4,4,3,4,5,3,5,4,3,5],[9,13,11,1,3,17,5,15,7,16,12,2,4,8,10,18,14,6]) },
  { id: "calla", name: "Callahan", tee: "Black", rating: 72.8, slope: 134, par: 72, holes: mk([5,4,4,5,4,3,4,3,4,5,4,4,4,3,4,4,3,5],[9,5,11,7,1,17,3,15,13,8,4,10,2,18,12,16,14,6]) },
  { id: "cider", name: "Cider Ridge", tee: "II", rating: 71.7, slope: 130, par: 72, holes: mk([4,4,3,4,5,4,4,3,5,4,4,3,4,4,5,4,3,5],[10,8,2,6,14,4,16,12,18,7,17,11,13,3,9,1,15,5]) },
  { id: "cres", name: "Crescent Oaks", tee: "Black", rating: 72.7, slope: 134, par: 72, holes: mk([4,5,3,4,4,5,3,4,4,5,3,4,4,4,5,4,3,4],[3,7,11,13,15,5,17,1,9,8,14,2,18,12,10,6,16,4]) },
  { id: "sanc", name: "Sanctuary Cove", tee: "Blue", rating: 72.1, slope: 126, par: 72, holes: mk([4,4,5,3,4,4,5,3,4,4,4,5,3,4,4,3,5,4],[9,3,1,11,15,5,17,13,7,8,10,14,18,6,16,12,2,4]) },
  { id: "mtn", name: "Mountain Harbour", tee: "Gold", rating: 69.5, slope: 126, par: 72, holes: mk([5,4,4,3,4,3,4,5,4,4,3,4,4,5,3,4,4,5],[15,3,9,5,13,7,11,1,17,4,16,6,14,18,12,10,2,8]) },
  { id: "rp-blue", name: "RiverPines", tee: "Blue", rating: 69.4, slope: 127, par: 70, holes: mk([4,4,3,4,3,4,4,5,4,4,4,4,4,3,4,3,5,4],[7,9,17,1,13,5,11,3,15,12,6,14,8,18,4,16,10,2]) },
  { id: "chico-gold", name: "Chicopee Mill/Sch", tee: "Gold", rating: 72.7, slope: 135, par: 72, holes: mk([5,3,4,5,3,4,4,4,4,4,4,4,3,5,4,4,3,5],[17,15,11,7,3,1,13,5,9,4,16,12,18,10,2,8,14,6]) },
  { id: "chico-blue", name: "Chicopee Mill/Sch", tee: "Blue", rating: 71.2, slope: 131, par: 72, holes: mk([5,3,4,5,3,4,4,4,4,4,4,4,3,5,4,4,3,5],[17,15,11,7,3,1,13,5,9,4,16,12,18,10,2,8,14,6]) },
  { id: "chico-sm-gold", name: "Chicopee Sch/Mill", tee: "Gold", rating: 72.7, slope: 135, par: 72, holes: mk([4,4,4,3,5,4,4,3,5,5,3,4,5,3,4,4,4,4],[4,16,12,18,10,2,8,14,6,17,15,11,7,3,1,13,5,9]) },
  { id: "chico-sm-blue", name: "Chicopee Sch/Mill", tee: "Blue", rating: 71.2, slope: 131, par: 72, holes: mk([4,4,4,3,5,4,4,3,5,5,3,4,5,3,4,4,4,4],[4,16,12,18,10,2,8,14,6,17,15,11,7,3,1,13,5,9]) },
];

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

/* ---------- setup ---------- */
function Setup({ courseId, setCourseId, diff, setDiff, stats, onStart, onHistory }) {
  const c = COURSES.find(x => x.id === courseId);
  const g = computeGhost(c, diff);
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 14px) 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={16} color={C.green} />
          <span style={{ color: C.sub, letterSpacing: 2.5, fontSize: 11, fontWeight: 800 }}>BOGEYMAN MATCHES</span>
        </div>
        <span style={{ color: C.sub, fontSize: 10, fontWeight: 700, ...tnum }}>{BUILD}</span>
      </div>
      <h1 style={{ color: C.ink, fontSize: 28, fontWeight: 800, letterSpacing: -0.4, margin: "0 0 18px" }}>New ghost match</h1>

      {stats.n > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
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

      <div style={lbl}>COURSE</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "8px 0 22px" }}>
        {COURSES.map(x => {
          const on = x.id === courseId;
          return (
            <button key={x.id} onClick={() => setCourseId(x.id)} style={{ textAlign: "left", padding: "11px 12px", borderRadius: 13, background: on ? C.greenDim : C.card, border: `1.5px solid ${on ? C.green : C.line}`, color: C.ink }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.1 }}>{x.name}</div>
              <div style={{ color: C.sub, fontSize: 11, marginTop: 2, ...tnum }}>{x.tee} · {x.rating}/{x.slope}</div>
            </button>
          );
        })}
      </div>

      <div style={lbl}>YOUR LAST-5 DIFFERENTIAL</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 24px" }}>
        <button onClick={() => setDiff(d => Math.max(0, Math.round((d - 0.1) * 10) / 10))} style={stepBtn}><Minus size={20} /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: NUM, fontSize: 34, fontWeight: 800, color: C.green, ...tnum }}>{diff.toFixed(1)}</div>
        <button onClick={() => setDiff(d => Math.round((d + 0.1) * 10) / 10)} style={stepBtn}><Plus size={20} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 18, border: `1px solid ${C.line}`, padding: "14px 18px", marginBottom: 24 }}>
        <div>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>The ghost plays to</div>
          <div style={{ color: C.sub, fontSize: 11, marginTop: 3, ...tnum }}>{g.hcp} strokes · {g.hcp} hardest holes · par {c.par}</div>
        </div>
        <GhostRing value={g.gross} size={58} />
      </div>

      <button onClick={onStart} style={{ width: "100%", padding: "15px 0", background: C.green, color: "#07140C", borderRadius: 16, fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>Start round</button>
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
const DEFAULT_STATE = { screen: "setup", courseId: "rp-black", diff: 7.9, scores: Array(18).fill(null), hole: 0, roundId: null };
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return DEFAULT_STATE;
    if (!COURSES.find(c => c.id === s.courseId)) return DEFAULT_STATE;
    if (!Array.isArray(s.scores) || s.scores.length !== 18) return DEFAULT_STATE;
    return {
      screen: s.screen === "play" || s.screen === "summary" || s.screen === "setup" ? s.screen : "setup",
      courseId: s.courseId,
      diff: typeof s.diff === "number" ? s.diff : 7.9,
      scores: s.scores.map(v => (typeof v === "number" && v > 0 ? v : null)),
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
  const [courseId, setCourseId] = useState(initial.courseId);
  const [diff, setDiff] = useState(initial.diff);
  const [scores, setScores] = useState(initial.scores);
  const [hole, setHole] = useState(initial.hole);
  const [roundId, setRoundId] = useState(initial.roundId);
  const [history, setHistory] = useState(loadHistory());
  useEffect(() => { saveState({ screen, courseId, diff, scores, hole, roundId }); }, [screen, courseId, diff, scores, hole, roundId]);
  useEffect(() => { saveHistory(history); }, [history]);
  const course = COURSES.find(c => c.id === courseId);
  const ghost = useMemo(() => computeGhost(course, diff), [course, diff]);
  const stats = useMemo(() => deriveStats(history), [history]);
  const start = () => { setScores(Array(18).fill(null)); setHole(0); setRoundId(null); setScreen("play"); };
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
      {screen === "setup" && <Setup courseId={courseId} setCourseId={setCourseId} diff={diff} setDiff={setDiff} stats={stats} onStart={start} onHistory={() => setScreen("history")} />}
      {screen === "play" && <Play course={course} ghost={ghost} scores={scores} setScores={setScores} hole={hole} setHole={setHole} onFinish={finalize} />}
      {screen === "summary" && <Summary course={course} ghost={ghost} scores={scores} history={history} onEditScore={editScore} onReset={reset} />}
      {screen === "history" && <History history={history} stats={stats} onDelete={deleteRound} onBack={() => setScreen("setup")} />}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
