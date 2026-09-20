/*
 * geometry.test.js — geo helpers, Overpass parsing (synthetic + real Hampton fixture), auto phase.
 * Run:  npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  haversineM, toYards, yardsBetween, bearingDeg, destination, centroid, pointInRing, OVERPASS_URLS,
  greenDistances, overpassQuery, parseOverpass, fetchGeometry, autoPhase, compactGeometry,
  ellipsePolygon, dispersion, troubleNearHole, lonLatToTile, geometryBbox, tilesForBbox,
} from "./geometry.js";

const here = dirname(fileURLToPath(import.meta.url));
const hampton = JSON.parse(readFileSync(join(here, "fixtures", "hampton-overpass.json"), "utf8"));
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

/* ---------- distance / bearing ---------- */

test("haversine: 100 m north at Hampton's latitude is 100 m and ~109.4 yds; bearing north is 0", () => {
  const a = { lat: 34.3017, lon: -84.06 };
  const b = destination(a, 0, 100);
  near(haversineM(a, b), 100, 0.01);
  near(yardsBetween(a, b), 109.36, 0.05);
  near(bearingDeg(a, b), 0, 0.01);
  const e = destination(a, 90, 250);
  near(bearingDeg(a, e), 90, 0.05);
  near(toYards(1), 1.0936, 0.001);
});

test("destination then haversine round-trips at course scale on every bearing", () => {
  const a = { lat: 34.3, lon: -84.06 };
  for (const br of [0, 45, 137, 200, 271, 359]) {
    const p = destination(a, br, 300);
    near(haversineM(a, p), 300, 0.01);
    near(bearingDeg(a, p), br, 0.05);
  }
});

/* ---------- polygons ---------- */

const square = (c, halfM) => [destination(destination(c, 0, halfM), 270, halfM), destination(destination(c, 0, halfM), 90, halfM), destination(destination(c, 180, halfM), 90, halfM), destination(destination(c, 180, halfM), 270, halfM)];

test("centroid and pointInRing on a 30 m square green", () => {
  const c = { lat: 34.3, lon: -84.06 };
  const ring = square(c, 15);
  const cen = centroid(ring);
  near(haversineM(cen, c), 0, 0.05);
  assert.equal(pointInRing(c, ring), true);
  assert.equal(pointInRing(destination(c, 0, 14), ring), true);
  assert.equal(pointInRing(destination(c, 0, 16), ring), false);
  assert.equal(pointInRing(destination(c, 45, 100), ring), false);
});

test("greenDistances: front/back are where the ray enters and exits the ring; no ring → centre ∓ 12", () => {
  const c = { lat: 34.3, lon: -84.06 };
  const ring = square(c, 15);                       // 30 m deep → 32.8 yds
  const player = destination(c, 180, 150);          // 150 m due south
  const d = greenDistances(player, { center: c, ring });
  near(d.middle, toYards(150), 0.05);
  near(d.front, toYards(135), 0.1);
  near(d.back, toYards(165), 0.1);
  assert.equal(d.inside, false);
  assert.equal(d.hasRing, true);
  const on = greenDistances(destination(c, 90, 5), { center: c, ring });
  assert.equal(on.inside, true);
  const noRing = greenDistances(player, { center: c, ring: null });
  near(noRing.front, noRing.middle - 12, 1e-9);
  near(noRing.back, noRing.middle + 12, 1e-9);
  assert.equal(noRing.hasRing, false);
});

/* ---------- Overpass ---------- */

