/*
 * caddie.test.js — spec §8 acceptance tests plus the HANDOFF §3.3 fixes.
 * Run:  node --test src/      (or `npm test`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  advise, teeAdvice, approachAdvice, secondShot,
  zoneFor, zoneLabel, parScore, troubleTax, interp, confidence, stockClub, clubUp,
} from "./caddie.js";

const here = dirname(fileURLToPath(import.meta.url));
const profile = JSON.parse(readFileSync(join(here, "profile.json"), "utf8"));

const has = (lines, re) => lines.some((l) => re.test(l));
const stripGhost = ({ ghostLine, ...rest }) => rest;

/* ---------- profile sanity ---------- */

test("profile: tee-legal clubs are Dr, 2i, 2Hy; 4Hy carries teeBanReason; scale constant present", () => {
  const legal = profile.clubs.filter((c) => c.tee === true).map((c) => c.id).sort();
  assert.deepEqual(legal, ["2Hy", "2i", "Dr"]);
  const h4 = profile.clubs.find((c) => c.id === "4Hy");
  assert.equal(h4.tee, false);
  assert.ok(h4.teeBanReason);
  assert.equal(profile.constants.strokeToParScale, 0.5);
});

/* ---------- §2.1 helpers ---------- */

test("interp: clamps at the ends and is linear between bench points", () => {
  assert.equal(interp(profile.benchGir, 10), 0.836);
  assert.equal(interp(profile.benchGir, 300), 0.256);
  assert.ok(Math.abs(interp(profile.benchGir, 110) - 0.745) < 1e-9);
});

test("confidence bands: n<8 low, 8–15 med, >15 high", () => {
  assert.equal(confidence(6), "low");
  assert.equal(confidence(8), "med");
  assert.equal(confidence(15), "med");
  assert.equal(confidence(16), "high");
});

test("zones are half-open (from <= d < to): every seam lands in the upper zone", () => {
  for (const seam of [75, 100, 130, 150, 180, 190, 225]) {
    assert.equal(zoneFor(seam, profile).from, seam, `seam ${seam}`);
    assert.equal(zoneFor(seam - 0.5, profile).to, seam, `just under ${seam}`);
  }
  assert.equal(zoneFor(49, profile), null);
  assert.equal(zoneLabel(zoneFor(300, profile)), "225+");
  assert.equal(zoneLabel(zoneFor(140, profile)), "130–150");
});

test("parScore: in [0,1], green 130–150 beats red 100–130 and red 150–180", () => {
  const g = parScore(140, profile), r1 = parScore(107, profile), r2 = parScore(170, profile);
  for (const s of [g, r1, r2]) assert.ok(s > 0 && s < 1);
  assert.ok(g > r1 && g > r2);
  // shrinkage: with n=11 and shrinkK=10 the score sits between observed and prior
  const z = zoneFor(140, profile);
  const observed = z.gir * 0.82 + (1 - z.gir) * 0.4;
  assert.ok(g < observed && g > 0.6);
});

test("troubleTax: base cost, tight only bites clubs wider than 60, water only bites big-miss side", () => {
  const dr = profile.clubs.find((c) => c.id === "Dr");
  const hy = profile.clubs.find((c) => c.id === "2Hy");
  const base = dr.penaltyPct * 1.1 + dr.recoveryPct * 0.8;
  assert.ok(Math.abs(troubleTax(dr, {}, profile) - base) < 1e-9);
  assert.ok(Math.abs(troubleTax(dr, { tight: true }, profile) - (base + 0.15)) < 1e-9);
  assert.ok(Math.abs(troubleTax(dr, { waterR: true }, profile) - (base + 0.1)) < 1e-9);
  assert.ok(Math.abs(troubleTax(dr, { waterL: true }, profile) - base) < 1e-9); // bigMissL 0.11 ≤ 0.15
  assert.equal(troubleTax(hy, { tight: true, waterR: true }, profile), 0);   // width 57, no bigMiss
});

/* ---------- §8 acceptance ---------- */

