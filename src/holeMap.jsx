/*
 * holeMap.jsx — the Hole View (v19).
 *
 * MapLibre GL (served same-origin from ./vendor so the service worker caches it) over MapTiler
 * satellite tiles (cache-first in sw.js, pre-fetched on wifi from Setup). Hole-up: bearing is
 * player → green centre, pitch 0. Layers: satellite → trouble → green outline → dispersion
 * ellipse (rim sampled red/green against trouble) → accuracy ring → player dot.
 *
 * Degrades honestly: with no tiles the geometry draws on a plain dark background; with no
 * MapLibre yet (the deferred vendor script) the container shows a placeholder.
 */
import { bearingDeg, dispersion, troubleNearHole, destination, geometryBbox, tilesForBbox } from "./geometry.js";

const React = window.React;
const { useEffect, useRef, useState } = React;

export const MAPTILER_KEY = "3frli95k3gG0NelkI7Kx";          // client-side by design; origin-locked to the Pages host in MapTiler
export const TILE_URL = `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`;
export const MAP_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>';
export const TILE_CACHE = "bogeyman-tiles-v1";                 // must match sw.js
export const PREFETCH_ZOOMS = [16, 17, 18];                    // 512-px tiles: z18 is ~0.3 m/px here, ~250 tiles / 9 MB for a course

const GREEN = "#57C77F", RED = "#FF5B52", GOLD = "#D4A94A", INK = "#FFFFFF", BG = "#0B0D10", SLATE = "#9AA7B4";

/* ---------- GeoJSON helpers ---------- */
const ll = (p) => [p.lon, p.lat];
const closeRing = (ring) => (ring.length ? [...ring.map(ll), ll(ring[0])] : []);
const fc = (features) => ({ type: "FeatureCollection", features });
const polyF = (ring, properties = {}) => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [closeRing(ring)] } });
const pointF = (p, properties = {}) => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: ll(p) } });
const lineF = (pts, properties = {}) => ({ type: "Feature", properties, geometry: { type: "LineString", coordinates: pts.map(ll) } });
const circleRing = (c, rM, n = 40) => Array.from({ length: n }, (_, i) => destination(c, (360 * i) / n, rM));
const EMPTY = fc([]);

/** window.maplibregl arrives from the deferred vendor script; poll until it is there. */
export function useMapLibre() {
  const [lib, setLib] = useState(() => (typeof window !== "undefined" && window.maplibregl) || null);
  useEffect(() => {
    if (lib) return;
    const t = setInterval(() => { if (window.maplibregl) { setLib(window.maplibregl); clearInterval(t); } }, 150);
    return () => clearInterval(t);
  }, [lib]);
  return lib;
}

/**
 * props: fix {lat,lon,acc}|null · hole {line, green}|null (compact OSM geometry) · green {center, ring}|null
 *        (the green the Caddie is using — a mark beats OSM) · trouble [] · club (profile club) | null
 *        · phase · height
 */
