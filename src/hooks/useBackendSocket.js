import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

/**
 * Custom hook for robust socket connection management with proper cleanup
 * and reactive state updates
 */
export function useBackendSocket(url, options = {}) {
  // Connection state with detailed status information
  const [connectionState, setConnectionState] = useState({
    isConnected: false,
    status: 'initializing',
    error: null,
    lastEvent: null,
    reconnectAttempts: 0
  });
  
  // Preserve latest options between renders
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  // Socket reference maintained between renders
  const socketRef = useRef(null);
  
  // Keep track of mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  
  // Create/initialize socket connection
  useEffect(() => {
    // Create socket with robust defaults
    const socket = io(url, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      ...options
    });
    
    socketRef.current = socket;
    
    // Connection established
    socket.on('connect', () => {
      if (!isMountedRef.current) return;
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        status: 'connected',
        error: null,
        lastEvent: 'connect',
        reconnectAttempts: 0
      }));
      
      // Execute onConnect callback if provided
      if (optionsRef.current.onConnect) {
        optionsRef.current.onConnect(socket);
      }
    });
    
    // Connection lost
    socket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return;
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        status: 'disconnected',
        lastEvent: 'disconnect',
        error: reason
      }));
      
      // Execute onDisconnect callback if provided
      if (optionsRef.current.onDisconnect) {
        optionsRef.current.onDisconnect(reason);
      }
      
      // If server initiated the disconnect, we need to manually reconnect
      if (reason === 'io server disconnect' && socket.disconnected) {
        socket.connect();
      }
    });
    
    // Connection error
    socket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        status: 'error',
        error: error.message,
        lastEvent: 'connect_error'
      }));
      
      // Execute onError callback if provided
      if (optionsRef.current.onError) {
        optionsRef.current.onError(error);
      }
    });
    
    // Reconnect attempt
    socket.on('reconnect_attempt', (attemptNumber) => {
      if (!isMountedRef.current) return;
      
      setConnectionState(prev => ({
        ...prev,
        status: 'connecting',
        reconnectAttempts: attemptNumber,
        lastEvent: 'reconnect_attempt'
      }));
    });
    
    // Successful reconnection
    socket.on('reconnect', (attemptNumber) => {
      if (!isMountedRef.current) return;
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        status: 'connected',
        error: null,
        lastEvent: 'reconnect',
        reconnectAttempts: attemptNumber
      }));
      
      // Execute onReconnect callback if provided
      if (optionsRef.current.onReconnect) {
        optionsRef.current.onReconnect(attemptNumber);
      }
    });
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect_attempt');
      socket.off('reconnect');
      
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url]); // Only recreate socket if URL changes
  
  // Safe emit function that handles disconnected state
  const emit = useCallback((event, data, callback) => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn(`Attempted to emit '${event}' while socket is disconnected`);
      return false;
    }
    
    try {
      socketRef.current.emit(event, data, callback);
      return true;
    } catch (error) {
      console.error(`Error emitting '${event}':`, error);
      return false;
    }
  }, []);
  
  // Register event listener with automatic cleanup
  const on = useCallback((event, handler) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on(event, handler);
    
    // Return cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, handler);
      }
    };
  }, []);
  
  // Hook for event registration with dependencies
  const useEvent = (event, handler, deps = []) => {
    useEffect(() => {
      if (!socketRef.current) return;
      
      // Define handler with safeguards
      const safeHandler = (...args) => {
        // Only call handler if component is still mounted
        if (isMountedRef.current) {
          handler(...args);
        }
      };
      
      socketRef.current.on(event, safeHandler);
      
      // Cleanup
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, safeHandler);
        }
      };
    }, [event, ...deps]);
  };
  
  return {
    socket: socketRef.current,
    connectionState,
    isConnected: connectionState.isConnected,
    status: connectionState.status,
    error: connectionState.error,
    emit,
    on,
    useEvent
  };
}