test("#1 par 4, 395, no flags → 2Hy/2i leaving 130–150; why cites best number then the rejected driver", () => {
  const a = advise({ phase: "tee", par: 4, yards: 395 }, profile);
  assert.ok(["2Hy", "2i"].includes(a.club), a.club);
  assert.ok(a.leave >= 130 && a.leave < 150, `leave ${a.leave}`);
  assert.equal(a.zoneGrade, "green");
  assert.match(a.why[0], /130–150 is your best number/);
  assert.match(a.why[1], /^Driver leaves 107 — red zone — and 1 in 4 drives finds trouble\.$/);
  assert.equal(a.why.length, 2);
});

test("#2 par 4, 430, no flags → Driver leaving 130–150; why cites best number", () => {
  const a = advise({ phase: "tee", par: 4, yards: 430 }, profile);
  assert.equal(a.club, "Dr");
  assert.ok(a.leave >= 130 && a.leave < 150, `leave ${a.leave}`);
  assert.match(a.why[0], /best number/);
  assert.ok(!has(a.why, /Driver leaves/), "no rejected-driver note when driver is the pick");
});

test("#3 par 4, 395, tight → driver not recommended; a why line names the 108-yd corridor", () => {
  const a = advise({ phase: "tee", par: 4, yards: 395, flags: { tight: true } }, profile);
  assert.notEqual(a.club, "Dr");
  assert.ok(has(a.why, /corridor is 108 yds/), a.why.join(" | "));
  assert.ok(a.why.length <= 2);
});

test("#4 any tee input → 4Hy never the club; listed in alternatives with teeBanReason", () => {
  for (const yards of [340, 380, 395, 430, 470, 520, 560]) {
    for (const par of [4, 5]) {
      const a = advise({ phase: "tee", par, yards, flags: { tight: true, waterR: true } }, profile);
      assert.notEqual(a.club, "4Hy", `par ${par} ${yards}`);
      const h4 = a.alternatives.find((x) => x.club === "4Hy");
      assert.ok(h4, "4Hy present in alternatives");
      assert.equal(h4.teeBanReason, "36% trouble off the tee, −0.32 SG/shot");
      assert.equal(typeof h4.leave, "number");
      assert.equal(typeof h4.value, "number");
    }
  }
});

test("#4b tapping 4Hy manually shows its card with the tee-ban note first", () => {
  const a = advise({ phase: "tee", par: 4, yards: 395, forceClub: "4Hy" }, profile);
  assert.equal(a.club, "4Hy");
  assert.equal(a.why[0], "4-hybrid off the tee: 36% trouble off the tee, −0.32 SG/shot.");
});

test("#5 approach 140, fairway → 9i, stock swing, center, green zone (HANDOFF §3.3.2 relaxation)", () => {
  const a = advise({ phase: "approach", distance: 140, lie: "fairway" }, profile);
  assert.equal(a.club, "9i");
  assert.equal(a.swing, "stock");
  assert.ok(["center", "back-center"].includes(a.target));
  assert.equal(a.zoneGrade, "green");
  assert.match(a.why[0], /130–150 is your best number — go at it\. 73% GIR, ~26 ft\./);
});

test("#5b short-miss rule: a stock club with shortPct ≥ 0.20 gets easy / back-center", () => {
  const a = advise({ phase: "approach", distance: 130, lie: "fairway" }, profile); // PW, shortPct 0.33
  assert.equal(a.club, "PW");
  assert.equal(a.swing, "easy");
  assert.equal(a.target, "back-center");
  assert.ok(has(a.why, /PW comes up short 33%\. Long almost never\. Back-center\./));
});

test("#6 approach 108, fairway → GW, red zone, damage-control + center of the green", () => {
  const a = advise({ phase: "approach", distance: 108, lie: "fairway" }, profile);
  assert.equal(a.club, "GW");
  assert.equal(a.zoneGrade, "red");
  assert.match(a.why[0], /100–130 is a damage-control number \(36% GIR\)\. Center of the green/);
});

