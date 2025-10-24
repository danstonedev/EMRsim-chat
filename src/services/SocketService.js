import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocketService(url, options = {}) {
  const socket = useRef(null);
  const eventHandlers = useRef(new Map());
  
  // Initialize socket connection
  useEffect(() => {
    if (!url) return;
    
    // Create socket connection
    socket.current = io(url, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      ...options
    });
    
    // Setup handlers for connection events
    socket.current.on('connect', () => {
      console.log('Socket connected');
      if (options.onConnect) options.onConnect();
    });
    
    socket.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (options.onDisconnect) options.onDisconnect(reason);
    });
    
    socket.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (options.onError) options.onError(error);
    });
    
    // Clean up
    return () => {
      // Remove all listeners and close connection
      if (socket.current) {
        eventHandlers.current.forEach((handler, event) => {
          socket.current.off(event, handler);
        });
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [url]);
  
  // Listen to a specific event
  const on = useCallback((event, handler) => {
    if (!socket.current) return;
    
    // Store handler reference for cleanup
    eventHandlers.current.set(event, handler);
    socket.current.on(event, handler);
    
    // Return cleanup function
    return () => {
      if (socket.current) {
        socket.current.off(event, handler);
        eventHandlers.current.delete(event);
      }
    };
  }, []);
  
  // Emit an event
  const emit = useCallback((event, data, callback) => {
    if (!socket.current) return;
    socket.current.emit(event, data, callback);
  }, []);
  
  // Reconnect manually
  const reconnect = useCallback(() => {
    if (socket.current) {
      socket.current.connect();
    }
  }, []);
  
  // Check connection status
  const isConnected = useCallback(() => {
    return socket.current ? socket.current.connected : false;
  }, []);
  
  return {
    on,
    emit,
    reconnect,
    isConnected
  };
}
