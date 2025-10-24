import { useState, useEffect, useCallback, useRef } from 'react';

interface UseBackendSocketOptions {
  reconnectInterval?: number;
  reconnectAttempts?: number;
  autoConnect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

interface UseBackendSocketResult<T> {
  sendMessage: (payload: any) => void;
  lastMessage: T | null;
  readyState: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  connect: () => void;
  disconnect: () => void;
}

export function useBackendSocket<T = any>(
  eventType: string,
  socketUrl?: string,
  options: UseBackendSocketOptions = {}
): UseBackendSocketResult<T> {
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>(
    'disconnected'
  );
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const eventTypeRef = useRef<string>(eventType);
  
  // Update the ref when eventType changes
  useEffect(() => {
    eventTypeRef.current = eventType;
  }, [eventType]);
  
  const {
    reconnectInterval = 2000,
    reconnectAttempts = 5,
    autoConnect = true,
    onOpen,
    onClose,
    onError,
  } = options;

  const url = socketUrl || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  
  const connect = useCallback(() => {
    // Close existing socket if it exists
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    try {
      setConnectionStatus('connecting');
      const socket = new WebSocket(url);
      
      socket.onopen = () => {
        setReadyState(WebSocket.OPEN);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        if (onOpen) onOpen();
      };
      
      socket.onclose = (event) => {
        setReadyState(WebSocket.CLOSED);
        setConnectionStatus('disconnected');
        if (onClose) onClose();
        
        // Attempt to reconnect if not closed cleanly and still have attempts left
        if (!event.wasClean && reconnectAttemptsRef.current < reconnectAttempts) {
          setConnectionStatus('reconnecting');
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = window.setTimeout(() => connect(), reconnectInterval);
        }
      };
      
      socket.onerror = (error) => {
        if (onError) onError(error);
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === eventTypeRef.current || eventTypeRef.current === '*') {
            setLastMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      socketRef.current = socket;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        setConnectionStatus('reconnecting');
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(() => connect(), reconnectInterval);
      }
    }
  }, [url, reconnectInterval, reconnectAttempts, onOpen, onClose, onError]);
  
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);
  
  const sendMessage = useCallback(
    (payload: any) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          type: eventTypeRef.current,
          payload,
          timestamp: new Date().toISOString(),
        });
        socketRef.current.send(message);
      } else {
        console.warn('Attempted to send message while WebSocket is not connected');
      }
    },
    []
  );
  
  // Connect on mount if autoConnect is true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    // Clean up on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);
  
  return {
    sendMessage,
    lastMessage,
    readyState,
    connectionStatus,
    connect,
    disconnect,
  };
}
