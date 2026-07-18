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

const stepBtn = { width: 54, height: 54, borderRadius: 15, background: C.card2, color: C.ink, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const lbl = { color: C.sub, fontSize: 11, fontWeight: 800, letterSpacing: 1 };

/* ---------- setup ---------- */
function Setup({ courseId, setCourseId, diff, setDiff, onStart }) {
  const c = COURSES.find(x => x.id === courseId);
  const g = computeGhost(c, diff);
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 14px) 18px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Target size={16} color={C.green} />
        <span style={{ color: C.sub, letterSpacing: 2.5, fontSize: 11, fontWeight: 800 }}>BOGEYMAN MATCHES</span>
      </div>
      <h1 style={{ color: C.ink, fontSize: 28, fontWeight: 800, letterSpacing: -0.4, margin: "0 0 18px" }}>New ghost match</h1>

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
  const canFinish = hole === 17 && (scores[17] != null || filled === 17);

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
        {canFinish ? (
          <button onClick={onFinish} style={{ flex: 1, height: 52, borderRadius: 14, background: C.green, color: "#07140C", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Flag size={18} /> See result</button>
        ) : (
          <button onClick={() => commitGo(1)} disabled={hole === 17} style={{ flex: 1, height: 52, borderRadius: 14, background: C.green, color: "#07140C", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: hole === 17 ? 0.4 : 1 }}>Next hole <ChevronRight size={20} /></button>
        )}
      </div>
    </div>
  );
}

/* ---------- summary ---------- */
function Summary({ course, ghost, scores, onReset }) {
  const m = evalMatch(scores, ghost.holes);
  const won = m.you > m.opp, tie = m.you === m.opp;
  const segSub = (s) => `${s.yourSum}–${s.ghostSum}`;
  const segLab = (s) => s.res === "win" ? "WON" : s.res === "loss" ? "LOST" : "HALF";
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

      <button onClick={onReset} style={{ width: "100%", marginTop: 24, padding: "15px 0", background: C.card, color: C.ink, borderRadius: 16, border: `1px solid ${C.line}`, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><RotateCcw size={18} /> New round</button>
    </div>
  );
}

/* ---------- localStorage persistence ---------- */
const LS_KEY = "bogeyman-matches:v1";
const DEFAULT_STATE = { screen: "setup", courseId: "rp-black", diff: 7.9, scores: Array(18).fill(null), hole: 0 };
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
    };
  } catch (e) {
    return DEFAULT_STATE;
  }
}
function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* quota / private mode */ }
}

/* ---------- app ---------- */
function App() {
  const initial = loadState();
  const [screen, setScreen] = useState(initial.screen);
  const [courseId, setCourseId] = useState(initial.courseId);
  const [diff, setDiff] = useState(initial.diff);
  const [scores, setScores] = useState(initial.scores);
  const [hole, setHole] = useState(initial.hole);
  useEffect(() => { saveState({ screen, courseId, diff, scores, hole }); }, [screen, courseId, diff, scores, hole]);
  const course = COURSES.find(c => c.id === courseId);
  const ghost = useMemo(() => computeGhost(course, diff), [course, diff]);
  const start = () => { setScores(Array(18).fill(null)); setHole(0); setScreen("play"); };
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.ink, fontFamily: SANS }}>
      <style dangerouslySetInnerHTML={{ __html: RESET }} />
      {screen === "setup" && <Setup courseId={courseId} setCourseId={setCourseId} diff={diff} setDiff={setDiff} onStart={start} />}
      {screen === "play" && <Play course={course} ghost={ghost} scores={scores} setScores={setScores} hole={hole} setHole={setHole} onFinish={() => setScreen("summary")} />}
      {screen === "summary" && <Summary course={course} ghost={ghost} scores={scores} onReset={() => setScreen("setup")} />}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
