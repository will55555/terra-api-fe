import * as THREE from 'three';
import { ANCHOR, DOMAINS, DOMAIN_COLOR, SERVICE_COLOR } from './domainConfig';
import { colorForStatus, shouldPulse, UNBUILT_COLOR } from './healthColors';

// TFE-401 — full copy-paste port of terra-hq-site/terra_api_visualizer_phase5.js (repo ROOT,
// not archive/) into React, per Will's explicit call: this must be the SAME visualizer, not a
// reduced dashboard-card variant. Every phase5 behavior below is preserved — starfield, fog,
// glass materials, click-to-expand/release/collapse, pipeline tubes with shader pulse, mouse
// repulsion field, touch support.
//
// What actually had to change, and only this:
//  1. No module-level mutable state. phase5 keeps `scene`/`camera`/`renderer`/`clock` etc as
//     file globals — fine for one page-load-one-instance, but leaks a second renderer and RAF
//     loop under React StrictMode's double-invoked effects. Everything here lives in the
//     closure returned by createScene() and is torn down by dispose().
//  2. No document.getElementById/querySelector for #canvas/#hoverLabel/.theme-toggle. This
//     takes the canvas as an argument (React owns it via a ref) and the hover label element is
//     supplied via setHoverLabelElement, matching EcosystemVisualizer's existing contract.
//  3. `three` is an npm import, not a global from a <script> tag.
//  4. Health comes in through applyHealth(statusByServiceId), fed by the existing
//     useEcosystemHealth hook — not polled internally. Dashboard owns the single poll (see
//     EcosystemVisualizer's header) because the product launchpad consumes the same data.
//  5. Listeners bind to the canvas element instead of window, since this is one component in a
//     page rather than the whole document.
//  6. Theme is driven by setTheme(theme) from React's ThemeContext instead of an internal
//     localStorage toggle + theme-icon button — the surrounding dashboard already owns theme.
//
// Everything else — CUBE_CONFIG's shape (via domainConfig.js, itself a verbatim mirror),
// materials, camera, lighting, the pipeline shader, the expand/release/collapse state machine,
// the repulsion field — is unchanged from phase5.

const ZOOM = 6;
const ISO_CAMERA_POS = [5, 5, 5];

// Build the same CUBE_CONFIG shape phase5 uses, from domainConfig.js's shared data — keeps one
// source of truth (ADR-009) instead of re-declaring positions/colours here.
function buildCubeConfig() {
  const config = [
    {
      name: ANCHOR.name,
      desc: ANCHOR.desc,
      position: ANCHOR.position,
      scale: ANCHOR.scale,
      color: DOMAIN_COLOR,
      connected: true,
      isAnchor: true,
    },
  ];

  for (const domain of DOMAINS) {
    config.push({
      name: domain.name,
      desc: domain.desc,
      position: domain.position,
      scale: 1,
      color: DOMAIN_COLOR,
      connected: true,
      hasChildren: true,
      children: domain.service ? [domain.service.name] : [],
    });

    if (domain.service) {
      config.push({
        name: domain.service.name,
        desc: domain.service.desc,
        position: domain.position,
        scale: 0.5,
        color: SERVICE_COLOR,
        connected: true,
        parent: domain.name,
        hidden: true,
        serviceId: domain.service.serviceId,
      });
    }
  }

  return config;
}

// serviceId lookup by cube name, derived the same way phase5's SERVICE_ID_BY_CUBE_NAME was —
// only cubes with a real serviceId (ROMS, PIOS today) get health-driven colour.
function buildServiceIdByCubeName() {
  const map = {};
  for (const domain of DOMAINS) {
    if (domain.service?.serviceId) {
      map[domain.service.name] = domain.service.serviceId;
    }
  }
  return map;
}

function fract(x) {
  return x - Math.floor(x);
}

function smoothstep(edge1, edge0, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createStarfield() {
  // 120, not phase5's 800, and dimmer/smaller — per Will's 2026-08-04 direction ("looks too
  // much like a game"). At 800 dense bright points, a small dashboard card reads as a sci-fi
  // skybox; this keeps a faint sense of depth without competing with the cubes for attention.
  const starCount = 120;
  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 200;
    positions[i + 1] = (Math.random() - 0.5) * 200;
    positions[i + 2] = (Math.random() - 0.5) * 200;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0x8890a0,
    size: 0.15,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
  });

  return new THREE.Points(starGeometry, starMaterial);
}

