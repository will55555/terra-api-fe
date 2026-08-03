import React, { useEffect, useRef } from 'react';
import { createScene } from './terraScene';
import { useTheme } from '../context/ThemeContext';
import './visualizer.css';

// TFE-401/402/403 — the customer-scoped ecosystem visualizer (terra-api-adr-009).
//
// Distinct from terra-hq-site's by AUDIENCE, not by engine: that one is the full public
// 9-cube marketing view with no auth; this one is scoped to the authenticated customer's
// entitled services. Both read the same health data from Terra API.
//
// Health arrives as a PROP rather than being polled here. Dashboard owns the single poll
// because the product launchpad consumes the same data — two independent polls would double
// the request rate and could briefly disagree about whether a service is running.
//
// This component's job is lifecycle only: own the canvas, build the scene once, feed it
// updates, tear it down completely. Rendering lives in terraScene.js and fetching in
// useEcosystemHealth, which keeps the scene testable without React and the hook testable
// without WebGL.
export default function EcosystemVisualizer({ statusByServiceId = {}, error = null }) {
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const sceneRef = useRef(null);
  const { theme } = useTheme();

  // Empty dependency array is deliberate: rebuilding a WebGL context on every health poll or
  // theme flip would be catastrophic. Both flow through their own effects, mutating the live
  // scene instead.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = createScene(canvas);
    sceneRef.current = scene;
    scene.setHoverLabelElement(labelRef.current);

    const handleResize = () => scene.resize();
    window.addEventListener('resize', handleResize);
    // clientWidth is only meaningful after layout — true by the time effects run, but not
    // when createScene reads it during the same tick.
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      // Three.js holds GPU resources the garbage collector cannot reclaim. Without this,
      // React StrictMode's double-invoked effects leak a second renderer and RAF loop in dev.
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.applyHealth(statusByServiceId);
  }, [statusByServiceId]);

  // WebGL cannot read CSS custom properties, so the scene's background is repainted
  // imperatively rather than inherited from the theme attribute.
  useEffect(() => {
    sceneRef.current?.setTheme(theme);
  }, [theme]);

  // Nothing orbiting the anchor means either no entitlements or a failed feed. Without this
  // the card renders a lone cube in an empty field, which reads as broken rather than empty.
  const isEmpty = Object.keys(statusByServiceId).length === 0;

  return (
    <div className="cm-visualizer">
      <canvas ref={canvasRef} className="cm-topo-canvas" />
      {/* Positioned by the scene on hover. Kept in React's tree so it inherits theme styling
          rather than being a detached DOM node the scene creates itself. */}
      <div ref={labelRef} className="cm-topo-hover-label" />

      {isEmpty && (
        <div className="cm-viz-empty">
          <span className="cm-viz-empty-title">
            {error ? 'Status unavailable' : 'No services yet'}
          </span>
          <span className="cm-viz-empty-note">
            {error ? 'Reconnecting' : 'No products on your account yet'}
          </span>
        </div>
      )}

      <div className="cm-viz-hint">DRAG TO ROTATE · DOUBLE-CLICK TO RESUME SPIN</div>
    </div>
  );
}
