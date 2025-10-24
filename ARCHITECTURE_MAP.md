# EMRsim-chat Architecture Map

**Generated:** 2025-10-22  
**Purpose:** Complete navigation, routing, and API architecture reference

---

## 🎯 Summary of Navigation Improvements

### ✅ Fixed Issues
1. **Added HomePage/Landing Page** - Clear entry point with two mode cards
2. **Removed DemoPage** - Simplified to just Full Simulation and 3D Viewer
3. **Fixed Hardcoded Navigation** - Replaced `<a href>` with React Router `<Link>` in CaseSetupHeader
4. **Updated Default Route** - `/` now shows HomePage with clear options
5. **Improved Back Navigation** - Viewer3D uses `navigate(-1)` instead of hardcoded `/voice`

### Current Routes (Updated)
```typescript
/                   → HomePage (landing with two cards)
/voice              → ChatPage (full SPS experience)
/3d-viewer          → Viewer3D (anatomy viewer)
/transcript/:id     → TranscriptPage (session transcript)
*                   → Navigate to / (404 fallback)
```

### Navigation Components
- **HomePage** - New landing page with mode selection cards
- **CaseSetupHeader** - Uses React Router `<Link>` (brand links to `/`, 3D Viewer links properly)
- **Viewer3D** - Close button uses `navigate(-1)` for proper back navigation

---

## 🎯 Critical Issues Identified ~~(FIXED)~~

### ~~Navigation Problems~~ ✅ RESOLVED
1. ~~**Inconsistent Default Route**~~ → Now defaults to HomePage
2. ~~**Missing DemoPage Route**~~ → DemoPage removed (not needed)
3. ~~**Hardcoded Navigation**~~ → Fixed with React Router Links
4. ~~**No Unified Navigation**~~ → CaseSetupHeader standardized
5. ~~**Dead Route Reference**~~ → Cleaned up

---

## 📱 Frontend Architecture

### Entry Point Flow
```
index.html
  └─ main.tsx
      └─ <ErrorBoundary>
          └─ <SettingsProvider>
              └─ <App>
                  └─ <AppRouter>
```

### Routing Structure (AppRouter.tsx)

#### Current Routes
```typescript
/voice              → ChatPage (full SPS experience)
/3d-viewer          → Viewer3D (lazy-loaded anatomy viewer)
/transcript/:id     → TranscriptPage (lazy-loaded transcript viewer)
/                   → Navigate to /3d-viewer ⚠️
*                   → Navigate to /3d-viewer ⚠️
```

#### Missing Routes
```typescript
/demo               → DemoPage ❌ NOT REGISTERED
/builder            → CaseBuilderPage ❌ REMOVED (comment mentions removal)
/                   → No landing/home page
```

---

## 🎨 Page Components

### 1. ChatPage (`/voice`)
**Purpose:** Full-featured standardized patient simulation with persona/scenario selection

**Key Features:**
- Persona dropdown (patient selection)
- Scenario dropdown (clinical case selection)
- Voice controls (start/pause/stop)
- Chat message history
- 3D anatomy viewer integration (embedded)
- Advanced settings drawer
- Diagnostics drawer
- Media modal for images/videos
- Session lifecycle management

**Navigation Elements:**
- Header: `<CaseSetupHeader>`
  - Brand: "VSPx"
  - Links: "3D Viewer" (hardcoded `<a href="/3d-viewer">`)
  - Button: "Diagnostics" (opens drawer)

**State Management:**
- 10+ custom hooks (useBackendData, useUIState, useMessageQueue, etc.)
- Complex orchestration of voice/text/media

**Layout:**
```
┌─────────────────────────────────────┐
│ CaseSetupHeader (nav)               │
├─────────────────────────────────────┤
│ Persona/Scenario Selectors          │
├─────────────────────────────────────┤
│ Chat Messages (with 3D viewer side) │
├─────────────────────────────────────┤
│ Voice Controls (mic button)         │
└─────────────────────────────────────┘
```

---

### 2. DemoPage (`/demo` - NOT ROUTED)
**Purpose:** Simplified preset demo with Riley Summers ACL scenario

**Key Features:**
- Hardcoded persona: `ash-riley-summers`
- Hardcoded scenario: `prsn_acl_preop_v1`
- No selectors (preset case)
- Simplified header
- Voice controls only (no text chat)
- Minimal UI

**Navigation Elements:**
- Custom header (not shared component)
  - Title: "VSPx Demo"
  - Patient name display
  - No navigation links ⚠️

**State Management:**
- Subset of ChatPage hooks
- Auto-creates session on mount

