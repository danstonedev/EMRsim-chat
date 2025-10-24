import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/layout.css';
import './styles/voiceChat.css';

// Create root element if it doesn't exist
let rootElement = document.getElementById('root');
if (!rootElement) {
  console.warn('Root element not found, creating one');
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

// Create React root and render
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);

// Log application start
console.log(`[App] Started on port ${window.location.port}`);