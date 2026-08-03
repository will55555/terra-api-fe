import * as THREE from 'three';
import { ANCHOR, DOMAINS, LAYOUT_MODE, DOMAIN_COLOR, SERVICE_COLOR, ringPositions, entitledServices } from './domainConfig';
import { colorForStatus, shouldPulse, UNBUILT_COLOR } from './healthColors';

// TFE-401 — Three.js scene for the customer-scoped topology, ported from
// terra-hq-site/terra_api_visualizer_phase5.js (repo ROOT, not archive/ — those are
// superseded).
//
// WHAT CHANGED FROM PHASE5, and why:
//
//  1. No module-level mutable state. phase5 keeps `scene`, `camera`, `renderer`, `clock` as
//     file globals, which is fine for one page-load-one-instance but leaks a second renderer
//     and a second RAF loop under React StrictMode's double-invoked effects. Everything here
//     lives in the closure returned by createScene() and is torn down by dispose().
//  2. No document.getElementById. phase5 reaches for 'canvas', 'hoverLabel', 'theme-icon';
//     this takes the canvas element as an argument so React owns it via a ref.
//  3. `three` is an npm import, not a global from a <script> tag.
//  4. Health drives colour. phase5 had a binary connected/disconnected model plus a
//     HEALTH_ENDPOINTS map pointing at eight localhost ports that never existed. That map is
//     deliberately NOT ported — this reads the single real endpoint via useEcosystemHealth.
//
//  5. Presentation is tuned for a dashboard card rather than a full-viewport showpiece:
//     starfield and fog removed, glass transmission swapped for a matte solid, lighting
//     softened, camera zoomed in. Inside a card the original treatment read as a game engine.
//
// Kept faithful: the orthographic isometric camera at (5,5,5), phase5's exact CUBE_CONFIG
// data (via domainConfig.js), its two-tone palette, the drag-to-rotate math, and the
// cubeGroup that lets the whole lattice turn as one.

const BG_COLOR = 0x04060f;
// Light-mode backdrop, matching terra-hq-site's [data-theme="light"] --bg (#e5e1dc).
const LIGHT_BG_COLOR = 0xe5e1dc;
const ISO_CAMERA_POS = [5, 5, 5];
// Frame half-height. The lattice spans ±0.65 in centres plus a half-cube on each side, and
// the isometric projection puts two corners on a diagonal (× ~1.41). At the cube scale below
// that is roughly ±1.35, so 3.2 leaves the diagram sitting comfortably inside the card with
// real margin rather than pressed against the edges.
const ZOOM = 3.2;

// Domain cubes are drawn smaller than phase5's 1.0. At full size, cubes 1.0 wide with
// centres 1.3 apart leave only 0.3 of gap, so adjacent cubes nearly touch and the lattice
// reads as one solid mass rather than eight distinct domains. 0.62 roughly doubles the
// visible separation while keeping the same corner positions, which is what makes the
// structure legible at card size. phase5 does not need this because a full viewport gives
// the eye enough room to separate them.
const DOMAIN_CUBE_SCALE = 0.62;
const SERVICE_CUBE_SCALE = 0.3;

// Starfield REMOVED 2026-08-02. It was carried over from phase5, where it belongs — that is
// a full-viewport marketing showpiece and the stars read as atmosphere. Inside a dashboard
// card the same effect reads as a game engine rather than a data display: Robinhood and
// Apple render diagrams on flat, quiet grounds and let the DATA carry the visual interest.
// A faint radial gradient (in visualizer.css) gives depth without the decoration.

function createCubeMesh({ scale = 1, color }) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  // Matte, not glass. phase5 used transmission: 0.5 with roughness 0 for a sapphire
  // refraction effect — beautiful full-screen, but inside a dashboard card it reads as a
  // shiny toy. Raising roughness and dropping transmission gives a soft matte solid closer
  // to how Apple renders product diagrams: the FORM carries the meaning, not the shine.
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    roughness: 0.65,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(scale);
  // Remembered so the pulse animation can return to the right size — lattice and ring use
  // different base scales.
  mesh.userData.baseScale = scale;

  // Wireframe edges read the lattice structure far better than the translucent faces alone.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.add(edges);

  return mesh;
}