test("#7 approach 165, rough → 8i, red zone, rough note present", () => {
  const a = advise({ phase: "approach", distance: 165, lie: "rough" }, profile);
  assert.equal(a.club, "8i");
  assert.equal(a.zoneGrade, "red");
  assert.ok(has(a.why, /From the rough you're fine — PW 83%, 9i 75% GIR from rough\. Don't over-protect\./));
});

test("#8 approach 140, wet → two clubs longer than 9i (7i), target carries the number", () => {
  const a = advise({ phase: "approach", distance: 140, lie: "fairway", flags: { wet: true } }, profile);
  assert.equal(a.club, "7i");
  assert.match(a.target, /carry/);
  assert.ok(has(a.why, /Wet: no roll-out\. 7-iron is 2 clubs up from your stock 9-iron so 140 carries\./));
});

test("#9 putt 18 ft → ball-width left and 62%", () => {
  const a = advise({ phase: "putt", distance: 18 }, profile);
  assert.match(a.why[0], /ball-width left/);
  assert.match(a.why[0], /62%/);
});

test("#9b putting bands: <10 cites 1–3 ft past; 25+ cites the 42% 4–6 footer", () => {
  assert.match(advise({ phase: "putt", distance: 6 }, profile).why[0], /run 1–3 ft past/);
  assert.match(advise({ phase: "putt", distance: 30 }, profile).why[0], /4–6 footer is 42%/);
  assert.match(advise({ phase: "putt", distance: 10 }, profile).why[0], /ball-width left/);
  assert.match(advise({ phase: "putt", distance: 25 }, profile).why[0], /Two-putt/);
});

test("#10 the ghost is a status line, never an input", () => {
  const base = { phase: "tee", par: 4, yards: 395 };
  const g4 = advise({ ...base, ghost: 4 }, profile);
  const g6 = advise({ ...base, ghost: 6 }, profile);
  const none = advise(base, profile);
  assert.equal(g4.ghostLine, "Ghost: 4");
  assert.equal(g6.ghostLine, "Ghost: 6");
  assert.equal(none.ghostLine, undefined);
  assert.deepEqual(stripGhost(g4), stripGhost(g6));
  assert.deepEqual(stripGhost(g4), none);
  // and on every other phase
  for (const input of [
    { phase: "approach", distance: 108, lie: "fairway" },
    { phase: "short", distance: 30 },
    { phase: "putt", distance: 18 },
  ]) {
    assert.deepEqual(stripGhost(advise({ ...input, ghost: 3 }, profile)), stripGhost(advise({ ...input, ghost: 7 }, profile)));
  }
});

test("#11 zone with n = 6 (180–190) → why line ends with (small sample)", () => {
  const a = advise({ phase: "approach", distance: 185, lie: "fairway" }, profile);
  assert.equal(a.zoneGrade, "green");
  assert.match(a.why[0], /\(small sample\)$/);
  // and a tee leave into that zone gets the same marker
  const t = advise({ phase: "tee", par: 4, yards: 445 }, profile); // 2Hy leaves 188
  const zoneLine = t.why.find((l) => /180–190/.test(l));
  if (zoneLine) assert.match(zoneLine, /\(small sample\)$/);
  // a well-sampled zone does not
  const ok = advise({ phase: "approach", distance: 140, lie: "fairway" }, profile);
  assert.doesNotMatch(ok.why[0], /small sample/);
});

/* ---------- short game, par 3, par 5 ---------- */

test("short game: 25–50 cites 27% short and the rough-proximity median; 0–25 cites the chip median", () => {
  const far = advise({ phase: "short", distance: 30 }, profile);
  assert.match(far.why[0], /short 27% inside 25\. From here your median is 14 ft/);
  const farther = advise({ phase: "short", distance: 45 }, profile);
  assert.match(farther.why[0], /median is 21 ft/);
  const near = advise({ phase: "short", distance: 12 }, profile);
  assert.match(near.why[0], /Trust the chip — 5–7 ft median/);
});

