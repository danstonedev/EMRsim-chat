import React, { useState, useEffect, useCallback } from 'react';
import { useBackendSocket } from '../hooks/useBackendSocket';
import { ErrorBoundary } from './ErrorBoundary';

// Message type definition
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'system' | 'patient';
  timestamp: string;
  metadata?: Record<string, any>;
}

// Conversation state type
interface ConversationState {
  id: string;
  messages: Message[];
  status: 'active' | 'paused' | 'completed';
  participants: string[];
  startTime: string;
  endTime?: string;
}

// Props interface
interface ConversationControllerProps {
  conversationId: string;
  userId: string;
  onError?: (error: Error) => void;
}

/**
 * ConversationController component - manages the conversation state and WebSocket communication
 * 
 * This component has been refactored from using BackendSocketManager to the useBackendSocket hook
 */
export const ConversationController: React.FC<ConversationControllerProps> = ({
  conversationId,
  userId,
  onError
}) => {
  // Local state
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize backend socket connection with the conversation event type
  const { 
    sendMessage, 
    lastMessage, 
    connectionStatus, 
    connect,
    disconnect 
  } = useBackendSocket<Message | ConversationState>('conversation');
  
  // Handle connection status changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Request initial conversation data once connected
      sendMessage({ 
        action: 'getConversation', 
        conversationId, 
        userId 
      });
    }
    
    if (connectionStatus === 'disconnected' && conversation) {
      // Handle reconnection if conversation was active
      setError(new Error('Connection lost. Attempting to reconnect...'));
      
      // Try to reconnect after a delay
      const reconnectTimeout = setTimeout(() => {
        connect();
      }, 2000);
      
      return () => clearTimeout(reconnectTimeout);
    }
  }, [connectionStatus, conversationId, userId, conversation, connect, sendMessage]);
  
  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      // Handle different message types
      if ('action' in lastMessage) {
        switch (lastMessage.action) {
          case 'conversationData':
            // Initial conversation data
            setConversation(lastMessage.data);
            setIsLoading(false);
            break;
            
          case 'newMessage':
            // Add new message to the conversation
            setConversation(prev => {
              if (!prev) return null;
              return {
                ...prev,
                messages: [...prev.messages, lastMessage.message]
              };
            });
            break;
            
          case 'statusUpdate':
            // Update conversation status
            setConversation(prev => {
              if (!prev) return null;
              return {
                ...prev,
                status: lastMessage.status
              };
            });
            break;
            
          case 'error':
            // Handle errors
            const socketError = new Error(lastMessage.message);
            setError(socketError);
            if (onError) onError(socketError);
            break;
        }
      }
    } catch (err) {
      const processingError = err instanceof Error ? err : new Error('Error processing message');
      setError(processingError);
      if (onError) onError(processingError);
    }
  }, [lastMessage, onError]);
  
  // Send a new message
  const sendChatMessage = useCallback((text: string, metadata?: Record<string, any>) => {
    if (connectionStatus !== 'connected' || !conversation) {
      setError(new Error('Cannot send message: not connected'));
      return false;
    }
    
    sendMessage({
      action: 'sendMessage',
      conversationId,
      message: {
        text,
        sender: 'user',
        metadata
      }
    });
    
    return true;
  }, [connectionStatus, conversation, conversationId, sendMessage]);
  
  // Pause the conversation
  const pauseConversation = useCallback(() => {
    if (connectionStatus === 'connected' && conversation) {
      sendMessage({
        action: 'updateStatus',
        conversationId,
        status: 'paused'
      });
    }
  }, [connectionStatus, conversation, conversationId, sendMessage]);
  
  // Resume the conversation
  const resumeConversation = useCallback(() => {
    if (connectionStatus === 'connected' && conversation) {
      sendMessage({
        action: 'updateStatus',
        conversationId,
        status: 'active'
      });
    }
  }, [connectionStatus, conversation, conversationId, sendMessage]);
  
  // End the conversation
  const endConversation = useCallback(() => {
    if (connectionStatus === 'connected' && conversation) {
      sendMessage({
        action: 'updateStatus',
        conversationId,
        status: 'completed'
      });
    }
  }, [connectionStatus, conversation, conversationId, sendMessage]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return (
    <ErrorBoundary
      onError={(err) => {
        if (onError) onError(err);
      }}
      fallback={<div>An error occurred in the conversation controller. Please refresh.</div>}
    >
      <div className="conversation-controller">
        {isLoading ? (
          <div className="loading-state">Loading conversation...</div>
        ) : error ? (
          <div className="error-state">
            <p>Error: {error.message}</p>
            <button onClick={() => connect()}>Reconnect</button>
          </div>
        ) : conversation ? (
          <div className="conversation-active">
            <div className="connection-status">
              Status: <span className={connectionStatus}>{connectionStatus}</span>
            </div>
            
            <div className="conversation-controls">
              {conversation.status === 'active' ? (
                <button onClick={pauseConversation}>Pause</button>
              ) : conversation.status === 'paused' ? (
                <button onClick={resumeConversation}>Resume</button>
              ) : null}
              
              {conversation.status !== 'completed' && (
                <button onClick={endConversation}>End Conversation</button>
              )}
            </div>
            
            <div className="messages-container">
              {conversation.messages.map(message => (
                <div key={message.id} className={`message message-${message.sender}`}>
                  <div className="message-sender">{message.sender}</div>
                  <div className="message-text">{message.text}</div>
                  <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            
            {conversation.status === 'active' && (
              <div className="message-input">
                <input
                  type="text"
                  placeholder="Type your message..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      sendChatMessage(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.previousSibling as HTMLInputElement;
                    if (input && input.value) {
                      sendChatMessage(input.value);
                      input.value = '';
                    }
                  }}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="no-conversation">
            Conversation not found or not authorized.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