test("overpassQuery: bbox is anchor ± 0.015 lat / ± 0.02 lon, spec §4.1 selectors present", () => {
  const q = overpassQuery(34.301726, -84.060013);
  assert.match(q, /\(34\.286726,-84\.080013,34\.316726,-84\.040013\)/);
  assert.match(q, /golf"~"\^\(hole\|green\|bunker\|fairway\|tee\|water_hazard\|lateral_water_hazard\|out_of_bounds\)\$"/);
  assert.match(q, /natural"="water"/);
  assert.match(q, /out geom;$/);
});

test("parseOverpass (synthetic): assigns a green by containment, then by ≤40 m, warns on orphans", () => {
  const c1 = { lat: 34.3, lon: -84.06 }, c2 = destination(c1, 90, 400), orphan = destination(c1, 0, 900);
  const tee1 = destination(c1, 180, 380), tee2 = destination(c2, 180, 160);
  const way = (id, tags, pts) => ({ type: "way", id, tags, geometry: pts.map((p) => ({ lat: p.lat, lon: p.lon })) });
  const closed = (ring) => [...ring, ring[0]];
  const json = { elements: [
    way(1, { golf: "hole", ref: "1", par: "4" }, [tee1, c1]),                       // ends inside green 1
    way(2, { golf: "hole", ref: "2" }, [tee2, destination(c2, 0, 25)]),           // ends 25 m past green 2's centre → nearest ≤ 40
    way(3, { golf: "hole", ref: "3" }, [tee2, destination(c2, 0, 300)]),          // nothing near → warning, green null
    way(11, { golf: "green" }, closed(square(c1, 15))),
    way(12, { golf: "green" }, closed(square(c2, 12))),
    way(13, { golf: "green" }, closed(square(orphan, 10))),
    way(21, { golf: "bunker" }, closed(square(destination(c1, 200, 40), 5))),
    way(22, { natural: "water" }, closed(square(destination(c1, 120, 80), 20))),
    way(23, { golf: "tee" }, closed(square(tee1, 6))),                            // ignored
    way(99, { golf: "hole" }, [tee1, c1]),                                        // no ref → warning
  ] };
  const g = parseOverpass(json);
  assert.deepEqual(Object.keys(g.holes).map(Number).sort(), [1, 2, 3]);
  assert.ok(g.holes[1].green && pointInRing(c1, g.holes[1].green.ring));
  assert.ok(g.holes[2].green);
  near(haversineM(g.holes[2].green.center, c2), 0, 0.5);
  assert.equal(g.holes[3].green, null);
  assert.equal(g.holes[1].green.ring.length, 4, "closing node dropped");
  assert.equal(g.greens.length, 3);
  assert.deepEqual(g.trouble.map((t) => t.kind).sort(), ["bunker", "water"]);
  assert.ok(g.warnings.some((w) => /green 13 matched no hole/.test(w)));
  assert.ok(g.warnings.some((w) => /hole 3: no green within 40 m/.test(w)));
  assert.ok(g.warnings.some((w) => /hole way 99 has no numeric ref/.test(w)));
});

test("parseOverpass (Hampton Golf Village, real OSM data): 18/18 holes get a green; 2 practice greens orphaned", () => {
  const g = parseOverpass(hampton);
  assert.equal(Object.keys(g.holes).length, 18);
  for (let ref = 1; ref <= 18; ref++) {
    const h = g.holes[ref];
    assert.ok(h, `hole ${ref} parsed`);
    assert.ok(h.line.length >= 2, `hole ${ref} centreline`);
    assert.ok(h.green && h.green.ring.length >= 3, `hole ${ref} has a green polygon`);
    const yds = yardsBetween(h.teeEnd, h.green.center);
    assert.ok(yds > 80 && yds < 650, `hole ${ref} tee→green ${Math.round(yds)} yds is plausible`);
  }
  assert.equal(g.greens.length, 20);
  assert.equal(g.greens.filter((x) => x.holeRefs.length === 0).length, 2);
  assert.equal(g.warnings.filter((w) => /matched no hole/.test(w)).length, 2);
  assert.equal(g.warnings.filter((w) => /^hole /.test(w)).length, 0, "every hole matched");
  assert.equal(g.trouble.length, 68);                                           // 41 bunkers + 27 water
  // doglegs from the handoff carry more than two nodes
  for (const ref of [3, 4, 7, 10, 16]) assert.ok(g.holes[ref].line.length >= 3, `hole ${ref} is a dogleg`);
  // hole 1 from the tee: front < middle < back, and the green is 25–40 yds deep
  const d = greenDistances(g.holes[1].teeEnd, g.holes[1].green);
  assert.ok(d.front < d.middle && d.middle < d.back);
  assert.ok(d.back - d.front > 20 && d.back - d.front < 45, `green depth ${d.back - d.front}`);
  assert.equal(greenDistances(g.holes[1].green.center, g.holes[1].green).inside, true);
});

test("compactGeometry drops OSM ids and keeps what the app needs; survives JSON round-trip", () => {
  const g = compactGeometry(parseOverpass(hampton));
  const back = JSON.parse(JSON.stringify(g));
  assert.equal(Object.keys(back.holes).length, 18);
  assert.equal(back.holes[1].osmId, undefined);
  assert.ok(back.holes[1].green.center.lat);
  assert.equal(back.trouble.length, 68);
  assert.equal(back.trouble[0].osmId, undefined);
});

test("fetchGeometry posts the query as form data and parses the reply (fetch injected)", async () => {
  let seen = null;
  const fakeFetch = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => hampton }; };
  const g = await fetchGeometry(34.301726, -84.060013, fakeFetch);
  assert.equal(seen.url, OVERPASS_URLS[0]);
  assert.equal(seen.opts.method, "POST");
  assert.match(seen.opts.body, /^data=%5Bout%3Ajson%5D/);
  assert.equal(Object.keys(g.holes).length, 18);
  await assert.rejects(fetchGeometry(0, 0, async () => ({ ok: false, status: 429 })), /overpass http 429/);
});

test("fetchGeometry: a 429 (or a network error) on the first endpoint falls through to the next", async () => {
  const calls = [];
  const flaky = async (url) => { calls.push(url); return calls.length === 1 ? { ok: false, status: 429 } : { ok: true, json: async () => hampton }; };
  const g = await fetchGeometry(34.3, -84.06, flaky);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "https://lz4.overpass-api.de/api/interpreter");
  assert.equal(calls[1], "https://overpass-api.de/api/interpreter");
  assert.equal(Object.keys(g.holes).length, 18);
  const dead = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(fetchGeometry(34.3, -84.06, dead), /Failed to fetch/);
  const c2 = [];
  const netThenOk = async (url) => { c2.push(url); if (c2.length === 1) throw new TypeError("Failed to fetch"); return { ok: true, json: async () => hampton }; };
  assert.equal(Object.keys((await fetchGeometry(34.3, -84.06, netThenOk)).holes).length, 18);
});

