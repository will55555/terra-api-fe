import React, { useEffect, useRef } from 'react';
import './heartbeat-backdrop.css';

// Ported verbatim (structure + numbers, not just concept) from
// terra-hq-site/terra_api_strategy.html's inline <script>, 2026-08-09 — Will's ask was for
// ApiDashboard to be identical to the HTML reference "down to the background and animations,"
// not an approximation. That file stays the frozen source of truth for this effect; re-copy
// from there if it changes rather than tuning both independently.
//
// A procedurally generated PCB-style trace network — right-angle segments on a grid, branching
// at junctions — generated once across a "chip" area taller than the viewport. Scrolling pans
// the visible window down through the same fixed chip (parallax: slower than actual scroll, so
// it reads as sitting behind the content). On a slow heartbeat-like interval, a flash event
// picks an origin node and does a fast breadth-first spread through connected segments — each
// segment ignites in turn as the light reaches it, so electricity visibly propagates through
// the board in well under a second. Clicking triggers a flash at the nearest point.
//
// React-specific departures from the HTML original (behavior unchanged, only the wiring):
//   - runs in a useEffect keyed on mount/unmount instead of a top-level IIFE, so it starts and
//     tears down cleanly if ApiDashboard itself unmounts (e.g. navigating away) — the HTML
//     version never had to worry about that since the whole page ceases to exist on navigation.
//   - color tokens (--gold/--blue) are read from getComputedStyle exactly as before, which
//     already works here since ThemeContext sets data-theme on <html>, same attribute this
//     script reads for the light/dark branch.
export default function HeartbeatBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = 46; // grid pitch in px
    let chipHeight = 0; // full generated chip height (several viewports tall)
    const chipMultiplier = 4;
    const parallaxFactor = 0.35; // chip pans at 35% of actual scroll speed
    let panY = 0;

    // Real PCB reference photo, drawn as a tiled static backdrop behind the procedural trace
    // network below. The procedural traces are dense/randomized enough that layering them over
    // this image reads as "the same board" without needing the two to align pixel-for-pixel.
    const boardImg = new Image();
    let boardImgLoaded = false;
    boardImg.onload = function onBoardImgLoad() { boardImgLoaded = true; };
    boardImg.src = `${process.env.PUBLIC_URL}/terra_api_circuit_board.png`;
    const boardImgAspect = 1376 / 768; // native image aspect ratio, tile is sized to match

    let nodes = []; // { x, y, links: [nodeIndex,...] }
    let segments = []; // { a: nodeIndex, b: nodeIndex } — for rendering only

    function key(gx, gy) { return `${gx},${gy}`; }

    function buildCircuit() {
      nodes = [];
      segments = [];
      const indexByKey = {};
      const gw = Math.ceil(width / cell);
      const gh = Math.ceil(chipHeight / cell);

      function nodeAt(gx, gy) {
        const k = key(gx, gy);
        if (indexByKey[k] !== undefined) return indexByKey[k];
        const idx = nodes.length;
        nodes.push({ x: gx * cell + (cell * 0.5), y: gy * cell + (cell * 0.5), links: [] });
        indexByKey[k] = idx;
        return idx;
      }
      function link(i1, i2) {
        if (nodes[i1].links.indexOf(i2) !== -1) return;
        nodes[i1].links.push(i2);
        nodes[i2].links.push(i1);
        segments.push({ a: i1, b: i2 });
      }

      // Random-walk trace generator: several walkers start at random grid points and take
      // axis-aligned steps (right-angle turns only), occasionally branching off a second walker
      // — produces a PCB-trace-like network rather than a full uniform grid.
      const walkerCount = Math.max(14, Math.floor((width * chipHeight) / 40000));
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      for (let w = 0; w < walkerCount; w++) {
        let gx = Math.floor(Math.random() * gw);
        let gy = Math.floor(Math.random() * gh);
        const steps = 14 + Math.floor(Math.random() * 22);
        let dirIdx = Math.floor(Math.random() * 4);
        let prevIdx = nodeAt(gx, gy);

        for (let s = 0; s < steps; s++) {
          // mostly keep direction (straight traces read better than constant zigzag), turn ~30%
          if (Math.random() < 0.3) dirIdx = Math.floor(Math.random() * 4);
          const d = dirs[dirIdx];
          gx += d[0]; gy += d[1];
          if (gx < 0 || gy < 0 || gx > gw || gy > gh) break;
          const curIdx = nodeAt(gx, gy);
          link(prevIdx, curIdx);
          prevIdx = curIdx;

          // occasional branch: spin off a short side trace from this point
          if (Math.random() < 0.2) {
            const bDir = dirs[Math.floor(Math.random() * 4)];
            const bx = gx + bDir[0];
            const by = gy + bDir[1];
            if (bx >= 0 && by >= 0 && bx <= gw && by <= gh) {
              link(curIdx, nodeAt(bx, by));
            }
          }
        }
      }
    }

    let adjacency = null; // nodeIdx -> [{ segIdx, otherNodeIdx }]
    function buildAdjacency() {
      adjacency = [];
      for (let i = 0; i < nodes.length; i++) adjacency.push([]);
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        adjacency[seg.a].push({ segIdx: s, otherNodeIdx: seg.b });
        adjacency[seg.b].push({ segIdx: s, otherNodeIdx: seg.a });
      }
    }

    let flashes = []; // { born, segIgniteTime: {segIdx: secondsFromBorn} }
    const hopDuration = 0.05; // seconds per BFS hop — fast propagation
    const maxHops = 6; // how many hops out from origin a single flash reaches
    const segmentLit = 1.0; // seconds a lit segment stays visible before fully decaying
    const beatInterval = 2.4; // slow heartbeat-like pacing between beats
    let lastBeat = -beatInterval;
    const flashesPerBeat = 6; // simultaneous origins lit per beat, in different spots
    let t = 0;

    function nearestNode(x, y) {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - x;
        const dy = nodes[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    }

    function spawnFlashAt(originIdx) {
      if (!adjacency || !adjacency[originIdx] || adjacency[originIdx].length === 0) return;
      const segIgniteTime = {};
      const visitedNode = {};
      visitedNode[originIdx] = true;
      let frontier = [originIdx];
      for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
        const next = [];
        for (let f = 0; f < frontier.length; f++) {
          const neighbors = adjacency[frontier[f]];
          for (let n = 0; n < neighbors.length; n++) {
            const edge = neighbors[n];
            if (segIgniteTime[edge.segIdx] === undefined) segIgniteTime[edge.segIdx] = hop * hopDuration;
            if (!visitedNode[edge.otherNodeIdx]) {
              visitedNode[edge.otherNodeIdx] = true;
              next.push(edge.otherNodeIdx);
            }
          }
        }
        frontier = next;
      }
      flashes.push({ born: t, segIgniteTime });
    }

    function spawnAmbientFlash() {
      if (nodes.length === 0) return;
      const used = {};
      const count = Math.min(flashesPerBeat, nodes.length);
      for (let i = 0; i < count; i++) {
        let idx;
        let attempts = 0;
        do {
          idx = Math.floor(Math.random() * nodes.length);
          attempts++;
        } while (used[idx] && attempts < 10);
        used[idx] = true;
        spawnFlashAt(idx);
      }
    }

    function onClick(e) {
      // click coords are viewport-space; nodes are chip-space, offset by the current pan
      const idx = nearestNode(e.clientX, e.clientY + panY);
      if (idx !== -1) spawnFlashAt(idx);
    }

    function onScroll() {
      const maxPan = Math.max(chipHeight - height, 0);
      panY = Math.min(window.scrollY * parallaxFactor, maxPan);
    }

    function goldRgb() {
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      const n = parseInt(hex.replace('#', ''), 16);
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    }
    function blueRgb() {
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim();
      const n = parseInt(hex.replace('#', ''), 16);
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    }

    function draw() {
      const gold = goldRgb();
      const blue = blueRgb();
      // light theme needs notably higher alpha for equivalent visibility — thin lines against
      // a bright surface read far fainter than the same alpha glowing against near-black
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const lineAlpha = isLight ? 0.4 : 0.14;
      const junctionAlpha = isLight ? 0.5 : 0.18;
      ctx.clearRect(0, 0, width, height);

      if (t - lastBeat >= beatInterval) {
        lastBeat = t;
        spawnAmbientFlash();
      }

      // per-segment brightness this frame, from every currently-active flash
      let segBrightness = null;
      if (flashes.length > 0) {
        segBrightness = {};
        for (let fl = flashes.length - 1; fl >= 0; fl--) {
          const flash = flashes[fl];
          const age = t - flash.born;
          let alive = false;
          // eslint-disable-next-line no-restricted-syntax
          for (const segIdxKey in flash.segIgniteTime) {
            if (Object.prototype.hasOwnProperty.call(flash.segIgniteTime, segIdxKey)) {
              const igniteAt = flash.segIgniteTime[segIdxKey];
              const sinceIgnite = age - igniteAt;
              if (sinceIgnite < 0) { alive = true; continue; } // hasn't reached this segment yet
              if (sinceIgnite > segmentLit) continue; // this segment's flash already decayed
              alive = true;
              let b = 1 - (sinceIgnite / segmentLit);
              b *= b; // ease-out decay — bright flash, then quick fade
              if (!segBrightness[segIdxKey] || segBrightness[segIdxKey] < b) segBrightness[segIdxKey] = b;
            }
          }
          if (!alive) flashes.splice(fl, 1);
        }
      }

      ctx.save();
      ctx.translate(0, -panY);

      // static board photo, tiled down the full chip height — sits behind the procedural trace
      // network so the pulses read as electricity moving across this real board. Light mode
      // draws the image plain/unfiltered (full opacity); dark mode keeps low-opacity normal
      // blending so it reads as a faint atmospheric backdrop rather than fighting body text.
      if (boardImgLoaded) {
        const tileW = width;
        const tileH = tileW / boardImgAspect;
        const tilesDown = Math.max(1, Math.ceil(chipHeight / tileH));
        ctx.globalAlpha = isLight ? 1 : 0.16;
        for (let ti = 0; ti < tilesDown; ti++) {
          ctx.drawImage(boardImg, 0, ti * tileH, tileW, tileH);
        }
        ctx.globalAlpha = 1;
      }

      // static trace lines — the "board" — brightened where an active flash has lit them
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const a = nodes[seg.a];
        const b2 = nodes[seg.b];
        const lit = segBrightness ? segBrightness[i] : undefined;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b2.x, b2.y);
        if (lit) {
          ctx.lineWidth = 1 + lit * 1.8;
          ctx.strokeStyle = `rgba(${blue},${Math.min(0.25 + lit * 0.85, 1)})`;
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(${gold},${lineAlpha})`;
        }
        ctx.stroke();
      }

      // junction dots — faint, mark where traces branch/turn
      ctx.fillStyle = `rgba(${gold},${junctionAlpha})`;
      for (let j = 0; j < nodes.length; j++) {
        if (nodes[j].links.length >= 2) {
          ctx.beginPath();
          ctx.arc(nodes[j].x, nodes[j].y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    let rafId = null;
    function loop() {
      t += 0.016;
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function resize() {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      chipHeight = height * chipMultiplier;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildCircuit();
      buildAdjacency();
      flashes = [];
    }

    function onResize() { resize(); onScroll(); }

    resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    onScroll();

    if (reduceMotion) {
      draw();
    } else {
      loop();
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div className="heartbeat-backdrop">
      <canvas ref={canvasRef} id="heartbeatCanvas" />
    </div>
  );
}