/**
 * Build the scene and return a handle. The caller owns the canvas; this owns everything
 * inside it.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{applyHealth: Function, resize: Function, dispose: Function, setHoverLabelElement: Function, setTheme: Function}}
 */
export function createScene(canvas) {
  const CUBE_CONFIG = buildCubeConfig();
  // DEV-ONLY TEST TOOLING, added 2026-08-04 — pairs with useEcosystemHealth.js's mock, kept
  // intentionally. Production only maps ROMS/PIOS (the only domains with a real serviceId), so
  // ?mockHealthAll=1 would have nothing to color for the other 6 domains without this override.
  // Mirrors those same service.id values so every domain/child pair becomes eligible for the
  // mock's synthetic statuses. Only ever active when the query param is present; every normal
  // page load falls through to the real buildServiceIdByCubeName() below.
  const isMockAllTest = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('mockHealthAll') === '1';
  const SERVICE_ID_BY_CUBE_NAME = isMockAllTest
    ? Object.fromEntries(DOMAINS.filter((d) => d.service).map((d) => [d.service.name, d.service.id]))
    : buildServiceIdByCubeName();

  const scene = new THREE.Scene();
  // Nudged one step lighter than phase5's original 0x04060f per Will's 2026-08-04 request
  // ("tiny bit lighter") — cube/tube colours themselves are untouched, this is background only.
  scene.background = new THREE.Color(0x0a0e1a);
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.03);
  scene.add(createStarfield());

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

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
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Reverted to phase5's original intensities 2026-08-04 — Will confirmed the gem/glass look
  // (bright lights make the transmission/refraction actually read) is intentional, Infinity
  // Stone-style, not something to dim.
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(5, 5, 5);
  directional.castShadow = true;
  scene.add(directional);
  const accent = new THREE.PointLight(0x00d9ff, 0.5);
  accent.position.set(-5, 3, 3);
  scene.add(accent);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let cubes = [];
  let cubesByName = {};
  let pipelineLayer = null;
  const dynamicPipelineExtensions = {};
  const parentChildStates = {};
  let hoveredMesh = null;
  let hoverLabelEl = null;
  let lastClickTime = 0;
  const CLICK_COOLDOWN = 300;

  const globalPipelineUniforms = { time: { value: 0.0 } };

  function createSapphireCube(config) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    let material;
    if (config.connected) {
      // Reverted 2026-08-04: an earlier pass in this same session flattened these toward matte
      // (roughness up, transmission/ior down) chasing a "less like a game" note. Will then
      // clarified explicitly: the gem/glass look is INTENTIONAL and should stay — Infinity
      // Stone-style (the blue Space Stone), not a flaw to fix. Restored to the original phase5
      // glass values. The "looks like a game" complaint is about OTHER elements (dashboard
      // corner ornaments, starfield density — see those fixes), not this material.
      if (config.isAnchor) {
        material = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2.0,
          transparent: true,
          opacity: 1.0,
          roughness: 0.0,
          metalness: 0.0,
          transmission: 0.7,
          thickness: 2.5,
          envMapIntensity: 3.0,
          ior: 2.4,
        });
      } else {
        material = new THREE.MeshPhysicalMaterial({
          color: 0x1a3a6b,
          emissive: 0x1a6aff,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
          roughness: 0.0,
          metalness: 0.2,
          transmission: 0.5,
          thickness: 1.5,
          envMapIntensity: 2.0,
          ior: 2.4,
        });
      }
    } else {
      const opacity = 0.45;
      let baseColor = 0x5588aa;
      if (config.isAnchor) {
        baseColor = 0xaa8899;
      }
      material = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.5,
        roughness: 0.15,
        transparent: true,
        opacity,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...config.position);
    mesh.scale.set(config.scale, config.scale, config.scale);

    if (config.connected && !config.isAnchor) {
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x88ddff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9,
      });
      mesh.add(new THREE.LineSegments(edges, edgeMaterial));
    }

    if (config.isAnchor && config.connected) {
      const sphereGeometry = new THREE.SphereGeometry(config.scale * 0.6, 32, 32);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        fog: false,
      });
      const glowSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      glowSphere.userData.isTerraPulse = true;
      mesh.add(glowSphere);
    }

    mesh.userData.config = config;
    mesh.userData.baseMaterial = material.clone();
    mesh.userData.originalPosition = new THREE.Vector3(...config.position);

    if (config.hidden) {
      mesh.visible = false;
    }

    cubeGroup.add(mesh);
    cubes.push(mesh);
    cubesByName[config.name] = mesh;

    return mesh;
  }

  function createPipelineLayer() {
    const pipelineGroup = new THREE.Group();
    const tubeRadius = 0.04;
    const tubeSegments = 10;

    const terraCube = cubes.find((c) => c.userData.config.isAnchor);
    const pathOrder = [
      'Finance', 'Hospitality', 'Solar', 'Agriculture',
      'Real Estate', 'Apparel', 'Ventures', 'Africa',
    ];

    const edges = [];
    if (terraCube) {
      pathOrder.forEach((name) => {
        const cube = cubes.find((c) => c.userData.config.name === name);
        if (cube) edges.push({ cube1: terraCube, cube2: cube });
      });
    }
    edges.forEach(({ cube1, cube2 }) => {
      const curve = new THREE.LineCurve3(cube1.position, cube2.position);
      const tubeGeometry = new THREE.TubeGeometry(curve, tubeSegments, tubeRadius, 8, false);

      const tubeMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...globalPipelineUniforms,
          connected1: { value: cube1.userData.config.connected ? 1.0 : 0.0 },
          connected2: { value: cube2.userData.config.connected ? 1.0 : 0.0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform float connected1;
          uniform float connected2;
          varying vec2 vUv;
          void main() {
            float isConnected = min(connected1, connected2);
            if (isConnected > 0.5) {
              float pulse = fract(vUv.x - time * 0.4);
              float brightness = smoothstep(0.6, 0.0, abs(pulse - 0.5));
              vec3 goldPipe = vec3(0.78, 0.53, 0.06);
              vec3 white = vec3(1.0, 1.0, 1.0);
              vec3 color = mix(goldPipe, white, brightness);
              float alpha = 0.4 + brightness * 0.6;
              gl_FragColor = vec4(color, alpha);
            } else {
              vec3 brightRed = vec3(1.0, 0.2, 0.2);
              gl_FragColor = vec4(brightRed, 0.4);
            }
          }
        `,
        transparent: true,
      });

      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.userData.cube1 = cube1;
      tube.userData.cube2 = cube2;
      pipelineGroup.add(tube);
    });

    cubeGroup.add(pipelineGroup);
    return pipelineGroup;
  }

  function createPipelineExtension(cubeName, cube) {
    const tubeRadius = 0.04;
    const tubeSegments = 10;
    const connectionPoint = cube.userData.originalPosition;

    const curve = new THREE.LineCurve3(
      new THREE.Vector3(connectionPoint.x, connectionPoint.y, connectionPoint.z),
      cube.position
    );
    const tubeGeometry = new THREE.TubeGeometry(curve, tubeSegments, tubeRadius, 8, false);

    const tubeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...globalPipelineUniforms,
        connected1: { value: cube.userData.config.connected ? 1.0 : 0.0 },
        connected2: { value: cube.userData.config.connected ? 1.0 : 0.0 },
        offsetFactor: { value: Math.random() },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPosition;
        uniform float time;
        uniform float connected1;
        uniform float connected2;
        uniform float offsetFactor;
        void main() {
          float isConnected = min(connected1, connected2);
          float positionNorm = fract(vPosition.y * 2.0 + time * 1.5 + offsetFactor);
          if (isConnected > 0.5) {
            float pulse = fract(positionNorm - time * 0.4);
            float brightness = smoothstep(0.6, 0.0, abs(pulse - 0.5));
            vec3 goldPipe = vec3(0.78, 0.53, 0.06);
            vec3 white = vec3(1.0, 1.0, 1.0);
            vec3 color = mix(goldPipe, white, brightness);
            float alpha = 0.4 + brightness * 0.6;
            gl_FragColor = vec4(color, alpha);
          } else {
            vec3 brightRed = vec3(1.0, 0.2, 0.2);
            gl_FragColor = vec4(brightRed, 0.4);
          }
        }
      `,
      transparent: true,
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    // cube1/cube2 (both = cube), matching the main radial tubes' naming so the live-refresh
    // loop below recognizes this tube on every tick instead of freezing its connected state at
    // creation time — this is THQ-003's fix, carried into the React port from the start.
    tube.userData.cube1 = cube;
    tube.userData.cube2 = cube;
    tube.userData.isExtension = true;
    pipelineLayer.add(tube);

    let childTube = null;
    const config = cube.userData.config;
    if (config.hasChildren && config.children.length > 0) {
      const childMesh = cubesByName[config.children[0]];
      if (childMesh) {
        const childCurve = new THREE.LineCurve3(cube.position, childMesh.position);
        const childTubeGeometry = new THREE.TubeGeometry(childCurve, tubeSegments, tubeRadius, 8, false);
        childTube = new THREE.Mesh(childTubeGeometry, tubeMaterial);
        childTube.userData.cube1 = cube;
        childTube.userData.cube2 = cube;
        childTube.userData.isExtension = true;
        pipelineLayer.add(childTube);
      }
    }

    return { parentTube: tube, childTube };
  }

  function applyCubeColor(cubeName, colorHex) {
    const mesh = cubesByName[cubeName];
    if (!mesh) return;
    mesh.userData.config.color = colorHex;
    mesh.material.color.setHex(colorHex);
    if (mesh.userData.baseMaterial) {
      mesh.userData.baseMaterial.color.setHex(colorHex);
    }
  }

  function updateCubeConnection(cubeName, isConnected) {
    const mesh = cubesByName[cubeName];
    if (!mesh) return;

    mesh.userData.config.connected = isConnected;

    // Floor raised from 0.7/no-glow to 0.55/dim-outline 2026-08-04: at the old values, a
    // disconnected child (every domain except ROMS/PIOS today, since nothing else has a
    // reporting service yet) rendered with no emissive glow AND no edge outline, which against
    // the scene's dark background made it functionally invisible — confirmed live by Will as
    // "some children aren't there" when several domains were expanded side by side. The cube is
    // still clearly dimmer than a connected one (opacity, no strong emissive), but now has a
    // faint edge outline so an unbuilt placeholder reads as "present, nothing here yet" rather
    // than vanishing.
    const opacity = isConnected ? 0.85 : 0.55;
    const baseColor = mesh.userData.config.color;
    const emissive = isConnected ? baseColor : 0x000000;
    const emissiveIntensity = isConnected ? 0.8 : 0;

    mesh.material.opacity = opacity;
    mesh.material.emissive.setHex(emissive);
    mesh.material.emissiveIntensity = emissiveIntensity;

    // Anchor-only body-colour swap, added 2026-08-04: phase5's own createSapphireCube already
    // specifies 0xaa8899 ("Terra: greyish pink when disconnected") for the anchor, but that
    // branch only ran at MESH-CREATION time — since the anchor is always built with
    // connected:true, the pink value was dead code, never actually applied. The anchor's
    // "off" state instead just dimmed the same white glass material, which read as white/blue,
    // not pink (confirmed live by Will). Fixed here where connection state actually changes at
    // runtime, not just at creation.
    if (mesh.userData.config.isAnchor) {
      mesh.material.color.setHex(isConnected ? 0xffffff : 0xaa8899);
      if (mesh.userData.baseMaterial) {
        mesh.userData.baseMaterial.color.setHex(isConnected ? 0xffffff : 0xaa8899);
      }
    }

    if (mesh.userData.baseMaterial) {
      mesh.userData.baseMaterial.opacity = opacity;
      mesh.userData.baseMaterial.emissive.setHex(emissive);
      mesh.userData.baseMaterial.emissiveIntensity = emissiveIntensity;
    }

    const config = mesh.userData.config;
    if (!mesh.userData.edgeLines) {
      const geometry = mesh.geometry;
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeColor = config.isAnchor ? 0xeeffff : 0x88ddff;
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: edgeColor,
        linewidth: 2,
        transparent: true,
        opacity: config.isAnchor ? 1.0 : 0.9,
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
      mesh.add(edgeLines);
      mesh.userData.edgeLines = edgeLines;
    }
    // Outline stays attached either way now; only its own opacity signals connected state.
    mesh.userData.edgeLines.material.opacity = (config.isAnchor ? 1.0 : 0.9) * (isConnected ? 1.0 : 0.35);

    if (config.children && config.children.length > 0 && !config.parent) {
      config.children.forEach((childName) => updateCubeConnection(childName, isConnected));
    }

    if (pipelineLayer) {
      pipelineLayer.children.forEach((tube) => {
        if (tube.userData.cube1 && tube.userData.cube2) {
          const c1 = tube.userData.cube1.userData.config.connected ? 1.0 : 0.0;
          const c2 = tube.userData.cube2.userData.config.connected ? 1.0 : 0.0;
          if (tube.material.uniforms) {
            tube.material.uniforms.connected1.value = c1;
            tube.material.uniforms.connected2.value = c2;
          }
        }
      });
    }
  }

  // ─── Health application (replaces phase5's fetch-based runHealthCheckTick) ─────────────
  // React feeds statusByServiceId in via applyHealth(); this walks the same CUBE_CONFIG /
  // SERVICE_ID_BY_CUBE_NAME logic phase5 used per-tick, just without the fetch itself.
  //
  // hasError, added 2026-08-04: `statusByServiceId != null` was ALWAYS true, because
  // EcosystemVisualizer defaults the prop to `{}` (never null) and useEcosystemHealth's own
  // state starts at `{}` and stays `{}` on a fetch failure (deliberately, so a transient blip
  // doesn't blank the topology) — so the anchor's "unreachable" pink never actually applied,
  // confirmed live by Will (anchor stayed white/blue with "STATUS UNAVAILABLE" showing). The
  // real reachability signal is the hook's separate `error` value, passed through here.
  function applyHealth(statusByServiceId, hasError = false) {
    const terraApiReachable = !hasError;
    updateCubeConnection(ANCHOR.name, terraApiReachable);

    // Diagnostic log, added 2026-08-04 at Will's request — one line per health tick (not
    // phase5's verbose per-cube logging, which would flood devtools). Shows exactly what
    // reached the scene so a "why is X the wrong colour" question can be answered from the
    // console instead of guessing. Safe to remove once the pipeline is fully trusted.
    // eslint-disable-next-line no-console
    console.log('[terra-visualizer] health tick', {
      reachable: terraApiReachable,
      services: statusByServiceId,
    });

    for (const domain of DOMAINS) {
      // isMockAllTest also unlocks placeholder domains here — otherwise this gate would skip
      // them before SERVICE_ID_BY_CUBE_NAME's override above ever gets consulted.
      const reportingChild = (domain.service?.serviceId || (isMockAllTest && domain.service))
        ? domain.service.name : null;

      if (!reportingChild || !terraApiReachable) {
        applyCubeColor(domain.name, UNBUILT_COLOR);
        if (domain.service) applyCubeColor(domain.service.name, UNBUILT_COLOR);
        updateCubeConnection(domain.name, false);
        continue;
      }

      const serviceId = SERVICE_ID_BY_CUBE_NAME[reportingChild];
      const status = statusByServiceId[serviceId] ?? null;
      const tierColor = colorForStatus(status);

      applyCubeColor(reportingChild, tierColor);
      updateCubeConnection(domain.name, Boolean(status && status.running));

      const mesh = cubesByName[reportingChild];
      if (mesh) mesh.userData.shouldPulse = shouldPulse(status);
    }
  }

  function applyRepulsionField() {
    const cubeSize = 1.0;
    const repulsionStrength = 0.15;

    for (let i = 0; i < cubes.length; i++) {
      for (let j = i + 1; j < cubes.length; j++) {
        const cubeA = cubes[i];
        const cubeB = cubes[j];
        if (!cubeA.visible || !cubeB.visible) continue;

        const scaleA = cubeA.scale.x;
        const scaleB = cubeB.scale.x;
        const collisionDistance = ((cubeSize * scaleA) / 2 + (cubeSize * scaleB) / 2) + 0.05;

        const delta = new THREE.Vector3().subVectors(cubeB.position, cubeA.position);
        const distance = delta.length();

        if (distance < collisionDistance && distance > 0.001) {
          const direction = delta.normalize();
          const overlap = collisionDistance - distance;
          const pushForce = direction.multiplyScalar(overlap * repulsionStrength);
          cubeA.position.sub(pushForce);
          cubeB.position.add(pushForce);
        }
      }
    }
  }

  // ─── Interaction: hover, drag-rotate, click-to-expand/release/collapse ─────────────────
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  const ROTATION_SPEED = 0.01;
  // Idle auto-spin, added 2026-08-04 — NOT present in phase5's own source (confirmed by
  // reading it directly), but the visualizer's hint text ("DRAG TO ROTATE · DOUBLE-CLICK TO
  // RESUME SPIN") always implied one, carried over from an earlier reduced version of this
  // component that did have it. Will confirmed he wants the spin present, so this is a
  // deliberate addition beyond a faithful phase5 port, not a restoration of something that was
  // silently dropped.
  let autoRotate = true;
  const AUTO_ROTATE_SPEED = 0.12;

  function updatePointer(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickAt(clientX, clientY) {
    updatePointer(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cubes, false);
    return hits.length > 0 ? hits.find((h) => h.object instanceof THREE.Mesh)?.object ?? null : null;
  }

  function onPointerMoveHover(clientX, clientY) {
    const mesh = pickAt(clientX, clientY);

    if (mesh !== hoveredMesh) {
      if (hoveredMesh?.userData.baseMaterial) {
        hoveredMesh.material.copy(hoveredMesh.userData.baseMaterial);
      }
      hoveredMesh = mesh;

      if (mesh) {
        mesh.material.emissiveIntensity = 0.7;
        mesh.material.opacity = 1;
      }

      if (hoverLabelEl) {
        hoverLabelEl.textContent = mesh?.userData.config
          ? `${mesh.userData.config.name} — ${mesh.userData.config.desc}`
          : '';
        hoverLabelEl.style.opacity = mesh ? '1' : '0';
      }
      renderer.domElement.style.cursor = mesh ? 'pointer' : 'grab';
    }

    if (hoverLabelEl && mesh) {
      const rect = renderer.domElement.getBoundingClientRect();
      hoverLabelEl.style.left = `${clientX - rect.left + 12}px`;
      hoverLabelEl.style.top = `${clientY - rect.top + 12}px`;
    }
  }

  function handleClick(clientX, clientY) {
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN) return;
    lastClickTime = now;

    const clickedMesh = pickAt(clientX, clientY);
    if (!clickedMesh?.userData.config) return;

    const config = clickedMesh.userData.config;
    const cubeName = config.name;

    if (config.isAnchor) {
      cubes.forEach((cube) => {
        const cubeConfig = cube.userData.config;
        if (cubeConfig.hasChildren) {
          const originalPos = cube.userData.originalPosition;
          cube.position.copy(originalPos);
          cubeConfig.children.forEach((childName) => {
            const childMesh = cubes.find((c) => c.userData.config.name === childName);
            if (childMesh) {
              childMesh.visible = false;
              childMesh.position.copy(originalPos);
            }
          });
          parentChildStates[cubeConfig.name] = { expanded: false, childReleased: false };
        }
      });
      return;
    }

    if (!parentChildStates[cubeName]) {
      parentChildStates[cubeName] = { expanded: false, childReleased: false };
    }
    const state = parentChildStates[cubeName];

    if (config.parent && clickedMesh.visible) {
      const parentName = config.parent;
      const parentMesh = cubes.find((c) => c.userData.config.name === parentName);
      if (parentMesh) {
        clickedMesh.visible = false;
        clickedMesh.position.copy(parentMesh.position);
        parentMesh.position.copy(parentMesh.userData.originalPosition);
        if (parentChildStates[parentName]) {
          parentChildStates[parentName].expanded = false;
          parentChildStates[parentName].childReleased = false;
        }
      }
      return;
    }

    if (!state.expanded) {
      const originalPos = clickedMesh.userData.originalPosition;
      const expandDir = {
        x: originalPos.x !== 0 ? (originalPos.x > 0 ? 1 : -1) : 0,
        y: originalPos.y !== 0 ? (originalPos.y > 0 ? 1 : -1) : 0,
        z: originalPos.z !== 0 ? (originalPos.z > 0 ? 1 : -1) : 0,
      };
      // 0.8, not phase5's 2.0 — that value was tuned for a full-viewport scene; inside this
      // bounded dashboard card at ZOOM=6 it sent cubes flying off-frame with long stretched
      // tubes (confirmed live 2026-08-04, Will's screenshot). 0.8 keeps the expand motion
      // visible without leaving the card.
      const expandDistance = 0.8;
      clickedMesh.position.x += expandDir.x * expandDistance;
      clickedMesh.position.y += expandDir.y * expandDistance;
      clickedMesh.position.z += expandDir.z * expandDistance;

      if (config.hasChildren) {
        config.children.forEach((childName) => {
          const childMesh = cubes.find((c) => c.userData.config.name === childName);
          if (childMesh) {
            childMesh.visible = true;
            childMesh.position.copy(clickedMesh.position);
          }
        });
      }

      state.expanded = true;
      state.childReleased = false;

      if (!dynamicPipelineExtensions[cubeName]) {
        dynamicPipelineExtensions[cubeName] = createPipelineExtension(cubeName, clickedMesh);
      }
    } else if (state.expanded && !state.childReleased) {
      const raisedPosition = new THREE.Vector3().copy(clickedMesh.position);
      clickedMesh.position.copy(clickedMesh.userData.originalPosition);

      if (config.hasChildren && !config.parent) {
        const scatterDistance = 0.8; // matches expandDistance's card-scale correction above
        const originalPos = clickedMesh.userData.originalPosition;
        const dir = {
          x: originalPos.x !== 0 ? (originalPos.x > 0 ? 1 : -1) : 0,
          y: originalPos.y !== 0 ? (originalPos.y > 0 ? 1 : -1) : 0,
          z: originalPos.z !== 0 ? (originalPos.z > 0 ? 1 : -1) : 0,
        };
        config.children.forEach((childName) => {
          const childMesh = cubes.find((c) => c.userData.config.name === childName);
          if (childMesh) {
            childMesh.position.set(
              raisedPosition.x + dir.x * scatterDistance,
              raisedPosition.y + dir.y * scatterDistance,
              raisedPosition.z + dir.z * scatterDistance
            );
          }
        });
      }

      state.childReleased = true;
    } else if (state.expanded && state.childReleased) {
      if (config.hasChildren) {
        config.children.forEach((childName) => {
          const childMesh = cubes.find((c) => c.userData.config.name === childName);
          if (childMesh) childMesh.position.copy(clickedMesh.position);
        });
      }
      state.expanded = false;
      state.childReleased = false;
    }
  }

  function onPointerDown(event) {
    isDragging = true;
    autoRotate = false;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function onDoubleClick() {
    autoRotate = true;
  }

  function onPointerMove(event) {
    if (isDragging) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), deltaX * ROTATION_SPEED);
      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), deltaY * ROTATION_SPEED);
      return;
    }
    onPointerMoveHover(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    isDragging = false;
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.releasePointerCapture?.(event.pointerId);
  }

  function onPointerLeave() {
    isDragging = false;
    hoveredMesh = null;
    if (hoverLabelEl) hoverLabelEl.style.opacity = '0';
  }

  function onClick(event) {
    if (!isDragging) handleClick(event.clientX, event.clientY);
  }

  const canvasEl = renderer.domElement;
  canvasEl.style.cursor = 'grab';
  canvasEl.style.touchAction = 'none';
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);
  canvasEl.addEventListener('click', onClick);
  canvasEl.addEventListener('dblclick', onDoubleClick);

  // ─── Build ────────────────────────────────────────────────────────────────────────────
  CUBE_CONFIG.forEach((config) => createSapphireCube(config));
  pipelineLayer = createPipelineLayer();

  // ─── Animation loop ───────────────────────────────────────────────────────────────────
  let rafId = null;
  const clock = new THREE.Clock();

  function animate() {
    rafId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = Date.now() * 0.001;

    // phase5's per-frame sine drift on domain-shell cubes (`cube.position.x = originalPos.x +
    // Math.sin(...)`) is deliberately NOT ported: the main radial pipeline tubes below are
    // built once from a static LineCurve3 between cube centres and never redrawn per frame, so
    // a continuously drifting cube position visually detaches from its tube except at the
    // instant sin() crosses zero — confirmed live 2026-08-04 (Will's screenshot showed the gap).
    // The drift would also fight click-to-expand/release, which sets cube.position directly.
    // Dropping it fixes both and reads as a steadier, more deliberate diagram — closer to
    // Will's "professional, not a game" direction than a constantly wobbling lattice.

    if (autoRotate) {
      cubeGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), delta * AUTO_ROTATE_SPEED);
    }

    Object.keys(dynamicPipelineExtensions).forEach((cubeName) => {
      const cube = cubesByName[cubeName];
      const tubes = dynamicPipelineExtensions[cubeName];
      if (!cube || !tubes || !cube.userData.config) return;

      const state = parentChildStates[cubeName];
      if (!state || !state.expanded) {
        if (tubes.parentTube) {
          pipelineLayer.remove(tubes.parentTube);
          tubes.parentTube.geometry.dispose();
          tubes.parentTube.material.dispose();
        }
        if (tubes.childTube) {
          pipelineLayer.remove(tubes.childTube);
          tubes.childTube.geometry.dispose();
          tubes.childTube.material.dispose();
        }
        delete dynamicPipelineExtensions[cubeName];
        return;
      }

      const parentConnected = cube.userData.config.connected ? 1.0 : 0.0;
      if (tubes.parentTube?.material?.uniforms) {
        tubes.parentTube.material.uniforms.connected1.value = parentConnected;
        tubes.parentTube.material.uniforms.connected2.value = parentConnected;
      }
      if (tubes.childTube?.material?.uniforms) {
        tubes.childTube.material.uniforms.connected1.value = parentConnected;
        const childMesh = cubesByName[cube.userData.config.children?.[0]];
        tubes.childTube.material.uniforms.connected2.value = childMesh?.userData.config.connected ? 1.0 : 0.0;
      }

      if (!cube.userData.lastTubeUpdatePos) {
        cube.userData.lastTubeUpdatePos = new THREE.Vector3();
      }
      const posChanged = cube.userData.lastTubeUpdatePos.distanceTo(cube.position) > 0.01;

      if (posChanged && tubes.parentTube) {
        tubes.parentTube.geometry.dispose();
        const originalPos = cube.userData.originalPosition;
        const parentCurve = new THREE.LineCurve3(
          new THREE.Vector3(originalPos.x, originalPos.y, originalPos.z),
          cube.position
        );
        tubes.parentTube.geometry = new THREE.TubeGeometry(parentCurve, 10, 0.04, 8, false);
      }

      if (posChanged && tubes.childTube && cube.userData.config.children?.length > 0) {
        const childMesh = cubesByName[cube.userData.config.children[0]];
        if (childMesh?.visible) {
          tubes.childTube.geometry.dispose();
          const childCurve = new THREE.LineCurve3(cube.position, childMesh.position);
          tubes.childTube.geometry = new THREE.TubeGeometry(childCurve, 10, 0.04, 8, false);
        }
      }

      if (posChanged) cube.userData.lastTubeUpdatePos.copy(cube.position);
    });

    applyRepulsionField();
    globalPipelineUniforms.time.value += delta * 1.2;

    cubes.forEach((cube) => {
      if (cube.userData.config.isAnchor) {
        cube.children.forEach((child) => {
          if (child.userData.isTerraPulse) {
            const pulseValue = fract(globalPipelineUniforms.time.value * 0.4);
            const brightness = smoothstep(0.6, 0.0, Math.abs(pulseValue - 0.5));
            child.material.opacity = brightness * 0.8;
          }
        });
      }
      // Health-driven pulse (ADR-009 pulse-if-degraded), distinct from Terra's own glow above.
      if (cube.userData.shouldPulse) {
        const base = cube.userData.baseScale ?? cube.userData.config.scale;
        cube.scale.setScalar(base + Math.sin(time * 3) * 0.04);
      }
    });

    renderer.render(scene, camera);
  }
  animate();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const nextAspect = w / h;
    camera.left = -ZOOM * nextAspect;
    camera.right = ZOOM * nextAspect;
    camera.top = ZOOM;
    camera.bottom = -ZOOM;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function setHoverLabelElement(element) {
    hoverLabelEl = element;
  }

  function setTheme(theme) {
    const bgColor = theme === 'light' ? 0xe5e1dc : 0x0a0e1a;
    scene.background = new THREE.Color(bgColor);
    if (scene.fog) scene.fog.color = new THREE.Color(bgColor);
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
    canvasEl.removeEventListener('click', onClick);
    canvasEl.removeEventListener('dblclick', onDoubleClick);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((m) => m.dispose());
      }
    });

    cubes = [];
    cubesByName = {};
    renderer.dispose();
  }

  return { applyHealth, resize, dispose, setHoverLabelElement, setTheme };
}