# Frontend Architecture Guide

**Last Updated:** October 18, 2025  
**Status:** Phase 1 Complete ✅

---

## Overview

The EMRsim Chat frontend is a React + TypeScript application built with Vite. This document describes the organizational structure, architectural decisions, and guidelines for maintaining and extending the codebase.

## Directory Structure

```
frontend/src/
├── app/                          # Application shell & routing
│   ├── App.tsx                  # Main app component (entry point)
│   └── AppRouter.tsx            # Route definitions
│
├── pages/                        # Route-level page components
│   ├── ChatPage.tsx             # Main chat/voice interface (formerly App.tsx)
│   ├── CaseBuilderPage.tsx      # Case authoring tool
│   ├── Viewer3D.tsx             # 3D anatomy viewer
│   ├── MiniViewer3D.tsx         # Compact 3D viewer
│   ├── CaseBuilder.tsx          # Case builder logic
│   ├── chatShared.ts            # Shared chat types
│   ├── components/              # Page-specific components
│   │   ├── chat/                # Chat-related components
│   │   ├── viewer/              # 3D viewer components
│   │   ├── connection/          # Connection status
│   │   ├── advancedSettings/    # Settings drawer
│   │   └── ...
│   └── v2/                      # Experimental/next-gen pages
│
├── features/                     # Domain-specific features
│   └── voice/                   # Voice chat feature module
│       ├── components/
│       ├── hooks/
│       └── services/
│
├── shared/                       # Shared/common code
│   ├── api/                     # Public API facades
│   ├── hooks/                   # Reusable React hooks
│   ├── services/                # Business logic services
│   ├── managers/                # State managers
│   ├── coordinators/            # Cross-cutting coordination
│   ├── dispatchers/             # Event routing
│   ├── handlers/                # Domain event handlers
│   ├── configurators/           # Subsystem configuration
│   ├── factories/               # Object creation
│   ├── orchestrators/           # Complex workflows
│   ├── transport/               # Network transport layer
│   ├── realtime/                # Real-time communication
│   ├── endpointing/             # Voice endpointing
│   ├── transcript/              # Transcript processing
│   ├── viewer/                  # 3D viewer utilities
│   ├── integration/             # External integrations
│   ├── utils/                   # Utility functions
│   ├── types/                   # Shared TypeScript types
│   ├── ConversationController.ts # Main conversation orchestrator
│   ├── useVoiceSession.ts       # Voice session hook
│   ├── settingsContext.tsx      # Settings provider
│   ├── ErrorBoundary.tsx        # Error boundary component
│   ├── api.ts                   # API client
│   ├── flags.ts                 # Feature flags
│   ├── telemetry.ts             # Telemetry/logging
│   └── __mocks__/               # Test mocks
│
├── styles/                       # CSS architecture (modular)
│   ├── index.css                # Entry point (cascade layers)
│   ├── base.css                 # Reset & primitives
│   ├── brand.css                # Design tokens & theme
│   ├── fonts.css                # Typography
│   ├── layout.css               # App layout structure
│   ├── components.css           # Reusable UI components
│   ├── chat.css                 # Chat feature styles
│   ├── chat/                    # Chat submodules
│   ├── voice.css                # Voice UI styles
│   ├── modals.css               # Modals & dialogs
│   ├── sps.css                  # SPS drawer
│   ├── viewer3d.css             # 3D viewer overrides
│   ├── animations.css           # Keyframes & transitions
│   └── CSS_ARCHITECTURE.md      # CSS documentation
│
├── tokens/                       # Animation & media metadata
├── test/                         # Test utilities & helpers
├── types/                        # Global TypeScript types
├── main.tsx                      # Application entry point
└── vite-env.d.ts                # Vite TypeScript declarations
```

---

## Architectural Principles

### 1. **Separation of Concerns**

- **`app/`**: Application shell, routing, and top-level providers
- **`pages/`**: Route-level components (what users navigate to)
- **`features/`**: Self-contained feature modules with their own components, hooks, and logic
- **`shared/`**: Truly shared code used across multiple features