test("par 3 tee shot routes through the approach engine but keeps phase tee", () => {
  const a = advise({ phase: "tee", par: 3, yards: 165 }, profile);
  assert.equal(a.phase, "tee");
  assert.equal(a.club, "8i");
  assert.equal(a.zoneGrade, "red");
});

test("par 5: secondClub is the approach club that best leaves 130–150; long holes lay up", () => {
  const s = secondShot(283, {}, profile); // e.g. 2Hy off a 540
  assert.equal(s.mode, "layup");
  assert.ok(s.leave3 >= 130 && s.leave3 <= 150, `leave3 ${s.leave3}`);
  const a = advise({ phase: "tee", par: 5, yards: 560 }, profile);
  assert.ok(["Dr", "2i", "2Hy"].includes(a.club));
  assert.equal(a.plan, "layup");
  assert.ok(a.leave3 >= 130 && a.leave3 <= 150, `leave3 ${a.leave3}`);
  assert.equal(a.zoneGrade, "green");
  assert.match(a.why[0], /130–150 is your best number/);
});

test("par 5: a leave ≤ 265 with no flags is treated as reachable; any flag forces the layup", () => {
  assert.equal(secondShot(250, {}, profile).mode, "reach");
  assert.equal(secondShot(250, { wet: true }, profile).mode, "layup");
  assert.equal(secondShot(266, {}, profile).mode, "layup");
});

/* ---------- alternatives + misc ---------- */

test("tee alternatives cover all four tee-candidate clubs sorted by value; approach alternatives bracket the pick", () => {
  const t = advise({ phase: "tee", par: 4, yards: 395 }, profile);
  assert.deepEqual(t.alternatives.map((x) => x.club).sort(), ["2Hy", "2i", "4Hy", "Dr"]);
  for (let i = 1; i < t.alternatives.length; i++) assert.ok(t.alternatives[i - 1].value >= t.alternatives[i].value);
  assert.equal(t.alternatives[0].club, t.club);
  const a = advise({ phase: "approach", distance: 140, lie: "fairway" }, profile);
  assert.deepEqual(a.alternatives.map((x) => x.club), ["PW", "9i", "8i"]);
});

test("stockClub / clubUp: smallest median ≥ distance, longest beyond range, clubUp clamps", () => {
  assert.equal(stockClub(140, profile).id, "9i");
  assert.equal(stockClub(136, profile).id, "PW");
  assert.equal(stockClub(300, profile).id, "2i");
  assert.equal(clubUp(stockClub(255, profile), 2, profile).id, "2i");
});

test("flags accept an array of names as well as an object", () => {
  const a = teeAdvice({ par: 4, yards: 395, flags: ["tight"] }, profile);
  const b = teeAdvice({ par: 4, yards: 395, flags: { tight: true } }, profile);
  assert.deepEqual(a, b);
  const c = approachAdvice({ distance: 140, lie: "fairway", flags: ["wet"] }, profile);
  assert.equal(c.club, "7i");
});

test("copy rules: no exclamation points anywhere in why lines", () => {
  const inputs = [
    { phase: "tee", par: 4, yards: 395 }, { phase: "tee", par: 4, yards: 430, flags: { tight: true } },
    { phase: "tee", par: 5, yards: 560 }, { phase: "tee", par: 4, yards: 395, forceClub: "4Hy" },
    { phase: "approach", distance: 108, lie: "fairway" }, { phase: "approach", distance: 165, lie: "rough" },
    { phase: "approach", distance: 140, flags: { wet: true } }, { phase: "short", distance: 30 },
    { phase: "short", distance: 10 }, { phase: "putt", distance: 6 }, { phase: "putt", distance: 18 }, { phase: "putt", distance: 40 },
  ];
  for (const i of inputs) {
    const a = advise(i, profile);
    assert.ok(a.why.length >= 1 && a.why.length <= 2, JSON.stringify(i));
    for (const w of a.why) assert.doesNotMatch(w, /!/);
  }
});