**Layout:**
```
┌─────────────────────────────────────┐
│ Demo Header (patient name)          │
├─────────────────────────────────────┤
│ Chat Messages                        │
├─────────────────────────────────────┤
│ Mic Control                          │
└─────────────────────────────────────┘
```

---

### 3. Viewer3D (`/3d-viewer`)
**Purpose:** Full-screen 3D anatomy viewer with animation controls

**Key Features:**
- 3D canvas (React Three Fiber)
- Animation selection (via modal)
- Playback controls
- Camera controls
- Can be embedded in ChatPage

**Navigation Elements:**
- `<ViewerControls>` overlay
  - Close button → `navigate('/voice')` ⚠️

**Props:**
- `embedded?: boolean` (changes behavior)
- `initialAnimationId?: string` (preset animation)
- `onClose?: () => void` (custom close handler)

**Layout:**
```
┌─────────────────────────────────────┐
│ ViewerControls (floating)           │
│   [Close Button]                    │
│                                     │
│                                     │
│     3D Canvas (full screen)         │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

---

### 4. TranscriptPage (`/transcript/:sessionId`)
**Purpose:** Printable transcript viewer for completed sessions

**Key Features:**
- Fetches turns from `/api/sessions/:id/turns`
- Print-optimized layout
- Student/Patient role labels
- Error handling for missing sessions

**Navigation Elements:**
- Print button only
- No back navigation ⚠️

**Layout:**
```
┌─────────────────────────────────────┐
│ Session Transcript                  │
│ Date: [auto]                        │
│ [Print Button]                      │
├─────────────────────────────────────┤
│ Student: [text]                     │
│ Patient: [text]                     │
│ ...                                 │
└─────────────────────────────────────┘
```

---

## 🔌 Backend API Architecture

### Base URL
```
Development: http://localhost:3002
Production: Railway/Azure/Vercel deployment
```

### Middleware Stack
```
1. CORS (dynamic origins + Vercel *.vercel.app)
2. Helmet (security headers)
3. Rate Limiting (production only)
4. Body Parser (1MB JSON limit)
5. Correlation ID
6. Request Context (AsyncLocalStorage)
7. Performance Tracking
8. Request Logger
```

---

## 📡 API Endpoints

### Health & Metrics
```http
GET  /api/health              # Health check + feature flags
GET  /metrics                 # Prometheus metrics (plain text)
GET  /api/metrics             # JSON metrics
GET  /api-docs                # Swagger UI
```

**Response Example (`/api/health`):**
```json
{
  "ok": true,
  "uptime_s": 1234,
  "db": "sqlite_memory",
  "openai": "ok",
  "storage": "memory",
  "features": {
    "voiceEnabled": true,
    "spsEnabled": true,
    "voiceDebug": false
  }
}
```

---

### Session Management (`/api/sessions`)

#### Create Session
```http
POST /api/sessions
Content-Type: application/json

{
  "persona_id": "ash-riley-summers",
  "scenario_id": "prsn_acl_preop_v1",
  "mode": "sps"
}

→ 201 Created
{
  "session_id": "uuid-string",
  "sps_session_id": "sps-uuid",
  "phase": "greeting",
  "gate": { ... }
}
```

#### End Session
```http
POST /api/sessions/:id/end

→ 200 OK
{
  "summary": "...",
  "metrics": { ... }
}
```

#### Get Turns (History)
```http
GET /api/sessions/:id/turns

→ 200 OK
{
  "turns": [
    {
      "id": "uuid",
      "role": "user",
      "text": "Hello",
      "created_at": "ISO-8601",
      "timestamp": 1234567890
    },
    ...
  ]
}
```

#### Save SPS Turns
```http
POST /api/sessions/:id/sps/turns
Content-Type: application/json

{
  "turns": [
    {
      "role": "user",
      "text": "...",
      "channel": "audio",
      "timestamp_ms": 1234567890
    }
  ]
}

→ 200 OK
{
  "ok": true,
  "saved": 5,
  "duplicates": 0
}
```

#### Update Phase
```http
POST /api/sessions/:id/sps/phase
Content-Type: application/json

{
  "phase": "assessment",
  "gate": { "greeting_done": true }
}

→ 200 OK
```

#### Get Transcript (HTML)
```http
GET /api/sessions/:id/transcript

→ 200 OK (text/html)
<html>...</html>
```

---

### Voice Operations (`/api/voice`)

#### Get Voice Token
```http
POST /api/voice/token
Content-Type: application/json

{
  "session_id": "uuid",
  "voice": "alloy",           // optional override
  "input_language": "en",     // optional
  "reply_language": "default" // optional
}

→ 200 OK
{
  "rtc_token": "ephemeral-token-string",
  "model": "gpt-4o-realtime-preview",
  "tts_voice": "alloy",
  "persona": { ... }
}
```

#### Get Instructions
```http
POST /api/voice/instructions
Content-Type: application/json

