import React, { useEffect, useState } from 'react';
import { useBackendSocket } from '../hooks/useBackendSocket';

/**
 * Example component showing migration from BackendSocketManager to useBackendSocket
 * 
 * BEFORE:
 * 
 * class ChatComponent extends React.Component {
 *   componentDidMount() {
 *     BackendSocketManager.getInstance().addMessageHandler('chat', this.handleMessage);
 *   }
 *   
 *   componentWillUnmount() {
 *     BackendSocketManager.getInstance().removeMessageHandler('chat', this.handleMessage);
 *   }
 *   
 *   handleMessage = (data) => {
 *     this.setState({ messages: [...this.state.messages, data] });
 *   }
 *   
 *   sendMessage = () => {
 *     BackendSocketManager.getInstance().sendMessage('chat', { text: this.state.text });
 *   }
 * }
 */

// AFTER:
interface Message {
  text: string;
  sender: string;
  timestamp: string;
}

export function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  
  const { sendMessage, lastMessage, connectionStatus } = useBackendSocket<Message>('chat');
  
  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      setMessages(prev => [...prev, lastMessage]);
    }
  }, [lastMessage]);
  
  // Handle sending messages
  const handleSend = () => {
    if (text.trim()) {
      sendMessage({ text, sender: 'user', timestamp: new Date().toISOString() });
      setText('');
    }
  };
  
  return (
    <div className="chat-container">
      <div className="connection-status">
        Status: <span className={`status-${connectionStatus}`}>{connectionStatus}</span>
      </div>
      
      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender === 'user' ? 'user-message' : 'system-message'}`}>
            <div className="message-text">{message.text}</div>
            <div className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      
      <div className="message-input">
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Type a message..." 
          disabled={connectionStatus !== 'connected'}
        />
        <button onClick={handleSend} disabled={connectionStatus !== 'connected'}>Send</button>
      </div>
    </div>
  );
}
