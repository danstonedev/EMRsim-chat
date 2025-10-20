# CSS Architecture Guide

## Overview

The EMRsim Chat application uses a modular CSS architecture that separates concerns by feature area and functionality. This document explains the structure and provides guidelines for maintaining and extending the styles.

## File Structure

``` text
frontend/src/styles/
├── index.css                    # Cascade-layered entry point
├── base.css                     # Global reset and base primitives
├── brand.css                    # Design tokens and theme palettes
├── fonts.css                    # Typography tokens and utilities
├── layout.css                   # Application layout and structure
├── components.css               # Reusable UI components
├── chat.css                     # Chat feature glue styles
├── chat/                        # Chat submodules (shell, header, etc.)
├── voice.css                    # Voice feature styles
├── voice-ready-toast.css        # Voice toast micro-component
├── modals.css                   # Modal and dialog components
├── sps.css                      # Simulated Patient System drawer
├── viewer3d.css                 # 3D viewer overrides
└── animations.css               # Keyframe animations and transitions
```

## Module Descriptions

### `brand.css`

**Purpose**: Root design tokens and theme palettes exposed through cascade layers.

Contains:

- UND brand palette (`--color-und-green`, accents, semantic states)
- Surface, text, and border tokens for light/dark/high-contrast themes
- Font stacks (`--font-sans`, `--font-heading`, `--font-mono`)
- Radius, spacing, and shadow scales
- Focus ring defaults

**When to use**: Reference these variables from every other stylesheet. Update only when adjusting the core design system or theming requirements.

### `fonts.css`

**Purpose**: Typography token definitions and helper utilities.

Contains:

- Root font families (`--font-sans`, `--font-heading`, `--font-mono`)
- Root font-size scale helpers (`--font-size-root`, `--font-size-sm`, etc.)
- `.bruno-ace-regular` utility used by the header branding

**When to modify**: When adding new typography tokens or updating the brand headline font.

### `layout.css`

**Purpose**: Application-level structure scoped to the `layout` cascade layer.

Contains:

- App root container, sticky header, and main grid
- Sidebar and chat surface scaffolding
- Responsive breakpoints
- Logical property usage to support RTL/localization in the future

**When to modify**: When adjusting shell structure, responsive grid behavior, or adding new top-level sections.

### `components.css`

**Purpose**: Reusable UI components used throughout the app, scoped to the `components` layer.

Contains:

- Form controls and message composer wiring
- Persona buttons, chips, banners, toasts, and overlays
- Event log styling with monospace defaults
- Shared dropdown and popover primitives

**When to modify**: When adding new shared UI primitives or refreshing existing component patterns.

### `voice.css`

**Purpose**: All voice-related UI components and controls.

Contains:

- Voice bar and microphone button
- Voice status indicators
- Audio level meters
- Adaptive VAD badges
- Mic action popover
- Recording pill UI
- Voice ready toast notification

**When to modify**: When adding voice features or modifying voice-related UI.

### `modals.css`

**Purpose**: Modal dialogs and overlay components.

Contains:

- Encounter end modal
- Modal backdrops
- Modal animations

**When to modify**: When adding new modals or dialog components.

### `sps.css`

**Purpose**: Simulated Patient System (SPS) advanced control panel.

Contains:

- SPS drawer layout
- Configuration forms
- State displays
- Gate flags
- Phase controls

**When to modify**: When extending SPS functionality or improving the control panel UI.

### `animations.css`

**Purpose**: Keyframe animations and transition definitions.

Contains:

- Fade in/out animations
- Slide animations
- Skeleton loading states
- Reduced motion overrides

**When to modify**: When adding new animations or loading states.

## Design Tokens

### Spacing Scale

```css
--space-2xs: 0.125rem; /* 2px */
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 0.75rem;   /* 12px */
--space-lg: 1rem;      /* 16px */
--space-xl: 1.5rem;    /* 24px */
--space-2xl: 2rem;     /* 32px */
```

### Border Radius

```css
--radius-xs: 0.25rem;  /* 4px */
--radius-sm: 0.375rem; /* 6px */
--radius-md: 0.5rem;   /* 8px */
--radius-lg: 0.75rem;  /* 12px */
--radius-xl: 1rem;     /* 16px */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(17, 17, 17, 0.06);
--shadow-md: 0 4px 12px rgba(17, 17, 17, 0.08);
--shadow-lg: 0 20px 40px rgba(17, 17, 17, 0.12);
```

## Best Practices

### 1. Use CSS Variables

Always use design tokens instead of hardcoded values:

```css
/* ✅ Good */
.button {
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  color: var(--color-und-green);
}

/* ❌ Bad */
.button {
  padding: 12px;
  border-radius: 6px;
  color: #009A44;
}
```

### 2. Choose the Right Module

- **Layout changes** → `layout.css`
- **New reusable component** → `components.css`
- **Voice feature** → `voice.css`
- **New modal** → `modals.css`
- **Animation** → `animations.css`

### 3. Follow Naming Conventions

- Use BEM methodology for component classes:
  - Block: `.voice-bar`
  - Element: `.voice-bar__status`
  - Modifier: `.voice-bar--active`

### 4. Accessibility First

- Always include focus states
- Support `prefers-reduced-motion`
- Support `prefers-contrast: high`
- Use semantic HTML with appropriate ARIA labels

### 5. Mobile Responsive

- Use mobile-first approach
- Include responsive breakpoints where needed
- Test on various screen sizes

## Cascade Layers & Import Order

`index.css` is imported once in `main.tsx` and declares the global cascade layer order:

```css
@layer reset, tokens, typography, layout, components, features, utilities, animations;
```

Each subsequent `@import` attaches a stylesheet to the appropriate layer so that foundational rules always win over feature-specific ones. The current structure:

- `base.css` → `reset`
- `brand.css` → `tokens`
- `fonts.css` → `typography`
- `layout.css` → `layout`
- `components.css` → `components`
- Chat/voice/modals/SPS/viewer styles → `features`
- `animations.css` → `animations`

Adding a new feature file? Import it inside `index.css` with the correct `layer(...)` qualifier to maintain order.

## Adding New Styles

### For a New Feature Module

1. Create a CSS file in `src/styles/` (or within `src/styles/<feature>/`).
2. Use design tokens from `brand.css` and existing utility patterns.
3. Import it in `index.css` with `@import './path.css' layer(features);` (or another suitable layer).
4. Update this document if the structure changes.

### For Existing Modules

1. Modify the relevant stylesheet, leaning on tokens and existing class patterns.
2. Prefer logical properties (`margin-inline`) where feasible.
3. Test across breakpoints, high-contrast mode, and reduced-motion preferences.

## Browser Compatibility

We target modern evergreen browsers. When using advanced properties (e.g., `backdrop-filter`) always provide sensible fallbacks and vendor-prefixed variants where required (`-webkit-backdrop-filter`).

## Migration Notes

- The legacy `app.css` aggregator and `chat/_index.css` have been removed.
- All feature modules now import through `index.css` with cascade layers.
- Shared banners, voice warnings, and other primitives live in `components.css` to avoid duplication.
- ✅ Improved naming consistency
- ✅ Added responsive design improvements
- ✅ Enhanced accessibility support

## Questions?

For questions about the CSS architecture, contact the development team or open an issue in the project repository.