### 2. **Feature-Based Organization** (Future Direction)

As the app grows, we'll move toward feature-based organization:

```
features/
  chat/          # Chat feature
    components/
    hooks/
    services/
    ChatPage.tsx
  
  voice/         # Voice feature (already exists)
    components/
    hooks/
    services/
  
  viewer3d/      # 3D viewer feature
    components/
    hooks/
    Viewer3DPage.tsx
  
  case-builder/  # Case builder feature
    components/
    hooks/
    CaseBuilderPage.tsx
```

### 3. **Clear Dependencies**

- **App** → depends on Pages
- **Pages** → depend on Features & Shared
- **Features** → depend on Shared (not on other Features)
- **Shared** → no dependencies on Pages or Features

### 4. **CSS Architecture**

Our CSS follows a modular, cascade-layered architecture:

- **Cascade layers** for proper specificity management
- **Design tokens** (`brand.css`) for theming
- **Feature-specific modules** (voice, chat, viewer3d)
- **Reusable components** (`components.css`)

See `src/styles/CSS_ARCHITECTURE.md` for full details.

---

## Key Decisions & Rationale

### Why `app/` directory?

**Problem**: The main `App.tsx` component was buried in `pages/`, which was confusing because:
- `pages/` should contain route-level components
- The main app shell shouldn't be considered a "page"

**Solution**: Create `app/` directory for:
- Application entry point (`App.tsx`)
- Route configuration (`AppRouter.tsx`)
- Future: Global providers, layouts, error boundaries

### Why rename `App.tsx` → `ChatPage.tsx`?

**Problem**: The component in `pages/App.tsx` was actually the **chat page**, not the app shell.

**Solution**: Renamed to `ChatPage.tsx` for clarity. This makes it obvious:
- This is a route-level page
- It's the chat/voice interface page
- The real app entry is now `app/App.tsx`

### Why separate `shared/` so deeply?

**Context**: The `shared/` directory contains modularized business logic from the ConversationController refactoring (Phases 1-9).