/* ---------- dispersion ellipse + tiles ---------- */

test("ellipsePolygon: 48 points, centred median yards along the bearing, depth along / width across", () => {
  const player = { lat: 34.3, lon: -84.06 };
  const e = ellipsePolygon(player, 90, 257, 112, 57);
  assert.equal(e.ring.length, 48);
  near(yardsBetween(player, e.center), 257, 0.05);
  near(bearingDeg(player, e.center), 90, 0.05);
  // point 0 is the far tip (along), point 12 is the side (across)
  near(yardsBetween(e.center, e.ring[0]), 56, 0.1);
  near(bearingDeg(e.center, e.ring[0]), 90, 0.1);
  near(yardsBetween(e.center, e.ring[12]), 28.5, 0.1);
  near(yardsBetween(e.center, e.ring[24]), 56, 0.1);
  for (const p of e.ring) assert.ok(pointInRing(p, ellipsePolygon(player, 90, 257, 114, 59).ring), "inside a slightly larger ellipse");
});

test("dispersion: rim samples flag trouble and troublePct counts them; troubleNearHole filters by distance", () => {
  const player = { lat: 34.3, lon: -84.06 };
  const club = { median: 257, depth80: 112, width80: 57 };
  const landing = destination(player, 0, 257 / 1.0936133);
  const rightSide = destination(landing, 90, 25);                        // 25 m right of centre → straddles the rim
  const water = { kind: "water", ring: square(rightSide, 30), center: rightSide };
  const far = { kind: "bunker", ring: square(destination(player, 90, 2000), 10), center: destination(player, 90, 2000) };
  const d = dispersion(player, 0, club, [water, far]);
  assert.equal(d.samples.length, 48);
  assert.ok(d.troublePct > 0.1 && d.troublePct < 0.6, `troublePct ${d.troublePct}`);
  assert.ok(d.samples.some((s) => s.trouble === "water"));
  assert.ok(!d.samples.some((s) => s.trouble === "bunker"));
  assert.equal(dispersion(player, 0, club, []).troublePct, 0);
  const hole = { line: [player, landing], green: { center: destination(player, 0, 380), ring: null } };
  assert.deepEqual(troubleNearHole([water, far], hole).map((t) => t.kind), ["water"]);
  // a club without depth80/width80 (SW, LW) still gets an ellipse from its quartiles
  const sw = dispersion(player, 0, { median: 95, p25: 88, p75: 100 }, []);
  assert.ok(sw.depth > 0 && sw.width > 0 && sw.ring.length === 48);
});

test("tile math: lonLatToTile matches the MapTiler tiles fetched by hand; tilesForBbox covers Hampton compactly", () => {
  assert.deepEqual(lonLatToTile(-84.0585, 34.3025, 17), { x: 34931, y: 52226, z: 17 });
  assert.deepEqual(lonLatToTile(-84.0585, 34.3025, 18), { x: 69862, y: 104452, z: 18 });
  assert.deepEqual(lonLatToTile(-84.0585, 34.3025, 19), { x: 139724, y: 208904, z: 19 });
  const geo = compactGeometry(parseOverpass(hampton));
  const bbox = geometryBbox(geo);
  assert.ok(bbox.minLat < 34.3 && bbox.maxLat > 34.3 && bbox.minLon < -84.05 && bbox.maxLon > -84.07);
  const tiles = tilesForBbox(bbox, [16, 17, 18]);
  const byZ = (z) => tiles.filter((t) => t.z === z).length;
  assert.ok(byZ(16) >= 2 && byZ(16) <= 24, `z16 ${byZ(16)}`);
  assert.ok(byZ(18) >= 60 && byZ(18) <= 300, `z18 ${byZ(18)}`);
  assert.ok(tiles.length < 400, `total ${tiles.length} tiles (~9 MB) is a sane wifi pre-fetch`);
  assert.equal(geometryBbox({ holes: {} }), null);
});

/* ---------- auto phase ---------- */

test("autoPhase: spec §4.3 bands, putt when inside the green regardless of distance", () => {
  assert.equal(autoPhase(390, 395, false), "tee");
  assert.equal(autoPhase(356, 395, false), "tee");    // > 355
  assert.equal(autoPhase(355, 395, false), "approach");
  assert.equal(autoPhase(140, 395, false), "approach");
  assert.equal(autoPhase(51, 395, false), "approach");
  assert.equal(autoPhase(50, 395, false), "short");
  assert.equal(autoPhase(12, 395, false), "short");
  assert.equal(autoPhase(12, 395, true), "putt");
  assert.equal(autoPhase(200, null, false), "approach", "no scorecard yardage → never tee by distance");
  assert.equal(autoPhase(null, 395, false), null);
});