{
  "session_id": "uuid",
  "phase": "assessment",      // optional
  "gate": { ... }             // optional
}

→ 200 OK
{
  "instructions": "You are Riley Summers...",
  "phase": "assessment",
  "outstanding_gate": ["consent_done"]
}
```

#### WebRTC SDP Exchange
```http
POST /api/voice/sdp
Content-Type: application/json

{
  "session_id": "uuid",
  "sdp": "v=0\r\no=- ..."
}

→ 200 OK (text/plain)
v=0
o=- ...
```

#### Get Available Voices
```http
GET /api/voice/voices

→ 200 OK
{
  "voices": ["alloy", "echo", "fable", ...]
}
```

#### Relay Transcript (Deprecated - use /api/transcript/relay)
```http
POST /api/voice/transcript/relay/:sessionId
POST /api/voice/transcript              # legacy
POST /api/voice/transcript-error        # error reporting
```

---

### Transcript Relay (`/api/transcript`)

#### Relay Transcript (Primary)
```http
POST /api/transcript/relay/:sessionId
Content-Type: application/json

{
  "role": "user",
  "text": "Hello",
  "isFinal": true,
  "timestamp": 1234567890,
  "itemId": "item_xyz",
  "startedAt": 1234567800,
  "emittedAt": 1234567850,
  "finalizedAt": 1234567890,
  "media": null,
  "source": "microphone"
}

→ 204 No Content
```

---

### SPS Content (`/api/sps`)

#### List Personas
```http
GET /api/sps/personas

→ 200 OK
{
  "personas": [
    {
      "id": "ash-riley-summers",
      "display_name": "Riley Summers",
      "headline": "18yo female, ACL injury",
      "age": 18,
      "sex": "F",
      "voice": "alloy",
      "tags": ["orthopedic", "young-adult"]
    },
    ...
  ]
}
```

#### Get Persona by ID
```http
GET /api/sps/personas/:id

→ 200 OK
{
  "persona": { ... }
}
```

#### List Scenarios
```http
GET /api/sps/scenarios

→ 200 OK
{
  "scenarios": [
    {
      "scenario_id": "prsn_acl_preop_v1",
      "title": "ACL Preoperative Assessment",
      "region": "knee",
      "difficulty": "intermediate",
      "setting": "clinic",
      "tags": ["orthopedic", "surgical"],
      "persona_id": "ash-riley-summers",
      "persona_name": "Riley Summers"
    },
    ...
  ]
}
```

#### Get Scenario by ID
```http
GET /api/sps/scenarios/:id

→ 200 OK
{
  "scenario": { ... }
}
```

#### Export Persona + Scenario
```http
GET /api/sps/export?persona_id=X&scenario_id=Y

→ 200 OK (application/json or text/html)
```

#### SPS Catalogs (Reference Data)
```http
GET /api/sps/catalogs/tests/special      # Special tests
GET /api/sps/catalogs/tests/functional   # Functional tests
GET /api/sps/catalogs/interventions      # PT interventions
GET /api/sps/catalogs/outcomes           # Outcome measures
GET /api/sps/catalogs/norms/rom          # Range of motion norms
GET /api/sps/catalogs/safety             # Safety protocols
GET /api/sps/catalogs/protocols          # Treatment protocols
```

#### Debug Endpoints
```http
GET /api/sps/instructions                # List instruction templates
GET /api/sps/debug                       # SPS system debug info
```

---

## 🔄 Navigation Flow Issues

### Current User Journey (Broken)
```
1. User visits /
   ↓
2. Redirected to /3d-viewer
   ↓
3. User sees 3D anatomy viewer (no context!)
   ↓
4. User clicks "Close" button
   ↓
5. Navigate('/voice') → Full ChatPage
```

**Problem:** No clear entry point or explanation of features

---

### Proposed User Journey
```
1. User visits /
   ↓
2. Landing page with options:
   - [Quick Demo] → /demo (preset case)
   - [Full Simulation] → /voice (persona selection)
   - [3D Viewer] → /3d-viewer (anatomy only)
   ↓
3. From any page:
   - Shared navigation header
   - Consistent back/home buttons
```

---

## 🛠️ Recommended Fixes

### 1. Register DemoPage Route
```typescript
// frontend/src/app/AppRouter.tsx
import DemoPage from '../pages/DemoPage'

