import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Light/dark theme, matching terra-hq-site's [data-theme="light"] approach so both surfaces
// behave the same way. The attribute goes on <html> rather than a wrapper div because the
// dashboard's own background must change too, not just its cards.
//
// Palette is hq-site's verbatim (terra_api_visualizer_phase5.html):
//   dark  --bg #0a0c10  --surface #111318  --text #e8e4dc
//   light --bg #e5e1dc  --surface #ddd9d4  --text #1a1410
//
// The 3D scene is NOT driven from CSS — WebGL cannot read custom properties — so
// EcosystemVisualizer subscribes to this and calls scene.setTheme() separately. One source
// of truth, two consumers.

const STORAGE_KEY = 'terra-theme';
const ThemeContext = createContext(null);

function resolveInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  // Fall back to the OS preference rather than assuming dark: someone in a light-mode
  // environment getting a black dashboard by default is a worse first impression than the
  // reverse.
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
