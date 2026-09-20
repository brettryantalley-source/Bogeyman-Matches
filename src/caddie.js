/*
 * caddie.js — the Caddie engine (v18).
 *
 * Pure functions, no DOM, no I/O. Every function takes the profile as an
 * argument so node tests can load src/profile.json with fs and app.jsx can
 * `import profile from "./profile.json"` (esbuild handles JSON natively).
 *
 * Principles (from the spec, not reinterpreted here):
 *   1. Every hole is played for par — the club with the best chance of par or
 *      better from where it leaves him wins. Nothing else moves the call.
 *   2. The ghost is a status line, never an input. `ghost` is copied to
 *      `ghostLine` and read by nothing else in this file.
 *   3. Every why-note cites a profile number.
 *   4. The profile is hand-refreshed from Shot Pattern exports.
 *   5. The scoring model (computeGhost / evalMatch) is untouched — it is not
 *      even imported here.
 *
 * Conventions decided in docs/HANDOFF-caddie.md §3.3:
 *   - Zones are half-open: `from <= d < to`. 75 is in 75–100, not 50–75.
 *   - Spec test #5 is relaxed: 9i has shortPct 0, so 140 fairway is a
 *     `stock` swing to `center`, not `easy`.
 *   - Par 5 `secondClub` = the approach club whose median best leaves 130–150
 *     from the tee-shot leave.
 *   - The spec's `playing = flags.wet ? distance : distance` line is gone.
 *     Wet changes the club (profile.wet.clubUp) and the target, not the number.
 */

/* ---------- small helpers ---------- */

const pct = (x) => `${Math.round(x * 100)}%`;
const ft = (x) => Math.round(x);