<Route path="/demo" element={<DemoPage />} />
```

### 2. Create Landing Page
```typescript
// frontend/src/pages/HomePage.tsx
export default function HomePage() {
  return (
    <div className="home-page">
      <h1>VSPx Virtual Standardized Patient</h1>
      <div className="mode-cards">
        <Link to="/demo">
          <ModeCard
            title="Quick Demo"
            description="Try a preset case with Riley Summers"
            icon="🎯"
          />
        </Link>
        <Link to="/voice">
          <ModeCard
            title="Full Simulation"
            description="Choose your patient and scenario"
            icon="🏥"
          />
        </Link>
        <Link to="/3d-viewer">
          <ModeCard
            title="3D Anatomy"
            description="Explore 3D models and animations"
            icon="🦴"
          />
        </Link>
      </div>
    </div>
  )
}
```

### 3. Unified Navigation Component
```typescript
// frontend/src/components/AppNav.tsx
export function AppNav({ currentPage }) {
  return (
    <header className="app-nav">
      <Link to="/" className="brand">VSPx</Link>
      <nav>
        <Link to="/demo" active={currentPage === 'demo'}>Demo</Link>
        <Link to="/voice" active={currentPage === 'voice'}>Simulation</Link>
        <Link to="/3d-viewer" active={currentPage === '3d'}>3D Viewer</Link>
      </nav>
    </header>
  )
}
```

### 4. Replace Hardcoded Links
```typescript
// frontend/src/pages/components/CaseSetupHeader.tsx
import { Link } from 'react-router-dom'

// Replace:
<a href="/3d-viewer">3D Viewer</a>

// With:
<Link to="/3d-viewer">3D Viewer</Link>
```

### 5. Update Default Route
```typescript
// frontend/src/app/AppRouter.tsx
<Route path="/" element={<HomePage />} />  // or <DemoPage />
<Route path="*" element={<Navigate to="/" replace />} />
```

### 6. Add Back Navigation
```typescript
// All pages should have:
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()
<button onClick={() => navigate(-1)}>← Back</button>
// or
<button onClick={() => navigate('/')}>← Home</button>
```

---

## 📊 Component Dependency Graph

```
main.tsx
  └─ App
      └─ AppRouter
          ├─ HomePage (NEW)
          │   └─ Link to /demo, /voice, /3d-viewer
          │
          ├─ DemoPage (needs route)
          │   ├─ useRuntimeFeatures
          │   ├─ useVoiceSession
          │   ├─ MicControl
          │   └─ MessagesList
          │
          ├─ ChatPage (/voice)
          │   ├─ useBackendData
          │   ├─ useUIState
          │   ├─ useMessageManager
          │   ├─ CaseSetupHeader
          │   ├─ VoiceControls
          │   ├─ ChatView
          │   ├─ Viewer3D (embedded)
          │   ├─ AdvancedSettingsDrawer
          │   └─ DiagnosticsDrawer
          │
          ├─ Viewer3D (/3d-viewer)
          │   ├─ ViewerControls
          │   ├─ PlaybackModal
          │   └─ Scene (R3F Canvas)
          │
          └─ TranscriptPage (/transcript/:id)
              └─ api.getSessionTurns()
```

---

## 🎯 Priority Action Items

1. **[ ] Add DemoPage to AppRouter** (highest priority)
2. **[ ] Create HomePage/LandingPage** (clarifies user journey)
3. **[ ] Standardize navigation** (use React Router Link, not `<a href>`)
4. **[ ] Add back/home buttons** to all pages
5. **[ ] Document feature toggles** (voice/SPS enabled flags)
6. **[ ] Consolidate navigation components** (single source of truth)
7. **[ ] Add breadcrumbs** for deep pages (/transcript/:id)

---

## 🔍 Architecture Debt

### Frontend
- ❌ No shared layout component
- ❌ Inconsistent navigation patterns
- ❌ Each page implements own header
- ❌ Hardcoded links bypass router
- ❌ No loading states for route transitions
- ⚠️ Lazy loading only for 3D viewer (should apply to all heavy pages)

### Backend
- ✅ Well-structured route modules
- ✅ Consistent error handling
- ✅ Rate limiting in production
- ⚠️ Some duplicate endpoints (`/api/voice/transcript/relay` vs `/api/transcript/relay`)
- ⚠️ No API versioning (consider `/api/v1/...`)

### API Documentation
- ✅ Swagger UI at `/api-docs`
- ⚠️ Need to verify Swagger spec completeness
- ⚠️ Missing request/response examples in code comments

---

## 📝 Next Steps

1. Review this architecture map with team
2. Decide on default route (`/` → `/demo` vs `/` → `HomePage`)
3. Implement unified navigation header
4. Add missing routes to AppRouter
5. Create visual sitemap/wireframes
6. Update README with correct route structure

---

**Document Status:** ✅ Complete  
**Last Updated:** 2025-10-22  
**Maintainer:** Development Team
