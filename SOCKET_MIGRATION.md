# Socket Management Migration Guide

This document outlines the migration strategy from the legacy BackendSocketManager class to the modern useBackendSocket hook pattern.

## Current Architecture

The `BackendSocketManager` class was created as a singleton to manage WebSocket connections to the backend server. This approach has several limitations:

- Singleton pattern creates tight coupling
- Difficult to test components that use it
- Not aligned with React's component lifecycle
- Challenges with handling multiple connections

## Target Architecture

The `useBackendSocket` hook provides a more React-friendly approach:

- Connection lifecycle tied to component lifecycle
- Easier to test with mocking
- Support for multiple independent connections
- Better error handling and reconnection logic

## Migration Steps

### 1. Identify All Usage Points

Run the following command to find all references to BackendSocketManager:

```bash
grep -r "BackendSocketManager" --include="*.tsx" --include="*.ts" ./src
```

### 2. Create Component-Specific Migrations

For each component using BackendSocketManager:

1. Import the useBackendSocket hook
2. Replace BackendSocketManager initialization with hook
3. Update message handling to use hook's methods
4. Test component behavior thoroughly

### 3. Migration Pattern

**Before:**

```typescript
import { BackendSocketManager } from './BackendSocketManager';

class MyComponent extends React.Component {
  componentDidMount() {
    BackendSocketManager.getInstance().addMessageHandler('eventType', this.handleMessage);
  }
  
  componentWillUnmount() {
    BackendSocketManager.getInstance().removeMessageHandler('eventType', this.handleMessage);
  }
  
  handleMessage = (data) => {
    // Handle message
  }
  
  sendMessage() {
    BackendSocketManager.getInstance().sendMessage('eventType', payload);
  }
}
```

**After:**

```typescript
import { useBackendSocket } from '../hooks/useBackendSocket';

function MyComponent() {
  const { sendMessage, lastMessage } = useBackendSocket('eventType');
  
  useEffect(() => {
    if (lastMessage) {
      // Handle message
    }
  }, [lastMessage]);
  
  const handleSend = () => {
    sendMessage(payload);
  };
}
```

### 4. Testing Strategy

For each migrated component:

1. Verify connection establishment
2. Test message sending functionality
3. Confirm proper message handling
4. Check disconnection and reconnection behavior
5. Validate error handling

### 5. Deprecation Timeline

1. Week 1-2: Identify and document all usage points
2. Week 2-3: Create migration PRs for each component
3. Week 3-4: Test and merge all migrations
4. Week 4: Remove BackendSocketManager class

## Success Criteria

- Zero references to BackendSocketManager in codebase
- All components using useBackendSocket hook
- No socket-related errors in production logs
- Improved test coverage for socket interactions
