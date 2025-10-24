import { renderHook, act } from '@testing-library/react-hooks';
import { useBackendSocket } from '../../hooks/useBackendSocket';
import WS from 'jest-websocket-mock';

describe('useBackendSocket', () => {
  let server: WS;
  const TEST_URL = 'ws://localhost:1234';
  
  beforeEach(() => {
    // Create a WebSocket mock server
    server = new WS(TEST_URL);
  });
  
  afterEach(() => {
    // Clean up after each test
    WS.clean();
  });
  
  test('should connect to WebSocket server', async () => {
    const { result } = renderHook(() => 
      useBackendSocket('test', TEST_URL)
    );
    
    // Wait for the connection to establish
    await server.connected;
    
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.readyState).toBe(WebSocket.OPEN);
  });
  
  test('should send and receive messages', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBackendSocket('chat', TEST_URL)
    );
    
    // Wait for connection to establish
    await server.connected;
    
    // Send a message from the client
    act(() => {
      result.current.sendMessage({ text: 'Hello server' });
    });
    
    // Verify the message was received by the server
    await expect(server).toReceiveMessage(
      expect.objectContaining({
        type: 'chat',
        payload: { text: 'Hello server' }
      })
    );
    
    // Send a message from the server
    const serverMessage = {
      type: 'chat',
      payload: { text: 'Hello client' },
      timestamp: new Date().toISOString()
    };
    
    server.send(JSON.stringify(serverMessage));
    
    // Wait for the hook to update with the received message
    await waitForNextUpdate();
    
    // Verify the message was received by the client
    expect(result.current.lastMessage).toEqual(serverMessage.payload);
  });
  
  test('should handle connection errors', async () => {
    // Simulate server being unavailable
    WS.clean();
    
    const { result } = renderHook(() => 
      useBackendSocket('test', TEST_URL, { 
        reconnectInterval: 100, 
        reconnectAttempts: 1 
      })
    );
    
    // Initial state should be connecting
    expect(result.current.connectionStatus).toBe('connecting');
    
    // After a short delay, it should transition to reconnecting
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(['disconnected', 'reconnecting']).toContain(result.current.connectionStatus);
  });
  
  test('should reconnect after connection loss', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useBackendSocket('test', TEST_URL, { 
        reconnectInterval: 100 
      })
    );
    
    // Wait for connection to establish
    await server.connected;
    expect(result.current.connectionStatus).toBe('connected');
    
    // Close the connection to simulate network interruption
    server.close();
    
    // Wait for the hook to update with disconnected status
    await waitForNextUpdate();
    expect(result.current.connectionStatus).toBe('disconnected');
    
    // Create a new server with the same URL to simulate recovery
    server = new WS(TEST_URL);
    
    // Wait for reconnection
    await waitForNextUpdate();
    await server.connected;
    
    // Should reconnect automatically
    expect(result.current.connectionStatus).toBe('connected');
  });
  
  test('should handle multiple reconnect attempts', async () => {
    const maxAttempts = 3;
    const reconnectInterval = 100;
    
    const { result } = renderHook(() => 
      useBackendSocket('test', TEST_URL, { 
        reconnectInterval,
        reconnectAttempts: maxAttempts
      })
    );
    
    // Wait for connection to establish
    await server.connected;
    expect(result.current.connectionStatus).toBe('connected');
    
    // Close the server to trigger reconnection attempts
    server.close();
    
    // Wait for first reconnect attempt
    await new Promise(resolve => setTimeout(resolve, reconnectInterval + 50));
    
    // Close any new connections to force more reconnect attempts
    WS.clean();
    
    // Wait for all reconnect attempts to complete
    await new Promise(resolve => 
      setTimeout(resolve, reconnectInterval * maxAttempts + 100)
    );
    
    // Should be disconnected after max attempts
    expect(result.current.connectionStatus).toBe('disconnected');
  });
  
  test('should handle network latency', async () => {
    // Set up a hook with message timeout detection
    const { result, waitForNextUpdate } = renderHook(() => {
      const socketHook = useBackendSocket('test', TEST_URL);
      return {
        ...socketHook,
        sendWithTimeout: async (payload: any, timeoutMs = 1000) => {
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error('Message timeout'));
            }, timeoutMs);
            
            socketHook.sendMessage({
              ...payload,
              messageId: 'test-message-id'
            });
            
            const checkInterval = setInterval(() => {
              if (socketHook.lastMessage && 
                  socketHook.lastMessage.responseToId === 'test-message-id') {
                clearTimeout(timeoutId);
                clearInterval(checkInterval);
                resolve(socketHook.lastMessage);
              }
            }, 50);
          });
        }
      };
    });
    
    // Wait for connection to establish
    await server.connected;
    
    // Start the timeout promise but don't await it yet
    const messagePromise = result.current.sendWithTimeout({ data: 'test' }, 500);
    
    // Simulate server delay but respond in time
    setTimeout(() => {
      server.send(JSON.stringify({
        type: 'test',
        payload: { status: 'success', responseToId: 'test-message-id' },
        timestamp: new Date().toISOString()
      }));
    }, 200);
    
    // Should resolve without timeout
    await expect(messagePromise).resolves.toEqual(
      expect.objectContaining({ status: 'success' })
    );
  });
});