export function HoleMap({ fix, hole, green, trouble, club, phase, height = 300 }) {
  const lib = useMapLibre();
  const box = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const fitKey = useRef("");
  const [ready, setReady] = useState(false);

  // Where the shot starts: the live fix, else the tee end of the centreline (a preview before GPS locks).
  const origin = fix || (hole && hole.line && hole.line[0]) || null;
  const target = green && green.center;

  /* ---- create the map once the library is present ---- */
  useEffect(() => {
    if (!lib || !box.current || mapRef.current) return;
    const map = new lib.Map({
      container: box.current,
      style: {
        version: 8,
        sources: { sat: { type: "raster", tiles: [TILE_URL], tileSize: 512, maxzoom: 18, attribution: MAP_ATTRIBUTION } },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": BG } },
          { id: "sat", type: "raster", source: "sat", paint: { "raster-fade-duration": 0, "raster-brightness-max": 0.92 } },
        ],
      },
      center: [-84.06, 34.3], zoom: 16, pitch: 0, bearing: 0,
      attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0,
      fadeDuration: 0,
      // keep the last frame in the canvas (screenshots, tab switches) — the map is small, the cost is nil
      canvasContextAttributes: { preserveDrawingBuffer: true },
      preserveDrawingBuffer: true,
    });
    // Seen in testing: after the first fitBounds the canvas held no presented frame until something
    // nudged it. A repaint on every settled move and once on idle costs nothing and removes the blank.
    map.on("moveend", () => map.triggerRepaint());
    map.once("idle", () => map.triggerRepaint());
    map.touchZoomRotate.disableRotation();
    map.addControl(new lib.AttributionControl({ compact: true }), "bottom-right");
    map.on("error", (e) => console.warn("holeMap:", (e && e.error && e.error.message) || e));
    if (typeof window !== "undefined") window.__ghostMap = map;   // field-debug handle (Safari → Develop → console)
    map.on("load", () => {
      const add = (id, data) => map.addSource(id, { type: "geojson", data });
      add("trouble", EMPTY); add("green", EMPTY); add("line", EMPTY); add("ellipse", EMPTY); add("samples", EMPTY); add("acc", EMPTY); add("player", EMPTY); add("target", EMPTY);
      map.addLayer({ id: "trouble-fill", type: "fill", source: "trouble", paint: { "fill-color": ["match", ["get", "kind"], "bunker", GOLD, RED], "fill-opacity": 0.22 } });
      map.addLayer({ id: "trouble-line", type: "line", source: "trouble", paint: { "line-color": ["match", ["get", "kind"], "bunker", GOLD, RED], "line-width": 1, "line-opacity": 0.7 } });
      map.addLayer({ id: "line", type: "line", source: "line", paint: { "line-color": SLATE, "line-width": 1, "line-dasharray": [2, 3], "line-opacity": 0.6 } });
      map.addLayer({ id: "green-line", type: "line", source: "green", paint: { "line-color": GREEN, "line-width": 1.5 } });
      map.addLayer({ id: "ellipse-fill", type: "fill", source: "ellipse", paint: { "fill-color": INK, "fill-opacity": 0.08 } });
      map.addLayer({ id: "ellipse-line", type: "line", source: "ellipse", paint: { "line-color": INK, "line-width": 1, "line-opacity": 0.55 } });
      map.addLayer({ id: "samples", type: "circle", source: "samples", paint: { "circle-radius": 2.6, "circle-color": ["case", ["to-boolean", ["get", "trouble"]], RED, GREEN], "circle-opacity": 0.95 } });
      map.addLayer({ id: "target", type: "circle", source: "target", paint: { "circle-radius": 3, "circle-color": GREEN, "circle-stroke-color": "#000", "circle-stroke-width": 1 } });
      map.addLayer({ id: "acc", type: "fill", source: "acc", paint: { "fill-color": INK, "fill-opacity": 0.12 } });
      map.addLayer({ id: "player", type: "circle", source: "player", paint: { "circle-radius": 6, "circle-color": INK, "circle-stroke-color": "#000", "circle-stroke-width": 2 } });
      readyRef.current = true;
      setReady(true);
    });
    mapRef.current = map;
    return () => { readyRef.current = false; map.remove(); mapRef.current = null; };
  }, [lib]);

  useEffect(() => { if (mapRef.current) mapRef.current.resize(); }, [height, ready]);

  /* ---- hole layers: trouble near this hole, green outline, centreline ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const near = troubleNearHole(trouble || [], { line: hole && hole.line, green }, 250);
    map.getSource("trouble").setData(fc(near.map((t) => polyF(t.ring, { kind: t.kind }))));
    map.getSource("green").setData(green && green.ring ? fc([polyF(green.ring)]) : EMPTY);
    map.getSource("target").setData(target ? fc([pointF(target)]) : EMPTY);
    map.getSource("line").setData(hole && hole.line && hole.line.length >= 2 ? fc([lineF(hole.line)]) : EMPTY);
  }, [ready, hole, green, trouble]);

  /* ---- shot layers: ellipse + rim samples, player dot + accuracy ring ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (origin && target && club && phase !== "putt") {
      const near = troubleNearHole(trouble || [], { line: hole && hole.line, green }, 250);
      const d = dispersion(origin, bearingDeg(origin, target), club, near);
      map.getSource("ellipse").setData(fc([polyF(d.ring)]));
      map.getSource("samples").setData(fc(d.samples.map((s) => pointF(s, { trouble: s.trouble }))));
    } else {
      map.getSource("ellipse").setData(EMPTY);
      map.getSource("samples").setData(EMPTY);
    }
    map.getSource("player").setData(fix ? fc([pointF(fix)]) : EMPTY);
    map.getSource("acc").setData(fix && fix.acc > 8 ? fc([polyF(circleRing(fix, fix.acc))]) : EMPTY);
  }, [ready, origin && origin.lat, origin && origin.lon, fix && fix.acc, target && target.lat, target && target.lon, club && club.id, phase, trouble, hole, green]);

  /* ---- framing: hole-up, fit origin ↔ green (short/putt: the green itself); re-fit on hole/phase/first fix ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !origin || !target) return;
    const key = `${hole && hole.line ? hole.line.length : 0}|${target.lat.toFixed(5)}|${phase}|${fix ? "fix" : "tee"}`;
    if (fitKey.current === key) {
      // still framed? only re-fit if the player has walked out of view
      try { if (!fix || map.getBounds().contains([fix.lon, fix.lat])) return; } catch (e) { return; }
    }
    fitKey.current = key;
    const bearing = bearingDeg(origin, target);
    const b = new (window.maplibregl.LngLatBounds)();
    const extend = (p) => b.extend([p.lon, p.lat]);
    if (phase === "short" || phase === "putt") {
      (green && green.ring ? green.ring : circleRing(target, 20, 12)).forEach(extend);
      extend(origin);
    } else {
      extend(origin); extend(target);
      if (green && green.ring) green.ring.forEach(extend);
      if (club) dispersion(origin, bearing, club, []).ring.forEach(extend);
    }
    map.fitBounds(b, { bearing, pitch: 0, padding: { top: 30, bottom: 48, left: 30, right: 30 }, duration: 500, maxZoom: 19 });
  }, [ready, origin && origin.lat, origin && origin.lon, target && target.lat, target && target.lon, phase, hole, club && club.id]);

  const placeholder = !lib ? "Loading map…" : (!target ? "No green for this hole — stand on it and tap to mark" : null);
  return (
    <div style={{ position: "relative", height, borderRadius: 18, overflow: "hidden", background: BG, border: "1px solid #2A2D31" }}>
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      {placeholder && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: SLATE, fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>{placeholder}</div>
      )}
    </div>
  );
}

/* ---------- offline tile pre-fetch (Setup, on wifi) ----------
   Writes straight into the Cache Storage the service worker reads from, so it works even before
   the worker controls the page. Skips tiles already cached. */
