# CSS Architecture Guide

## Overview

The EMRsim Chat application uses a modular CSS architecture that separates concerns by feature area and functionality. This document explains the structure and provides guidelines for maintaining and extending the styles.

## File Structure

```
frontend/src/styles/
├── index.css                    # Entry point (imports brand, chat, and app)
├── brand.css                    # Brand tokens and design system
├── chat.css                     # Chat interface specific styles
├── app.css                      # Main index file (imports feature modules)
├── layout.css                   # Application layout and structure
├── components.css               # Reusable UI components
├── voice.css                    # Voice feature styles
├── modals.css                   # Modal and dialog components
├── sps.css                      # Simulated Patient System drawer
├── animations.css               # Keyframe animations and transitions
└── legacy-casebuilder.css       # Deprecated Case Builder styles
```

## Module Descriptions

### `brand.css`
**Purpose**: Core design tokens and brand variables.

Contains:
- UND brand colors (`--color-und-green`, etc.)
- Text and surface colors
- Focus and accessibility variables
- High contrast mode overrides
- Global accessibility rules

**When to use**: Reference these variables in all other CSS files. Do not modify unless updating the core design system.

### `layout.css`
**Purpose**: Application-level layout and structure.

Contains:
- App container and header
- Main grid layout
- Sidebar navigation
- Responsive breakpoints

**When to modify**: When changing the overall application structure, grid layout, or adding new major sections.

### `components.css`
**Purpose**: Reusable UI components used throughout the app.

Contains:
- Buttons (send-button, persona-button)
- Input forms
- Chips and badges
- Banners (error, warning)
- Event log
- Dropdown menus
- Toast notifications
- Connection overlay

**When to modify**: When adding new shared components or updating existing component styles.

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

### `legacy-casebuilder.css`

**Purpose**: Deprecated Case Builder feature styles.

Contains:

- Case builder UI components
- AI banner styles
- Choice grid layout

**When to modify**: These styles are maintained for backward compatibility. Consider removing if the Case Builder feature is fully deprecated.

## Design Tokens

### Spacing Scale

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 0.75rem;   /* 12px */
--space-lg: 1rem;      /* 16px */
--space-xl: 1.5rem;    /* 24px */
--space-2xl: 2rem;     /* 32px */
```

### Border Radius

```css
--radius-sm: 0.375rem; /* 6px */
--radius-md: 0.5rem;   /* 8px */
--radius-lg: 0.75rem;  /* 12px */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
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

## Import Order

The `index.css` entry point is imported by `main.tsx` and ensures the global token files load before application-specific modules. It loads `brand.css`, followed by `chat.css`, and finally `app.css`.

Within `app.css`, feature modules are imported in this specific order:

1. **Layout** - Foundation structure
2. **Components** - Reusable UI elements
3. **Voice** - Feature-specific styles
4. **Modals** - Overlay components
5. **SPS** - Advanced control panel
6. **Animations** - Visual effects
7. **Legacy** - Deprecated styles

This order prevents specificity conflicts and ensures proper style inheritance.

## Adding New Styles

### For a New Feature

1. Create a new CSS file in `src/styles/`
2. Import it in `app.css` at the appropriate position
3. Update this documentation

### For Existing Features

1. Identify the appropriate module
2. Add styles following existing patterns
3. Use design tokens from `brand.css`
4. Test across browsers

## Browser Compatibility

All styles include necessary vendor prefixes for:

- Safari/WebKit (`-webkit-`)
- Firefox (`-moz-`)
- Legacy IE (`-ms-`)

Critical features with fallbacks:

- `backdrop-filter` (modals)
- `user-select` (interactive elements)

## Migration from App.css

The original monolithic `App.css` has been refactored into this modular structure and removed from the codebase. Legacy backup files have also been deleted; continue all styling work inside the modular files.

### What Changed

- ✅ Split into modular feature files
- ✅ Introduced `index.css` as the central entry point
- ✅ Replaced hardcoded values with CSS variables
- ✅ Added vendor prefixes for Safari
- ✅ Improved naming consistency
- ✅ Added responsive design improvements
- ✅ Enhanced accessibility support

## Questions?

For questions about the CSS architecture, contact the development team or open an issue in the project repository.