/** Clamp-at-ends linear interpolation over [[x, y], ...] sorted by x. */
export function interp(points, x) {
  if (!points.length) return 0;
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Sample-size confidence. n < 8 low, 8–15 med, > 15 high. */
export function confidence(n) {
  if (n < 8) return "low";
  if (n <= 15) return "med";
  return "high";
}

/** Zone containing d under the half-open convention from <= d < to. Null below the first zone. */
export function zoneFor(d, profile) {
  return profile.zones.find((z) => d >= z.from && d < z.to) || null;
}

/** "130–150" or "225+" for the open-ended last zone. */
export function zoneLabel(z) {
  return z.to >= 999 ? `${z.from}+` : `${z.from}–${z.to}`;
}

const gradeWord = { green: "best", red: "worst", amber: "neutral" };

/** Appends the low-confidence marker when the zone's sample is small. */
function withSample(text, z) {
  return confidence(z.n) === "low" ? `${text} (small sample)` : text;
}

/** Normalise flags: accepts an object of booleans or an array of names. */
function normFlags(flags) {
  if (!flags) return {};
  if (Array.isArray(flags)) return Object.fromEntries(flags.map((f) => [f, true]));
  return flags;
}
const anyFlag = (f) => Boolean(f.tight || f.waterL || f.waterR || f.wet || f.wind);

const clubById = (profile, id) => profile.clubs.find((c) => c.id === id);
const byMedian = (a, b) => a.median - b.median;

/* ---------- §2.1 zone scoring ---------- */

const twoPuttOrBetter = (prox) => (prox <= 25 ? 0.9 : prox <= 40 ? 0.82 : prox <= 60 ? 0.72 : 0.6);
const scramble = (d) => (d <= 150 ? 0.4 : 0.33);

/**
 * Chance of par or better from a leave of `distance` yards, in [0, 1].
 * Observed zone performance shrunk toward a scratch-ish prior by shrinkK.
 * Leaves under 50 use the 50–75 zone (the engine never evaluates a chip as a leave on purpose).
 */
export function parScore(distance, profile) {
  const d = Math.max(distance, profile.zones[0].from);
  const z = zoneFor(d, profile) || profile.zones[profile.zones.length - 1];
  const bench = interp(profile.benchGir, d);
  const prior = bench * 0.85 + (1 - bench) * 0.35;
  const observed = z.gir * twoPuttOrBetter(z.proxFt) + (1 - z.gir) * scramble(d);
  const k = profile.constants.shrinkK;
  return (observed * z.n + prior * k) / (z.n + k);
}

/* ---------- §2.2 trouble tax ---------- */

/** Expected-stroke cost of trouble for a club under the given flags. */
export function troubleTax(club, flags, profile) {
  const f = normFlags(flags);
  const c = profile.constants;
  let tax = (club.penaltyPct ?? 0) * c.penaltyCost + (club.recoveryPct ?? 0) * c.recoveryCost;
  if (f.tight && (club.width80 ?? 0) > 60) tax += c.tightTax;
  if (f.waterR && (club.bigMissR ?? 0) > 0.15) tax += c.waterSideTax;
  if (f.waterL && (club.bigMissL ?? 0) > 0.15) tax += c.waterSideTax;
  return tax;
}

/** Trouble tax on the par scale: one lost stroke ≈ −strokeToParScale chance of par. */
const taxToPar = (tax, profile) => tax * profile.constants.strokeToParScale;

/* ---------- §2.3 tee decision ---------- */

/**
 * Par 5 second shot after a tee leave of `leave` yards.
 * Reachable (leave <= 265, no flags): go for it with the lower-tax of 2i/2Hy;
 * scored as parScore(leave) per spec §2.3. Otherwise lay up with the approach
 * club whose median best leaves 130–150 and score the third-shot leave.
 */
export function secondShot(leave, flags, profile) {
  const f = normFlags(flags);
  if (leave <= 265 && !anyFlag(f)) {
    const go = ["2i", "2Hy"].map((id) => clubById(profile, id)).filter(Boolean)
      .sort((a, b) => troubleTax(a, f, profile) - troubleTax(b, f, profile) || a.width80 - b.width80)[0];
    return { mode: "reach", club: go, leave3: leave, score: parScore(leave, profile) };
  }
  const lo = 130, hi = 150, mid = 140;
  const distToBand = (x) => (x < lo ? lo - x : x > hi ? x - hi : 0);
  const club = profile.clubs.filter((c) => c.approach)
    .map((c) => ({ c, l3: leave - c.median }))
    .sort((a, b) =>
      distToBand(a.l3) - distToBand(b.l3) ||
      Math.abs(a.l3 - mid) - Math.abs(b.l3 - mid) ||
      troubleTax(a.c, f, profile) - troubleTax(b.c, f, profile))[0];
  return { mode: "layup", club: club.c, leave3: club.l3, score: parScore(club.l3, profile) };
}

/** Value of one tee club on a par 4 / par 5. Returns the row used for alternatives. */
function teeOption(club, hole, flags, profile) {
  const f = normFlags(flags);
  const leave = hole.yards - club.median;
  const tax = troubleTax(club, f, profile);
  const row = { club: club.id, leave, tax, rawScore: parScore(leave, profile) };
  if (hole.par >= 5) {
    const s = secondShot(leave, f, profile);
    row.second = s;
    row.scoreLeave = s.leave3;
    row.rawScore = s.score;
    row.value = s.score - taxToPar(tax + troubleTax(s.club, f, profile), profile);
  } else {
    row.scoreLeave = leave;
    row.value = row.rawScore - taxToPar(tax, profile);
  }
  if (club.teeBanReason) row.teeBanReason = club.teeBanReason;
  return row;
}

/** Leave-zone why note (§2.3 note 1). */
function leaveZoneNote(leave, profile) {
  const z = zoneFor(Math.max(leave, profile.zones[0].from), profile);
  if (!z) return null;
  return withSample(`${zoneLabel(z)} is your ${gradeWord[z.grade]} number: ${pct(z.gir)} GIR, ~${ft(z.proxFt)} ft.`, z);
}

/** Rejected-driver why note (§2.3 note 2). */
function rejectedDriverNote(drRow, profile) {
  const dr = clubById(profile, "Dr");
  const z = zoneFor(Math.max(drRow.scoreLeave, profile.zones[0].from), profile);
  const trouble = (dr.penaltyPct ?? 0) + (dr.recoveryPct ?? 0);
  const oneIn = trouble > 0 ? Math.round(1 / trouble) : null;
  const rate = oneIn ? ` — and 1 in ${oneIn} drives finds trouble` : "";
  return `Driver leaves ${drRow.leave} — ${z ? z.grade : "amber"} zone${rate}.`;
}

/** Corridor why note (§2.3 note 3). */
function corridorNote(profile) {
  const w = profile.tendencies.driver.corridor90 ?? clubById(profile, "Dr").corridor90;
  return `Your driver corridor is ${w} yds. Need 50 clear each side.`;
}

/**
 * Tee decision for par 4 / par 5. Par 3 tee shots route to approachAdvice.
 * input: { par, yards, flags?, forceClub?, ghost? }
 */
export function teeAdvice(input, profile) {
  const f = normFlags(input.flags);
  const hole = { par: input.par, yards: input.yards };
  if (hole.par <= 3) {
    return { ...approachAdvice({ distance: hole.yards, lie: "tee", flags: f }, profile), phase: "tee" };
  }
  const candidates = profile.clubs.filter((c) => c.tee === true || c.teeBanReason);
  const rows = candidates.map((c) => teeOption(c, hole, f, profile));
  const legal = rows.filter((r) => clubById(profile, r.club).tee === true);
  legal.sort((a, b) => b.value - a.value || clubById(profile, a.club).width80 - clubById(profile, b.club).width80);
  const best = legal[0];

  // Manual tap on an alternative chip (including the tee-banned 4Hy).
  const shown = input.forceClub ? rows.find((r) => r.club === input.forceClub) || best : best;
  const shownClub = clubById(profile, shown.club);

  const drRow = rows.find((r) => r.club === "Dr");
  const driverPicked = shown.club === "Dr";
  // Driver "rejected on tax": it would have won on raw par score but lost once trouble was priced in.
  const bestRaw = legal.slice().sort((a, b) => b.rawScore - a.rawScore)[0];
  const driverRejectedOnTax = !driverPicked && drRow && bestRaw && bestRaw.club === "Dr";

  const why = [];
  if (shownClub.teeBanReason) why.push(`${shownClub.name} off the tee: ${shownClub.teeBanReason}.`);
  const zn = leaveZoneNote(shown.scoreLeave, profile);
  if (zn) why.push(zn);
  // One driver note. The corridor note is the reason when `tight` is set or when the tax alone
  // rejected the driver; otherwise the rejected-driver note explains where it would have left him.
  if (f.tight || driverRejectedOnTax) why.push(corridorNote(profile));
  else if (!driverPicked && drRow) why.push(rejectedDriverNote(drRow, profile));

  const zone = zoneFor(Math.max(shown.scoreLeave, profile.zones[0].from), profile);
  const advice = {
    phase: "tee",
    club: shown.club,
    swing: "stock",
    target: f.waterR ? "left-center" : f.waterL ? "right-center" : "center",
    leave: shown.leave,
    zoneGrade: zone ? zone.grade : undefined,
    why: why.slice(0, 2),
    alternatives: rows
      .slice()
      .sort((a, b) => b.value - a.value)
      .map((r) => {
        const alt = { club: r.club, leave: r.leave, value: round3(r.value) };
        if (r.teeBanReason) alt.teeBanReason = r.teeBanReason;
        return alt;
      }),
  };
  if (hole.par >= 5 && shown.second) {
    advice.plan = shown.second.mode;
    advice.secondClub = shown.second.club.id;
    advice.leave3 = shown.second.leave3;
  }
  return advice;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

/* ---------- §2.4 approach decision ---------- */

/** Stock club: smallest approach median >= distance; longest approach club beyond that. */
export function stockClub(distance, profile) {
  const clubs = profile.clubs.filter((c) => c.approach).sort(byMedian);
  return clubs.find((c) => c.median >= distance) || clubs[clubs.length - 1];
}

/** `n` clubs longer than `club` in the approach set, clamped at the longest. */
export function clubUp(club, n, profile) {
  const clubs = profile.clubs.filter((c) => c.approach).sort(byMedian);
  const i = clubs.findIndex((c) => c.id === club.id);
  return clubs[Math.min(i + n, clubs.length - 1)];
}

/**
 * Approach decision. input: { distance, lie: 'tee'|'fairway'|'rough', flags?, ghost? }
 * Distance is what he plays; wet changes the club and target, not the number.
 */
export function approachAdvice(input, profile) {
  const f = normFlags(input.flags);
  const distance = input.distance;
  const stock = stockClub(distance, profile);
  const shortMiss = (stock.shortPct ?? 0) >= 0.2;
  let club = stock;
  let swing = shortMiss ? "easy" : "stock";
  let target = shortMiss ? "back-center" : "center";
  if (f.wet) {
    club = clubUp(stock, profile.wet.clubUp, profile);
    target = "carry the number";
  }
  const z = zoneFor(distance, profile);

  const why = [];
  if (z) {
    const label = zoneLabel(z);
    const text =
      z.grade === "green" ? `${label} is your best number — go at it. ${pct(z.gir)} GIR, ~${ft(z.proxFt)} ft.` :
      z.grade === "red" ? `${label} is a damage-control number (${pct(z.gir)} GIR). Center of the green, take the 30-footer.` :
      // amber: the target clause yields to the short-miss note when that note owns the target
      `${label}: neutral. ${shortMiss && !f.wet ? "" : "Stock shot, center. "}${pct(z.gir)} GIR, ~${ft(z.proxFt)} ft.`;
    why.push(withSample(text, z));
  }
  if (f.wet) {
    why.push(`Wet: no roll-out. ${club.name} is ${profile.wet.clubUp} clubs up from your stock ${stock.name} so ${distance} carries.`);
  }
  if ((club.shortPct ?? 0) >= 0.2) {
    why.push(`${club.name} comes up short ${pct(club.shortPct)}. Long almost never. Back-center.`);
  }
  if (input.lie === "rough") {
    why.push(`From the rough you're fine — ${profile.tendencies.approach.roughIsFine}. Don't over-protect.`);
  }

  const clubs = profile.clubs.filter((c) => c.approach).sort(byMedian);
  const i = clubs.findIndex((c) => c.id === club.id);
  return {
    phase: "approach",
    club: club.id,
    swing,
    target,
    distance,
    zoneGrade: z ? z.grade : undefined,
    why: why.slice(0, 2),
    alternatives: clubs.slice(Math.max(0, i - 1), i + 2).map((c) => ({ club: c.id, median: c.median, delta: c.median - distance })),
  };
}

/* ---------- §2.5 short game (< 50 yds) ---------- */

export function shortAdvice(input, profile) {
  const d = input.distance;
  const sg = profile.tendencies.shortGame;
  const why = [];
  if (d >= 25) {
    const prox = d >= 38 ? sg.proxRough["38-50"] : sg.proxRough["26-37"];
    why.push(`Land it pin-high or past — you're short ${pct(sg.pitchShortPct)} inside 25. From here your median is ${ft(prox)} ft; the up-and-down is the putt.`);
  } else {
    why.push(`Trust the chip — ${Math.floor(sg.proxRough["0-12"])}–${ft(sg.proxRough["13-25"])} ft median. The stroke is on the green.`);
  }
  return { phase: "short", distance: d, why };
}

/* ---------- §2.6 putting (first-putt distance in feet) ---------- */

export function puttAdvice(input, profile) {
  const d = input.distance;
  const p = profile.tendencies.putting;
  const why = [];
  if (d < 10) {
    why.push(`Trust the line. Misses run ${p.runsPastFt} ft past — speed is good.`);
  } else if (d < 25) {
    why.push(`Start it a ball-width left of your read — ${pct(p.missRightPct10Plus)} of your misses out here are right.`);
  } else {
    why.push(`Two-putt. Finish inside 3 ft, not 6 — your 4–6 footer is ${pct(p.make["4-6"])}.`);
  }
  return { phase: "putt", distance: d, why };
}

/* ---------- §2.7 ghost status + §2.8 dispatcher ---------- */

/**
 * advise(input, profile) → Advice
 * input: { phase: 'tee'|'approach'|'short'|'putt', par?, yards?, distance?, lie?, flags?, forceClub?, ghost? }
 * `ghost` becomes `ghostLine` and nothing else. It is never read by a decision.
 */
export function advise(input, profile) {
  let advice;
  switch (input.phase) {
    case "tee": advice = teeAdvice(input, profile); break;
    case "approach": advice = approachAdvice(input, profile); break;
    case "short": advice = shortAdvice(input, profile); break;
    case "putt": advice = puttAdvice(input, profile); break;
    default: throw new Error(`caddie: unknown phase ${input.phase}`);
  }
  if (input.ghost !== undefined && input.ghost !== null) advice.ghostLine = `Ghost: ${input.ghost}`;
  return advice;
}