export function tileUrl(t) { return TILE_URL.replace("{z}", t.z).replace("{x}", t.x).replace("{y}", t.y); }

export async function prefetchTiles(geo, onProgress, zooms = PREFETCH_ZOOMS, concurrency = 4) {
  const bbox = geometryBbox(geo);
  if (!bbox || typeof caches === "undefined") return { total: 0, ok: 0, cached: 0 };
  const tiles = tilesForBbox(bbox, zooms);
  const cache = await caches.open(TILE_CACHE);
  let ok = 0, done = 0, cached = 0;
  const queue = tiles.slice();
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      const url = tileUrl(t);
      try {
        if (await cache.match(url)) { cached++; ok++; }
        else { const r = await fetch(url); if (r.ok) { await cache.put(url, r); ok++; } }
      } catch (e) { /* offline or 4xx — count it as done and move on */ }
      done++;
      if (onProgress) onProgress({ done, total: tiles.length, ok });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total: tiles.length, ok, cached };
}

/** How many of the course's tiles are already in the cache (for the Setup status line). */
export async function tileCacheStatus(geo, zooms = PREFETCH_ZOOMS) {
  const bbox = geometryBbox(geo);
  if (!bbox || typeof caches === "undefined") return null;
  const tiles = tilesForBbox(bbox, zooms);
  const cache = await caches.open(TILE_CACHE);
  let have = 0;
  for (const t of tiles) if (await cache.match(tileUrl(t))) have++;
  return { have, total: tiles.length };
}