**Structure**:
- **api/**: Public API facades
- **handlers/**: Domain event processing
- **dispatchers/**: Event routing
- **coordinators/**: Cross-cutting coordination
- **managers/**: State management
- **orchestrators/**: Complex workflows
- **transport/**: Network layer
- **services/**: Business logic

This deep structure prevents the "junk drawer" anti-pattern and makes dependencies explicit.

---

## Migration Status

### ✅ Phase 1: App Shell Reorganization (Complete)

**Date**: October 18, 2025

**Changes**:
1. Created `app/` directory
2. Moved `AppRouter.tsx` → `app/AppRouter.tsx`
3. Renamed `pages/App.tsx` → `pages/ChatPage.tsx`
4. Created new `app/App.tsx` as main entry point
5. Updated all imports and tests

**Files Modified**:
- Created: `app/App.tsx`
- Created: `app/AppRouter.tsx`
- Created: `pages/ChatPage.tsx`
- Modified: `main.tsx`
- Modified: `pages/App.caseSetup.test.tsx`
- Deleted: `AppRouter.tsx` (old location)
- Deleted: `pages/App.tsx` (old name)

**Tests**: ✅ All passing  
**Type Check**: ✅ No errors

### 🔄 Phase 2: Feature Consolidation (Planned)

**Goal**: Move page-specific components into feature directories

**Changes**:
- Create `features/chat/` and move chat-specific logic
- Create `features/viewer3d/` for 3D viewer
- Create `features/case-builder/` for case authoring
- Move `pages/components/` to appropriate features

### 🔄 Phase 3: Core Extraction (Planned)

**Goal**: Extract core business logic from `shared/`

**Changes**:
- Create `core/` directory for business logic
- Move `ConversationController` → `core/conversation/`
- Move realtime/transport to `core/`
- Keep only truly shared code in `shared/`

---

## Naming Conventions

### Files & Directories

- **Pages**: `PascalCase.tsx` (e.g., `ChatPage.tsx`, `Viewer3D.tsx`)
- **Components**: `PascalCase.tsx` (e.g., `VoiceControls.tsx`)
- **Hooks**: `camelCase.ts` (e.g., `useVoiceSession.ts`)
- **Utilities**: `camelCase.ts` (e.g., `chatShared.ts`)
- **Types**: `types.ts` or `index.ts` in directories
- **Tests**: `*.test.tsx` or `*.spec.ts`

### Directories

- Use **kebab-case** for multi-word directories (e.g., `case-builder/`)
- Use **camelCase** for single-word directories (e.g., `hooks/`, `services/`)

---

## Import Path Aliases (Future Enhancement)

To improve import clarity, we plan to add TypeScript path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@/app/*": ["./src/app/*"],
      "@/pages/*": ["./src/pages/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/styles/*": ["./src/styles/*"]
    }
  }
}
```

**Benefits**:
- Cleaner imports: `import { api } from '@/shared/api'`
- No relative path hell: `../../../shared/api`
- Easier refactoring

---

## Best Practices

### When Adding New Code

1. **Is it a new route?** → Add to `pages/`
2. **Is it chat-specific?** → Add to `pages/components/chat/` (or future `features/chat/`)
3. **Is it voice-specific?** → Add to `features/voice/`
4. **Is it truly shared?** → Add to `shared/` (appropriate subdirectory)
5. **Is it a reusable hook?** → Add to `shared/hooks/`
6. **Is it styling?** → Add to `styles/` (follow CSS architecture)

### When Refactoring

- **Don't break imports**: Update all references when moving files
- **Run type-check**: `npm run type-check` after major changes
- **Run tests**: `npm test` to ensure nothing broke
- **Update this doc**: Keep architecture documentation current

### Component Organization

**Good** ✅:
```tsx
pages/
  ChatPage.tsx              # Route component
  components/
    chat/
      MessageList.tsx       # Chat-specific component
```

**Avoid** ❌:
```tsx
shared/
  MessageList.tsx           # Don't put page-specific stuff in shared
```

---

## CSS Architecture

See `src/styles/CSS_ARCHITECTURE.md` for complete CSS documentation.

**Quick Reference**:
- **Entry**: `index.css` (imports all modules with cascade layers)
- **Tokens**: `brand.css` (colors, fonts, spacing)
- **Layout**: `layout.css` (app structure, grid)
- **Components**: `components.css` (reusable UI)
- **Features**: `voice.css`, `chat.css`, `viewer3d.css`

---

## Testing Strategy

### Unit Tests
- Place tests next to the code they test
- Use `*.test.tsx` or `*.spec.ts` naming
- Mock external dependencies

### Integration Tests
- Located in `test/` or `__tests__/` directories
- Test feature workflows end-to-end

### E2E Tests
- Located in workspace root `e2e/`
- Use Playwright for full user flows

---

## Related Documentation

- **CSS Architecture**: `src/styles/CSS_ARCHITECTURE.md`
- **Conversation Controller**: `../CONVERSATION_CONTROLLER_REFERENCE.md`
- **3D Viewer**: `../3D_VIEWER_START_HERE.md`
- **Testing Guide**: `../TESTING_GUIDE.md`
- **Quick Reference**: `../QUICK_REFERENCE.md`

---

## Questions?

For questions about frontend architecture:
- Check this document first
- Review `CSS_ARCHITECTURE.md` for styling questions
- See `CONVERSATION_CONTROLLER_REFERENCE.md` for voice/conversation logic
- Open an issue or ask the development team

---

**Next Steps**:
1. ✅ Phase 1 complete (app shell reorganization)
2. ⏳ Phase 2: Feature consolidation (move components to features)
3. ⏳ Phase 3: Core extraction (create `core/` directory)
4. ⏳ Add TypeScript path aliases for cleaner imports
5. ⏳ Continue modularization as codebase grows
