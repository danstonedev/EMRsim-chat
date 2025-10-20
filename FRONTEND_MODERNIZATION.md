# Frontend Modernization Strategy

This document outlines the approach for modernizing the EMRsim-chat frontend, focusing on state management, code organization, and performance optimization.

## Current Challenges

1. **App.tsx Complexity**: The main App component has grown too large and manages too many concerns
2. **Monolithic Bundle**: Single large JavaScript bundle impacts initial load time
3. **Class-based Components**: Some components still use class-based state management
4. **Component Nesting**: Deep component hierarchies make state management difficult

## Modernization Goals

1. Complete migration to functional components with hooks
2. Implement code splitting for on-demand loading
3. Reduce bundle size by 30%
4. Improve component organization with feature-based structure

## Implementation Plan

### 1. App.tsx Refactoring

#### Component Extraction

Break down App.tsx into feature-specific components:

```
App
├── AppProviders (Context providers)
├── AppRouting (Route definitions)
├── Navigation (Header, menu components)
├── SimulationWorkspace
│   ├── PatientView
│   ├── ChatInterface
│   └── DiagnosticTools
└── Settings
```

#### State Management

Use React Context for global state:

```typescript
// Context organization
- UserContext - Authentication and user preferences
- SimulationContext - Current simulation state
- UIContext - UI state (sidebar open, active tabs)
- SocketContext - WebSocket communication
```

### 2. Code Splitting Implementation

#### Route-based Splitting

```typescript
// Example route-based code splitting
import React, { lazy, Suspense } from 'react';

const SimulationWorkspace = lazy(() => import('./features/simulation/SimulationWorkspace'));
const PatientHistory = lazy(() => import('./features/patientHistory/PatientHistory'));
const Settings = lazy(() => import('./features/settings/Settings'));

// In router
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/simulation/:id" component={SimulationWorkspace} />
  <Route path="/history" component={PatientHistory} />
  <Route path="/settings" component={Settings} />
</Suspense>
```

#### Feature-based Splitting

```typescript
// Example feature-based code splitting
const ModelViewer = lazy(() => import('./components/ModelViewer'));

function SimulationWorkspace() {
  const [showModel, setShowModel] = useState(false);
  
  return (
    <div>
      {showModel && (
        <Suspense fallback={<ModelLoading />}>
          <ModelViewer />
        </Suspense>
      )}
    </div>
  );
}
```

### 3. Bundle Optimization

#### Bundle Analysis

Use webpack-bundle-analyzer to identify large dependencies:

```bash
npm run build -- --analyze
```

#### Dependency Optimization

- Replace large libraries with smaller alternatives
- Use tree-shaking friendly imports
- Consider micro-frontends for larger features

### 4. State Management Modernization

#### Hook Migration Pattern

For each class component:

1. Convert to functional component
2. Replace lifecycle methods with useEffect
3. Replace setState with useState or useReducer
4. Extract complex logic to custom hooks

**Before:**
```typescript
class PatientView extends React.Component {
  state = { patientData: null, loading: true };
  
  componentDidMount() {
    this.fetchPatientData();
  }
  
  fetchPatientData = async () => {
    // Fetch data and update state
  }
  
  render() {
    // Render UI
  }
}
```

**After:**
```typescript
function PatientView() {
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPatientData = async () => {
      // Fetch data
      setPatientData(data);
      setLoading(false);
    };
    
    fetchPatientData();
  }, []);
  
  // Render UI
}
```

## Implementation Timeline

| Week | Focus Area | Key Deliverables |
|------|------------|------------------|
| 1    | App.tsx Refactoring | Extract core components |
| 2    | Context Implementation | Set up context providers |
| 3    | Code Splitting | Route-based code splitting |
| 3-4  | Hook Migration | Convert remaining class components |
| 4-5  | Bundle Optimization | Dependency cleanup and optimization |

## Success Metrics

- Initial load time reduced by 30%
- Zero class-based components in codebase
- Main bundle size under 250KB
- Feature module loading under 1s
- Improved Lighthouse performance score (90+)