/**
 * Build the scene and return a handle. The caller owns the canvas; this owns everything
 * inside it.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{applyHealth: Function, resize: Function, dispose: Function}}
 */
export function createScene(canvas) {
  const scene = new THREE.Scene();
  // Transparent rather than a painted background: the card's CSS gradient shows through, so
  // the diagram sits ON the surface instead of in its own little window. Fog is gone with the
  // starfield — at this scale it only muddied the cubes.
  scene.background = null;

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  // Orthographic, not perspective: the isometric look needs parallel lines rather than a
  // vanishing point. Camera at (5,5,5) looking at origin is the classic 35.26° iso angle.
  // Fall back to a sane 16:10 rather than trusting clientWidth at construction time. If the
  // canvas has not been laid out yet both are 0, and 0/0 is NaN — which silently produces an
  // invalid camera frustum rather than throwing. The ResizeObserver in EcosystemVisualizer
  // corrects these values the moment real layout lands.
  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 500;
  const aspect = width > 0 && height > 0 ? width / height : 1.6;
  const camera = new THREE.OrthographicCamera(
    -ZOOM * aspect, ZOOM * aspect, ZOOM, -ZOOM, 0.1, 1000
  );
  camera.position.set(...ISO_CAMERA_POS);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Softer, more directional lighting than phase5's. Its 1.0 ambient + 1.0 directional +
  // cyan point light made every face bright and glassy — the "toy" quality. Lowering ambient
  // and dropping the coloured rim gives cubes readable shading and a matte, product-diagram
  // finish instead of a plastic one.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const directional = new THREE.DirectionalLight(0xffffff, 0.9);
  directional.position.set(4, 8, 6);
  scene.add(directional);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-6, -3, -4);
  scene.add(fill);

  // Anchor at the centre. Terra API is infrastructure every domain consumes, so it is not a
  // corner — it is what the corners orbit.
  const anchorMesh = createCubeMesh({ scale: DOMAIN_CUBE_SCALE * 0.8, color: DOMAIN_COLOR });
  anchorMesh.position.set(...ANCHOR.position);
  anchorMesh.userData.label = `${ANCHOR.name} — ${ANCHOR.desc}`;
  cubeGroup.add(anchorMesh);

  const serviceMeshes = new Map(); // serviceId -> mesh
  // Flat list for raycasting. Only Meshes go in — the edge LineSegments are children and
  // would otherwise steal hits from the cube they outline.
  const pickables = [anchorMesh];
  // Everything except the anchor, so a rebuild can clear the ring without disturbing it.
  let builtMeshes = [];

  /** Remove and release every non-anchor cube. */
  function clearBuilt() {
    for (const mesh of builtMeshes) {
      cubeGroup.remove(mesh);
      mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    builtMeshes = [];
    serviceMeshes.clear();
    pickables.length = 1; // keep the anchor
  }

  /**
   * LATTICE — the full public topology: 8 domain shells at the corners of a 2x2x2, each with
   * its service nested inside at half scale. Built once; nothing here depends on entitlement.
   */
  function buildLattice() {
    for (const domain of DOMAINS) {
      const shell = createCubeMesh({ scale: DOMAIN_CUBE_SCALE, color: DOMAIN_COLOR });
      shell.position.set(...domain.position);
      shell.userData.label = `${domain.name} — ${domain.desc}`;
      cubeGroup.add(shell);
      pickables.push(shell);
      builtMeshes.push(shell);

      if (domain.service) {
        // Nested inside its domain shell — the visual statement that a service belongs to a
        // domain rather than sitting beside it.
        const serviceMesh = createCubeMesh({ scale: SERVICE_CUBE_SCALE, color: SERVICE_COLOR });
        serviceMesh.position.set(...domain.position);
        serviceMesh.userData.label = `${domain.service.name} (${domain.name})`;
        cubeGroup.add(serviceMesh);
        pickables.push(serviceMesh);
        builtMeshes.push(serviceMesh);

        if (domain.service.serviceId) {
          serviceMeshes.set(domain.service.serviceId, serviceMesh);
        }
      }
    }
  }

  /**
   * RING — the customer view: one cube per ENTITLED SERVICE, evenly spaced around the anchor.
   *
   * Rebuilt whenever the entitled set changes, which is why it cannot be constructed up
   * front like the lattice: entitlement arrives with the first health response. Rebuilds are
   * cheap (a handful of cubes) and rare (only when the set itself changes, not on every
   * poll — applyHealth guards that).
   */
  function buildRing(services) {
    const positions = ringPositions(services.length);

    services.forEach((service, i) => {
      // Smaller than the anchor (0.8) so Terra API reads as the thing being orbited. At 0.7
      // the two sizes were close enough that the hierarchy was ambiguous.
      const mesh = createCubeMesh({ scale: 0.55, color: UNBUILT_COLOR });
      mesh.position.set(...positions[i]);
      // Domain shown as context, not as the subject: the customer owns ROMS; Hospitality is
      // where it sits.
      mesh.userData.label = `${service.name} — ${service.domainName}`;
      cubeGroup.add(mesh);
      pickables.push(mesh);
      builtMeshes.push(mesh);
      serviceMeshes.set(service.serviceId, mesh);
    });
  }

  if (LAYOUT_MODE === 'lattice') {
    buildLattice();
  }

  // ─── Interaction ──────────────────────────────────────────────────────────────
  // Ported from phase5's onMouseMoveRotation / onMouseDown / onMouseUpOrLeave, with the
  // same rotationSpeed (0.01) and the same rotateOnWorldAxis approach — world axes rather
  // than local, so dragging stays intuitive no matter how far the lattice has already
  // turned. Listeners bind to the CANVAS, not window: phase5 could own the whole page, but
  // this is one card in a dashboard and must not swallow drags meant for the page.

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let isDragging = false;
  let hasDragged = false;
  let lastX = 0;
  let lastY = 0;
  let autoRotate = true;
  let hoveredMesh = null;
  let hoverLabel = null;

  const ROTATION_SPEED = 0.01;

  function updatePointer(clientX, clientY) {
    // Screen pixels -> Normalized Device Coordinates. NDC is (-1,-1) bottom-left to (1,1)
    // top-right, and Y is flipped because screen Y grows downward.
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickAt(clientX, clientY) {
    updatePointer(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  function onPointerDown(event) {
    isDragging = true;
    hasDragged = false;
    lastX = event.clientX;
    lastY = event.clientY;
    // Stop the idle spin while the user is in control — fighting a drag against an
    // auto-rotation feels broken.
    autoRotate = false;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (isDragging) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasDragged = true;
      }

      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), deltaX * ROTATION_SPEED);
      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), deltaY * ROTATION_SPEED);
      return;
    }

    const mesh = pickAt(event.clientX, event.clientY);
    if (mesh !== hoveredMesh) {
      hoveredMesh = mesh;
      renderer.domElement.style.cursor = mesh ? 'pointer' : 'grab';
      if (hoverLabel) {
        hoverLabel.textContent = mesh?.userData.label ?? '';
        hoverLabel.style.opacity = mesh ? '1' : '0';
      }
    }

    if (hoverLabel && mesh) {
      const rect = renderer.domElement.getBoundingClientRect();
      hoverLabel.style.left = `${event.clientX - rect.left + 12}px`;
      hoverLabel.style.top = `${event.clientY - rect.top + 12}px`;
    }
  }

  function onPointerUp(event) {
    isDragging = false;
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

  function onPointerLeave() {
    isDragging = false;
    hoveredMesh = null;
    if (hoverLabel) hoverLabel.style.opacity = '0';
  }

  // Double-click resumes the idle spin — otherwise the first drag stops it permanently and
  // there is no way back without a reload.
  function onDoubleClick() {
    autoRotate = true;
  }

  const canvasEl = renderer.domElement;
  canvasEl.style.cursor = 'grab';
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);
  canvasEl.addEventListener('dblclick', onDoubleClick);
  // touch-action: none is what makes pointer events fire for touch drags instead of the
  // browser scrolling the page underneath.
  canvasEl.style.touchAction = 'none';

  let rafId = null;
  const clock = new THREE.Clock();
  // serviceId -> whether it should pulse, refreshed by applyHealth.
  let pulsing = new Map();
  let lastElapsed = 0;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Advance by DELTA rather than setting rotation.y absolutely: an absolute assignment
    // would discard whatever the user dragged the moment auto-rotation resumed.
    if (autoRotate) {
      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), (elapsed - lastElapsed) * 0.08);
    }
    lastElapsed = elapsed;

    // Pulse only degraded-but-running services. A healthy service is unremarkable; an off
    // one is not urgent. Drawing the eye to everything draws it to nothing.
    for (const [serviceId, mesh] of serviceMeshes) {
      // Read the base off the mesh rather than hardcoding it — lattice service cubes are 0.5
      // (nested inside a domain shell) and ring cubes are 0.7 (standalone), so a literal here
      // would silently resize one of the two modes.
      const scaleBase = mesh.userData.baseScale ?? 0.5;
      if (pulsing.get(serviceId)) {
        mesh.scale.setScalar(scaleBase + Math.sin(elapsed * 3) * 0.04);
      } else if (mesh.scale.x !== scaleBase) {
        mesh.scale.setScalar(scaleBase);
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  /**
   * Recolour service cubes from the health endpoint's response.
   * @param {Record<string, {running: boolean, tier?: string}>} statusByServiceId
   */
  // Tracks which services the ring was last built for, so a rebuild happens only when the
  // SET changes — not on every 30s poll, which would recreate WebGL geometry needlessly and
  // reset the user's drag rotation mid-look.
  let builtSignature = null;

  function applyHealth(statusByServiceId) {
    if (LAYOUT_MODE === 'ring') {
      const services = entitledServices(statusByServiceId);
      const signature = services.map((s) => s.serviceId).sort().join(',');

      if (signature !== builtSignature) {
        clearBuilt();
        buildRing(services);
        builtSignature = signature;
      }
    }

    const nextPulsing = new Map();

    for (const [serviceId, mesh] of serviceMeshes) {
      const status = statusByServiceId[serviceId] ?? null;
      const color = colorForStatus(status);

      mesh.material.color.setHex(color);
      // The edge LineSegments is the mesh's only child; keeping it in sync is what makes the
      // colour change read clearly at this scale.
      const edges = mesh.children[0];
      if (edges?.material) {
        edges.material.color.setHex(color);
      }

      nextPulsing.set(serviceId, shouldPulse(status));
    }

    pulsing = nextPulsing;
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // Bail on a zero-size canvas rather than computing a NaN aspect. The ResizeObserver
    // fires again once layout gives the element real dimensions.
    if (!w || !h) return;

    const nextAspect = w / h;
    camera.left = -ZOOM * nextAspect;
    camera.right = ZOOM * nextAspect;
    camera.top = ZOOM;
    camera.bottom = -ZOOM;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  // Explicit teardown. Three.js holds GPU resources the garbage collector cannot reclaim, so
  // dropping the reference is not enough — geometries, materials, and the WebGL context all
  // have to be released or a remount leaks them.
  /** Element the hover tooltip writes into. React owns it; the scene just positions it. */
  function setHoverLabelElement(element) {
    hoverLabel = element;
  }

  /**
   * Repaint the scene background/fog for a theme.
   * Only the backdrop changes — cube colours stay health-driven, since a YELLOW service is
   * yellow in either theme and remapping it per-theme would break the one meaning the
   * colours carry.
   */
  function setTheme(theme) {
    // Scene background stays transparent in both themes — the card's CSS owns the ground, so
    // the theme flip happens there and the canvas simply lets it through. Kept as a no-op
    // rather than deleted because the React side calls it on every theme change, and cube
    // materials may need theme-aware treatment later.
    void theme;
  }

  function dispose() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    canvasEl.removeEventListener('pointerdown', onPointerDown);
    canvasEl.removeEventListener('pointermove', onPointerMove);
    canvasEl.removeEventListener('pointerup', onPointerUp);
    canvasEl.removeEventListener('pointerleave', onPointerLeave);
    canvasEl.removeEventListener('dblclick', onDoubleClick);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((m) => m.dispose());
      }
    });

    serviceMeshes.clear();
    pickables.length = 0;
    renderer.dispose();
  }

  return { applyHealth, resize, dispose, setHoverLabelElement, setTheme };
}
