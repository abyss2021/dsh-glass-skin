/**
 * Frosted-glass skin for the Harness Web UI.
 *
 * Three parts, all reversible:
 *  1. `ctx.theme.overrideTokens` — one {light, dark} pair per token, so the
 *     built-in Appearance switch keeps working.
 *  2. One plugin-owned stylesheet rendered as a React element inside
 *     `shell.overlay` — the canvas (aurora or a chosen image), the single tone
 *     layer, and the chrome the design tokens have no knob for.
 *  3. A Settings > General row that picks the canvas image (local file or URL)
 *     and its tint; all of it lives in localStorage, no Host state involved.
 *
 * Continuity is deliberate: `--dsw-alias-bg-base` is nearly transparent and the
 * whole app reads one tone layer painted on `body::after`. A translucent base
 * that every structural container repaints stacks 1..3 deep depending on the
 * region, which shows a seam at each boundary; one tone layer cannot.
 */
window.__ModuleLoader__.load({
  id: '@local/glass-skin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* ---------------------------------------------------------------------
     * Token layer: body-level inline variables, composed over the active theme.
     * ------------------------------------------------------------------- */
    const TOKENS = {
      // Canvas: near-transparent, so nested containers cannot stack a tint.
      '--dsw-alias-bg-base': {
        light: 'rgba(255, 255, 255, 0.10)',
        dark: 'rgba(8, 11, 18, 0.10)',
      },
      // Raised surfaces stay visibly frosted against the tone layer.
      '--dsw-alias-bg-layer-1': {
        light: 'rgba(255, 255, 255, 0.46)',
        dark: 'rgba(23, 28, 38, 0.52)',
      },
      '--dsw-alias-bg-layer-2': {
        light: 'rgba(255, 255, 255, 0.58)',
        dark: 'rgba(29, 34, 44, 0.60)',
      },
      '--dsw-alias-bg-layer-3': {
        light: 'rgba(255, 255, 255, 0.70)',
        dark: 'rgba(35, 41, 52, 0.70)',
      },
      '--dsw-alias-bg-overlay': {
        light: 'rgba(255, 255, 255, 0.70)',
        dark: 'rgba(25, 30, 39, 0.74)',
      },
      // Sidebar: a faint pane tint, no edge, so the canvas runs through it.
      '--dsw-specific-sidebar-fill': {
        light: 'rgba(255, 255, 255, 0.22)',
        dark: 'rgba(255, 255, 255, 0.07)',
      },
      // Composer card + menu material.
      '--dsw-specific-input-major': {
        light: 'rgba(255, 255, 255, 0.50)',
        dark: 'rgba(24, 29, 38, 0.44)',
      },
      '--dsw-specific-menu': {
        light: 'rgba(252, 253, 255, 0.62)',
        dark: 'rgba(28, 32, 40, 0.64)',
      },
      '--dsw-menu-surface-fill': {
        light: 'rgba(252, 253, 255, 0.62)',
        dark: 'rgba(28, 32, 40, 0.64)',
      },
      '--dsw-specific-bubble': {
        light: 'rgba(216, 229, 255, 0.55)',
        dark: 'rgba(38, 44, 56, 0.54)',
      },
      // Frost for overlays: menus, popovers and dialog masks are controls that
      // float over the sharp photo.
      '--dsw-menu-backdrop-filter': {
        light: 'blur(40px) saturate(180%)',
        dark: 'blur(40px) saturate(170%) brightness(0.96)',
      },
      '--dsw-mask-blur': {
        light: 'blur(16px) saturate(120%)',
        dark: 'blur(16px) saturate(120%)',
      },
      '--dsw-alias-bg-mask-1': {
        light: 'rgba(18, 26, 42, 0.32)',
        dark: 'rgba(0, 0, 0, 0.52)',
      },
      // Glass edges: a low-alpha hairline, never a lit divider.
      '--dsw-elevation-stroke-color': {
        light: 'rgba(255, 255, 255, 0.55)',
        dark: 'rgba(255, 255, 255, 0.09)',
      },
      '--dsw-alias-border-l1': {
        light: 'rgba(120, 142, 180, 0.20)',
        dark: 'rgba(255, 255, 255, 0.10)',
      },
      '--dsw-alias-border-l2': {
        light: 'rgba(120, 142, 180, 0.26)',
        dark: 'rgba(255, 255, 255, 0.13)',
      },
      '--dsw-alias-border-l3': {
        light: 'rgba(120, 142, 180, 0.30)',
        dark: 'rgba(255, 255, 255, 0.16)',
      },
      '--dsw-alias-border-l4': {
        light: 'rgba(120, 142, 180, 0.34)',
        dark: 'rgba(255, 255, 255, 0.19)',
      },
    };

    /* ---------------------------------------------------------------------
     * Skin mode: mirrors the shell's resolved colour scheme so the settings page
     * can show and set it. `setMode` is the only writer, through ctx.theme.
     * ------------------------------------------------------------------- */
    let themeSeat = null;
    let mode = 'dark';
    const modeListeners = new Set();

    function publishMode(next) {
      if (next === mode) return;
      mode = next;
      for (const listener of modeListeners) listener();
    }

    function getMode() {
      return mode;
    }

    function setMode(next) {
      const value = next === 'light' ? 'light' : 'dark';
      if (themeSeat === null) {
        publishMode(value);
        return;
      }
      try {
        themeSeat.setTheme(value);
        publishMode(value);
      } catch (error) {
        console.warn('[glass-skin] could not switch the theme', error);
      }
    }

    function useMode() {
      const [value, setValue] = React.useState(getMode);
      React.useEffect(() => {
        const listener = () => { setValue(getMode()); };
        modeListeners.add(listener);
        return () => { modeListeners.delete(listener); };
      }, []);
      return value;
    }

    /* ---------------------------------------------------------------------
     * Canvas store: image + tint, mirrored into localStorage.
     * ------------------------------------------------------------------- */
    const KEY_IMAGE = 'glass-skin:wallpaper';
    const KEY_TINT = 'glass-skin:tint';
    const KEY_LEFT_PANEL = 'glass-skin:left-panel';
    const KEY_RIGHT_PANEL = 'glass-skin:right-panel';
    const STORAGE_LIMIT = 3800000;
    const TINT_MIN = 0;
    const TINT_MAX = 80;
    const PANEL_MIN = 0;
    const PANEL_MAX = 100;
    const PANEL_DEFAULT = 20;

    function clamp(value, min, max) {
      if (!Number.isFinite(value)) return min;
      return Math.min(max, Math.max(min, Math.round(value)));
    }

    function readText(key) {
      try {
        return window.localStorage.getItem(key) || '';
      } catch (_unavailable) {
        return '';
      }
    }

    function readNumber(key, fallback, min, max) {
      const raw = readText(key);
      if (raw === '') return fallback;
      const value = Number.parseInt(raw, 10);
      return Number.isFinite(value) ? clamp(value, min, max) : fallback;
    }

    function writeText(key, value) {
      try {
        if (value === '') window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
        return true;
      } catch (_unavailable) {
        return false;
      }
    }

    let canvas = {
      image: readText(KEY_IMAGE),
      tint: readNumber(KEY_TINT, 44, TINT_MIN, TINT_MAX),
      leftPanel: readNumber(KEY_LEFT_PANEL, PANEL_DEFAULT, PANEL_MIN, PANEL_MAX),
      rightPanel: readNumber(KEY_RIGHT_PANEL, PANEL_DEFAULT, PANEL_MIN, PANEL_MAX),
    };
    let imageTransient = false;
    const canvasListeners = new Set();

    function emitCanvas() {
      for (const listener of canvasListeners) listener();
    }

    function subscribeCanvas(listener) {
      canvasListeners.add(listener);
      return () => {
        canvasListeners.delete(listener);
      };
    }

    /**
     * Set the canvas image.
     * @param value - URL, data URL, or empty for the built-in aurora.
     * @returns whether the value survives a reload.
     */
    function setImage(value) {
      const image = (typeof value === 'string' ? value : '').trim();
      imageTransient = false;
      let persisted = true;
      if (image.length > STORAGE_LIMIT) imageTransient = true;
      else persisted = writeText(KEY_IMAGE, image);
      if (!persisted) imageTransient = true;
      canvas = { ...canvas, image };
      emitCanvas();
      return !imageTransient;
    }

    function setTint(value) {
      const tint = clamp(value, TINT_MIN, TINT_MAX);
      writeText(KEY_TINT, String(tint));
      canvas = { ...canvas, tint };
      emitCanvas();
    }

    function setPanel(side, value) {
      const panel = clamp(value, PANEL_MIN, PANEL_MAX);
      writeText(side === 'left' ? KEY_LEFT_PANEL : KEY_RIGHT_PANEL, String(panel));
      canvas = side === 'left'
        ? { ...canvas, leftPanel: panel }
        : { ...canvas, rightPanel: panel };
      emitCanvas();
    }

    function getCanvas() {
      return canvas;
    }

    function useCanvas() {
      const [value, setValue] = React.useState(getCanvas);
      React.useEffect(() => subscribeCanvas(() => { setValue(getCanvas()); }), []);
      return value;
    }

    /** Escape a stored value for use inside a CSS url("…"). */
    function cssUrl(value) {
      return 'url("' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '') + '")';
    }

    /**
     * Downscale a picked file in the page and encode it, so a 12 MP photo still
     * fits the localStorage budget.
     * @param file - picked image file.
     * @param done - receives a data URL, or null when the file cannot be decoded.
     */
    function encodeFile(file, done) {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
          const scale = Math.min(1, 2560 / longest);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const surface = document.createElement('canvas');
          surface.width = width;
          surface.height = height;
          const context = surface.getContext('2d');
          if (context === null) throw new Error('no 2d context');
          context.drawImage(image, 0, 0, width, height);
          done(surface.toDataURL('image/jpeg', 0.86));
        } catch (_failed) {
          done(null);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        done(null);
      };
      image.src = objectUrl;
    }

    /* ---------------------------------------------------------------------
     * Style layer: canvas, tone, chrome, and the settings row.
     * Light is the default; `body[data-ds-dark-theme]` overrides.
     * ------------------------------------------------------------------- */
    const CSS = `
:root {
  --glass-tint-light: rgba(246, 249, 255, 0.52);
  --glass-tint-dark: rgba(7, 10, 17, 0.58);
  --glass-wallpaper: none;
  --glass-left-top: rgba(255, 255, 255, 0.52);
  --glass-left-bottom: rgba(255, 255, 255, 0.34);
  --glass-right-top: rgba(255, 255, 255, 0.52);
  --glass-right-bottom: rgba(255, 255, 255, 0.34);
  --glass-panel-line: 0.75;
  --glass-chip-top: rgba(255, 255, 255, 0.55);
  --glass-chip-bottom: rgba(255, 255, 255, 0.32);
  --glass-chip-top-hover: rgba(255, 255, 255, 0.68);
  --glass-chip-bottom-hover: rgba(255, 255, 255, 0.46);
  --glass-aurora:
    radial-gradient(44% 48% at 16% 18%, rgba(104, 148, 246, 0.55), transparent 64%),
    radial-gradient(42% 46% at 82% 12%, rgba(158, 124, 246, 0.42), transparent 62%),
    radial-gradient(48% 52% at 78% 86%, rgba(72, 206, 232, 0.34), transparent 64%),
    radial-gradient(40% 44% at 18% 90%, rgba(246, 184, 112, 0.24), transparent 62%),
    linear-gradient(158deg, #f7f9fd 0%, #eaf1fb 48%, #f2f6fc 100%);
}
body[data-ds-dark-theme] {
  --glass-left-top: rgba(8, 11, 18, 0.50);
  --glass-left-bottom: rgba(8, 11, 18, 0.34);
  --glass-right-top: rgba(8, 11, 18, 0.50);
  --glass-right-bottom: rgba(8, 11, 18, 0.34);
  --glass-panel-line-dark: 0.14;
  --glass-chip-top: rgba(8, 11, 18, 0.52);
  --glass-chip-bottom: rgba(8, 11, 18, 0.34);
  --glass-chip-top-hover: rgba(8, 11, 18, 0.62);
  --glass-chip-bottom-hover: rgba(8, 11, 18, 0.42);
  --glass-aurora:
    radial-gradient(44% 48% at 16% 18%, rgba(96, 140, 240, 0.42), transparent 64%),
    radial-gradient(42% 46% at 82% 12%, rgba(146, 108, 240, 0.34), transparent 62%),
    radial-gradient(48% 52% at 78% 86%, rgba(52, 190, 220, 0.26), transparent 64%),
    radial-gradient(40% 44% at 18% 90%, rgba(238, 170, 96, 0.14), transparent 62%),
    linear-gradient(158deg, #0a1120 0%, #0c1526 48%, #070c14 100%);
}

/* 1. Canvas. Fixed, inside body's isolated stacking context, above the page
      background and below every shell column. The --glass-wallpaper var is a
      chosen image layer on top of the aurora; the aurora stays the fallback. */
body::before {
  content: '';
  position: fixed;
  /* Overscan keeps the drift animation from revealing an edge; a larger box
     would crop the photo away under background-size: cover. */
  inset: -12%;
  z-index: -3;
  pointer-events: none;
  background-image: var(--glass-wallpaper), var(--glass-aurora);
  background-size: cover, cover;
  background-position: center, center;
  background-repeat: no-repeat, no-repeat;
  animation: glass-skin-drift 54s ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes glass-skin-drift {
  0%   { transform: translate3d(-2%, -1.2%, 0) scale(1.05) rotate(0deg); }
  50%  { transform: translate3d(1.6%, 2%, 0) scale(1.09) rotate(1.2deg); }
  100% { transform: translate3d(2.2%, -1.6%, 0) scale(1.06) rotate(-1deg); }
}

/* 2. The single tone layer. Exactly one, so adjacent regions cannot differ by
      layer count; everything above it is either transparent or a deliberate
      raised surface. No grain: the canvas stays a clean photo. */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background-color: var(--glass-tint-light);
}
body[data-ds-dark-theme]::after {
  background-color: var(--glass-tint-dark);
}

/* 3. The shell frame stops painting its own canvas so the canvas reaches the
      panes. Identified by owning the sidebar column: the plain "frame" class
      collides with chat/subagent/question cards, and a build-hash class would
      not survive an upgrade. */
body :has(> [class*='_sidebarCol']) {
  background: transparent !important;
}

/* 4. Sidebar: no pane fill, but one quiet hairline. Upstream paints the sidebar
      root with --dsw-specific-sidebar-fill; rebinding it to transparent for the
      whole subtree leaves the canvas untouched, so the photo runs through the
      sidebar exactly as it runs through the conversation column. With no pane
      tint left, the column edge carries the separation — a plain 0.5px rule in
      the normal border token, no highlight and no glow. */
body [class*='_sidebarCol'] {
  --dsw-specific-sidebar-fill: transparent;
  border-right: 0.5px solid var(--dsw-alias-border-l3) !important;
  box-shadow: none !important;
}

/* 4c. Structural containers repaint the base tint on their own; with the sidebar
      already bare, that left a faint dark film over the content column only.
      Drop it so the photo is identical edge to edge — the single tone layer owns
      the darkness. */
body :is([data-phase], [data-content-phase], [class*='_bottomRow'], [class*='_tabHost'], [class*='_emptyTabHost']) {
  background: transparent !important;
}

/* 4d. Open side panels are one continuous glass surface: the frame carries
      data-sidebar-collapsed / data-rightbar-collapsed, so the panel only turns
      glass while it is actually expanded. Collapsed rails keep the bare canvas
      and the per-control chips. */
body :has(> [class*='_sidebarCol']):not([data-sidebar-collapsed]) [class*='_sidebarCol'] {
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  backdrop-filter: blur(26px) saturate(170%);
  background-image: linear-gradient(180deg,
    var(--glass-left-top, rgba(255, 255, 255, 0.52)),
    var(--glass-left-bottom, rgba(255, 255, 255, 0.34)));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--glass-panel-line, 0.75));
}
body :has(> [class*='_rightbarCol']):not([data-rightbar-collapsed]) [class*='_rightbarCol'] {
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  backdrop-filter: blur(26px) saturate(170%);
  background-image: linear-gradient(180deg,
    var(--glass-right-top, rgba(255, 255, 255, 0.52)),
    var(--glass-right-bottom, rgba(255, 255, 255, 0.34)));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--glass-panel-line, 0.75));
}
body[data-ds-dark-theme] :has(> [class*='_sidebarCol']):not([data-sidebar-collapsed]) [class*='_sidebarCol'],
body[data-ds-dark-theme] :has(> [class*='_rightbarCol']):not([data-rightbar-collapsed]) [class*='_rightbarCol'] {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--glass-panel-line-dark, 0.14));
}

/* The panel already frosted the photo, so controls inside it go back to the
   native flat look instead of stacking a second chip of glass. */
body :has(> [class*='_sidebarCol']):not([data-sidebar-collapsed]) [class*='_sidebarCol'] :is(button, [role='treeitem'], [role='tab'], [role='button'], input, a[href]) {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  background-image: none;
  box-shadow: none;
}

/* 4b. The sidebar list edge fade paints a colour gradient that ends in the pane
      fill — a milky bar over a photo. The list clips at its own edge anyway, so
      the overlay is dropped instead of re-tinted. */
body [class*='_sidebarCol'] [class*='_fade'] {
  display: none !important;
}

/* 5. Composer seat: upstream fades the strip content scrolls under; over a photo
      that reads as a solid slab, so the strip stays transparent and the card
      carries the separation by itself. Scoped to the phases where upstream makes
      the seat sticky; the blank-session hero phase stays transparent too. */
body [data-phase='active'] [class*='_composerSeat'],
body [data-phase='settling'] [class*='_composerSeat'] {
  background: none !important;
}
body [class*='_composerSeat'] [class*='_card'] {
  -webkit-backdrop-filter: blur(22px) saturate(165%);
  backdrop-filter: blur(22px) saturate(165%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.70),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.50),
    0 24px 48px -22px rgba(15, 32, 66, 0.28) !important;
}
body[data-ds-dark-theme] [class*='_composerSeat'] [class*='_card'] {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.07),
    0 24px 48px -22px rgba(0, 0, 0, 0.62) !important;
}

/* 6. Messages: both directions of the conversation are glass. The sent bubble
      keeps its own tint token, the received step gets a card of its own — that
      wrapper carries a stable kind attribute, so no build-hash class is needed.
      Both frost the photo behind them and share the hairline + top sheen. */
body [class*='_bubble'] {
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  backdrop-filter: blur(18px) saturate(170%);
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    0 10px 22px -14px rgba(15, 32, 66, 0.25);
}
body[data-ds-dark-theme] [class*='_bubble'] {
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 10px 22px -14px rgba(0, 0, 0, 0.55);
}
[data-chat-flow-kind='assistant-step'] {
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.50), rgba(255, 255, 255, 0.30));
  border-radius: var(--dsw-radius-lg);
  padding: 14px 16px;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.60),
    inset 0 1px 0 rgba(255, 255, 255, 0.80),
    0 14px 28px -22px rgba(15, 32, 66, 0.30);
}
body[data-ds-dark-theme] [data-chat-flow-kind='assistant-step'] {
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.04));
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 14px 30px -22px rgba(0, 0, 0, 0.55);
}

/* 7. Settings row (Settings > General). */
.gs-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 8px; }
.gs-intro { color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.gs-group { display: flex; flex-direction: column; }
.gs-groupTitle { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 500; line-height: 20px; }
.gs-groupHint { color: var(--dsw-alias-label-secondary); margin-top: 4px; font-size: 12px; line-height: 18px; }
.gs-row {
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}
.gs-main { min-width: 0; }
.gs-title { color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 20px; }
.gs-desc { color: var(--dsw-alias-label-secondary); margin-top: 4px; font-size: 12px; line-height: 18px; }
.gs-note { color: var(--dsw-alias-state-warn-primary); margin-top: 4px; font-size: 12px; line-height: 18px; }
.gs-controls { flex: none; align-items: center; gap: 8px; display: flex; }
.gs-input {
  box-sizing: border-box;
  width: 240px;
  height: 32px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  padding: 0 10px;
  outline: none;
}
.gs-input::placeholder { color: var(--dsw-alias-label-caption); }
.gs-input:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}
.gs-btn {
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.gs-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.gs-btn.gs-active {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-state-business-primary);
}
.gs-ghost { border-color: transparent; color: var(--dsw-alias-label-secondary); }
.gs-file { display: none; }
.gs-sliders { justify-content: flex-end; }
.gs-slider {
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  display: flex;
}
.gs-slider input[type='range'] { width: 150px; accent-color: var(--dsw-alias-brand-primary); }
.gs-value {
  min-width: 42px;
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
}

/* 8. Frosted controls. The canvas stays a sharp photo; only the controls that
      sit directly on it turn to glass — a translucent gradient, real backdrop
      blur of the photo behind them, an inset hairline and top sheen, and one
      soft drop shadow. No real borders, so nothing shifts by 0.5px. */
body :is(
  [class*='_sidebarCol'] :is(button, [role='treeitem'], [role='tab'], [role='button'], input, a[href]),
  [data-shell-bottom] :is(button, [role='button']),
  [data-shell-leading] :is(button, [role='button']),
  [class*='_header'] button
) {
  -webkit-backdrop-filter: blur(20px) saturate(175%);
  backdrop-filter: blur(20px) saturate(175%);
  background-image: linear-gradient(180deg, var(--glass-chip-top, rgba(255, 255, 255, 0.55)), var(--glass-chip-bottom, rgba(255, 255, 255, 0.32)));
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.66),
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 8px 20px -14px rgba(15, 32, 66, 0.30);
  border-radius: var(--dsw-radius-sm);
}
body :is(
  [class*='_sidebarCol'] :is(button, [role='treeitem'], [role='tab'], [role='button'], input, a[href]),
  [data-shell-bottom] :is(button, [role='button']),
  [data-shell-leading] :is(button, [role='button']),
  [class*='_header'] button
):hover {
  background-image: linear-gradient(180deg, var(--glass-chip-top-hover, rgba(255, 255, 255, 0.68)), var(--glass-chip-bottom-hover, rgba(255, 255, 255, 0.46)));
}
body[data-ds-dark-theme] :is(
  [class*='_sidebarCol'] :is(button, [role='treeitem'], [role='tab'], [role='button'], input, a[href]),
  [data-shell-bottom] :is(button, [role='button']),
  [data-shell-leading] :is(button, [role='button']),
  [class*='_header'] button
) {
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 10px 24px -16px rgba(0, 0, 0, 0.55);
}

/* 8b. New session is a cut-out in the open sidebar, not a chip on top of it.
       While the panel is expanded it already frosts the photo (4d), and upstream
       still paints the button with an opaque --dsw-alias-button-elevated-fill;
       that slab is the only thing hiding the panel material. Drop the fill, the
       blur and the sheen, and keep the button's own 0.5px border as the outline,
       so the whole row reads as the same pane of glass. Hover reuses the native
       interactive tint — translucent, so the frost still shows through.
       Scoped to the open panel: a collapsed rail has no frost behind the button,
       so there it keeps the ordinary chip from section 8. */
body :has(> [class*='_sidebarCol']):not([data-sidebar-collapsed]) [class*='_sidebarCol'] button[class*='_newSession'] {
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
}
body :has(> [class*='_sidebarCol']):not([data-sidebar-collapsed]) [class*='_sidebarCol'] button[class*='_newSession']:is(:hover, :focus-visible) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(120, 142, 180, 0.14));
}

/* 9. Motion and accessibility fallbacks. */
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}
@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-tint-light: rgba(246, 249, 255, 0.94);
    --glass-tint-dark: rgba(7, 10, 17, 0.94);
  }
  body :is(
  [class*='_sidebarCol'] :is(button, [role='treeitem'], [role='tab'], [role='button'], input, a[href]),
  [data-shell-bottom] :is(button, [role='button']),
  [data-shell-leading] :is(button, [role='button']),
  [class*='_header'] button,
  [class*='_bubble'],
  [data-chat-flow-kind='assistant-step']
) {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
/* 10. Main-area panel pages (plugin manager, automation tasks, …). The main
       slot shows one of two things: the conversation, or a full-page panel. The
       conversation is recognized by its own slot anchor (data-slot='main.conversation'),
       so "no such anchor" means a panel page is mounted. Those pages paint their
       root with --dsw-alias-bg-base (0.10 here) and their cards are translucent,
       so the text sits straight on the photo and goes unreadable. Give the whole
       centre column the same frosted pane as the open sidebar — same blur, same
       gradient stops (inherits the open-sidebar strength), same top hairline —
       so a panel page looks like a second pane of the same glass. Chat is
       untouched: its anchor keeps the column bare. */
body :has(> [data-slot='main']):not(:has([data-slot='main.conversation'])) {
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  backdrop-filter: blur(26px) saturate(170%);
  background-image: linear-gradient(180deg,
    var(--glass-main-top, var(--glass-left-top, rgba(255, 255, 255, 0.52))),
    var(--glass-main-bottom, var(--glass-left-bottom, rgba(255, 255, 255, 0.34))));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--glass-panel-line, 0.75));
}
body[data-ds-dark-theme] :has(> [data-slot='main']):not(:has([data-slot='main.conversation'])) {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, var(--glass-panel-line-dark, 0.14));
}

`;

    /**
     * Panel glass strength. One stored 0-100 knob drives both palettes, scaled
     * per scheme because a dark panel needs a fraction of the white a light one
     * needs to read as the same material.
     */
    function panelStops(value, dark) {
      const raw = dark
        ? Math.min(0.85, (value / 100) * 2.50)
        : Math.min(0.92, (value / 100) * 2.60);
      const color = (alpha) => dark
        ? 'rgba(8, 11, 18, ' + alpha.toFixed(3) + ')'
        : 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
      return [color(raw), color(raw * 0.65)];
    }

    /** The stylesheet plus the rules that follow the stored values. */
    function GlassSkinStyle() {
      const state = useCanvas();
      const [leftTopLight, leftBottomLight] = panelStops(state.leftPanel, false);
      const [rightTopLight, rightBottomLight] = panelStops(state.rightPanel, false);
      const [leftTopDark, leftBottomDark] = panelStops(state.leftPanel, true);
      const [rightTopDark, rightBottomDark] = panelStops(state.rightPanel, true);

      let live = ':root {' +
        ' --glass-wallpaper: none;' +
        ' --glass-left-top: ' + leftTopLight + ';' +
        ' --glass-left-bottom: ' + leftBottomLight + ';' +
        ' --glass-right-top: ' + rightTopLight + ';' +
        ' --glass-right-bottom: ' + rightBottomLight + ';' +
        ' }' +
        ' body[data-ds-dark-theme] {' +
        ' --glass-left-top: ' + leftTopDark + ';' +
        ' --glass-left-bottom: ' + leftBottomDark + ';' +
        ' --glass-right-top: ' + rightTopDark + ';' +
        ' --glass-right-bottom: ' + rightBottomDark + ';' +
        ' }';

      if (state.image !== '') {
        const dark = (state.tint / 100).toFixed(2);
        const light = Math.min(0.90, state.tint / 100 + 0.06).toFixed(2);
        live += ':root {' +
          ' --glass-wallpaper: ' + cssUrl(state.image) + ';' +
          ' --glass-tint-dark: rgba(6, 9, 14, ' + dark + ');' +
          ' --glass-tint-light: rgba(246, 249, 255, ' + light + ');' +
          ' }' +
          /* A photo is a place, not a texture: it stays put and covers the whole
             viewport edge to edge. `inset: 0` keeps it flush with the frame, so
             no aurora or tone sliver can show at the edges. */
          ' body::before {' +
          ' inset: 0;' +
          ' animation: none;' +
          ' background-size: cover, cover;' +
          ' }';
      }
      return h('style', { key: 'glass-skin-style', 'data-glass-skin': '' }, CSS + live);
    }

    /** Settings page: canvas image plus its glass tint. */
    function GlassSettings(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const state = useCanvas();
      const mode = useMode();
      const [draft, setDraft] = React.useState('');
      const [note, setNote] = React.useState('');
      const file = React.useRef(null);

      const report = (persisted) => {
        setNote(persisted ? '' : t('tooLarge'));
      };

      const applyUrl = () => {
        const value = draft.trim();
        if (value === '') {
          report(setImage(''));
          return;
        }
        if (!/^(https?:|data:|blob:)/i.test(value)) {
          setNote(t('invalid'));
          return;
        }
        report(setImage(value));
        setDraft('');
      };

      const onFile = (event) => {
        const picked = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!picked) return;
        encodeFile(picked, (dataUrl) => {
          if (dataUrl === null) {
            setNote(t('invalid'));
            return;
          }
          report(setImage(dataUrl));
        });
      };

      const imageRow = h('div', { className: 'gs-row' },
        h('input', {
          className: 'gs-input',
          type: 'text',
          value: draft,
          placeholder: t('placeholder'),
          'aria-label': t('placeholder'),
          onChange: (event) => { setDraft(event.target.value); },
          onKeyDown: (event) => { if (event.key === 'Enter') applyUrl(); },
        }),
        h('button', { className: 'gs-btn', type: 'button', onClick: applyUrl }, t('apply')),
        h('button', {
          className: 'gs-btn',
          type: 'button',
          onClick: () => { if (file.current) file.current.click(); },
        }, t('file')),
        h('input', {
          ref: file,
          className: 'gs-file',
          type: 'file',
          accept: 'image/*',
          onChange: onFile,
        }),
        state.image === '' ? null : h('button', {
          className: 'gs-btn gs-ghost',
          type: 'button',
          onClick: () => { setImage(''); setNote(''); },
        }, t('reset')));

      const tintGroup = state.image === ''
        ? null
        : h('div', { className: 'gs-group' },
          h('div', { className: 'gs-groupTitle' }, t('tintTitle')),
          h('div', { className: 'gs-groupHint' }, t('tintHint')),
          h('div', { className: 'gs-row' },
            h('label', { className: 'gs-slider' },
              h('span', null, t('tint')),
              h('input', {
                type: 'range',
                min: TINT_MIN,
                max: TINT_MAX,
                step: 1,
                value: state.tint,
                'aria-label': t('tint'),
                onChange: (event) => { setTint(Number(event.target.value)); },
              }),
              h('span', { className: 'gs-value' }, state.tint + '%'))));

      const slider = (label, value, onChange) => h('div', { className: 'gs-row' },
        h('label', { className: 'gs-slider' },
          h('span', null, label),
          h('input', {
            type: 'range',
            min: PANEL_MIN,
            max: PANEL_MAX,
            step: 1,
            value,
            'aria-label': label,
            onChange: (event) => { onChange(Number(event.target.value)); },
          }),
          h('span', { className: 'gs-value' }, value + '%')));

      const panelGroup = h('div', { className: 'gs-group' },
        h('div', { className: 'gs-groupTitle' }, t('panelTitle')),
        h('div', { className: 'gs-groupHint' }, t('panelHint')),
        slider(t('leftPanel'), state.leftPanel, (value) => { setPanel('left', value); }),
        slider(t('rightPanel'), state.rightPanel, (value) => { setPanel('right', value); }));

      const appearanceGroup = h('div', { className: 'gs-group' },
        h('div', { className: 'gs-groupTitle' }, t('appearanceTitle')),
        h('div', { className: 'gs-groupHint' }, t('appearanceHint')),
        h('div', { className: 'gs-row' },
          h('button', {
            className: mode === 'dark' ? 'gs-btn gs-active' : 'gs-btn',
            type: 'button',
            'aria-pressed': mode === 'dark',
            onClick: () => { setMode('dark'); },
          }, t('dark')),
          h('button', {
            className: mode === 'light' ? 'gs-btn gs-active' : 'gs-btn',
            type: 'button',
            'aria-pressed': mode === 'light',
            onClick: () => { setMode('light'); },
          }, t('light'))));

      return h('div', { className: 'gs-page' },
        h('div', { className: 'gs-intro' }, t('description')),
        appearanceGroup,
        h('div', { className: 'gs-group' },
          h('div', { className: 'gs-groupTitle' }, t('imageTitle')),
          h('div', { className: 'gs-groupHint' }, t('imageHint')),
          imageRow,
          note === '' ? null : h('div', { className: 'gs-note' }, note)),
        panelGroup,
        tintGroup);
    }

    /** Renders nothing: occupies the shell's Appearance cell so it disappears. */
    function Blank() {
      return null;
    }

    const ROW_NS = 'settings.glassSkin';
    const ROW_DICTS = {
      en: {
        nav: 'Glass skin',
        title: 'Glass skin',
        description: 'The wallpaper stays sharp; controls, popovers and messages are frosted glass on top of it.',
        imageTitle: 'Canvas image',
        imageHint: 'Pick a local image or paste an image URL. Leave it empty to keep the built-in aurora gradient.',
        placeholder: 'https://…',
        apply: 'Use URL',
        file: 'Choose file',
        reset: 'Use gradient',
        tintTitle: 'Tint',
        tintHint: 'Darkens the photo so text stays readable. 0 % leaves the photo untouched.',
        tint: 'Tint',
        appearanceTitle: 'Appearance',
        appearanceHint: 'The skin switches the whole palette; the shell light/dark row stays hidden.',
        dark: 'Dark',
        light: 'Light',
        panelTitle: 'Open side panels',
        panelHint: 'How strong the glass is on an expanded left or right sidebar; collapsed rails stay transparent.',
        leftPanel: 'Left sidebar',
        rightPanel: 'Right sidebar',
        invalid: 'That does not look like an image. Use http://, https:// or choose a file.',
        tooLarge: 'Image too large — it applies now but will not survive a reload.',
      },
      zh: {
        nav: '玻璃皮肤',
        title: '玻璃皮肤',
        description: '壁纸保持清晰；控件、弹层与消息是浮在照片上的磨砂玻璃。',
        imageTitle: '画布图片',
        imageHint: '选择本地图片或粘贴图片 URL；留空则使用内置极光渐变。',
        placeholder: 'https://…',
        apply: '用此 URL',
        file: '选择文件',
        reset: '恢复渐变',
        tintTitle: '浓度',
        tintHint: '压暗照片以保住正文可读性；0% 完全不压。',
        tint: '浓度',
        appearanceTitle: '外观',
        appearanceHint: '切换会连同文字配色一起换；官方那一行仍然隐藏。',
        dark: '深色',
        light: '浅色',
        panelTitle: '展开的侧边栏',
        panelHint: '左右侧边栏展开时玻璃的强度；收起后保持透明。',
        leftPanel: '左侧栏',
        rightPanel: '右侧栏',
        invalid: '这不像图片，请用 http://、https:// 或直接选择文件。',
        tooLarge: '图片较大，本次生效但刷新后不会保留。',
      },
    };

    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        ctx.theme.overrideTokens('glass-skin', TOKENS);
        /* The skin owns the light/dark choice through its own settings page: the
           switch writes the shell preference, so the palette the glass is tuned
           against and the text colours always come from the same place. */
        themeSeat = ctx.theme;
        try {
          publishMode(ctx.theme.getTheme().active.colorScheme === 'light' ? 'light' : 'dark');
          ctx.effect(() => ctx.on('theme/change', (snapshot) => {
            publishMode(snapshot.active.colorScheme === 'light' ? 'light' : 'dark');
          }));
        } catch (error) {
          console.warn('[glass-skin] theme preference unavailable', error);
        }
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'glass-skin',
          order: -1000,
        }, GlassSkinStyle));
        /* The skin must survive a settings-side failure: style and tokens are
           already live at this point. */
        try {
          ctx.effect(() => ctx.locale.register(ROW_NS, ROW_DICTS));
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: 'glass-skin',
            order: 50,
            label: () => ctx.locale.bind(ROW_NS)('nav'),
            locale: ROW_NS,
          }, GlassSettings));
          /* Take over the shell's Appearance row (light / dark / system): this
             skin is tuned for one look, so the switch would only expose a
             palette that is not finished. Reusing the shipped cell id replaces
             that row; unloading the plugin gives it back. */
          ctx.slots.inject('settings.general.item', () => ctx.slots.register({
            name: 'settings.general.item',
            id: 'appearance',
            order: 10,
          }, Blank));
        } catch (error) {
          console.warn('[glass-skin] settings page unavailable', error);
        }
      },
    };
  },
});
