/**
 * UND Chat UI Controller
 * Framework-agnostic, accessible chat interface with LLM integration hooks
 */

class ChatController {
  constructor() {
    this.thread = null;
    this.input = null;
    this.form = null;
    this.typingIndicator = null;
    this.sendButton = null;
    this.chips = [];
    
    this.init();
  }
  
  init() {
    // Find DOM elements
    this.thread = document.querySelector('.chat-thread');
    this.input = document.querySelector('#chat-input');
    this.form = document.querySelector('.composer-form');
    this.typingIndicator = document.querySelector('.typing');
    this.sendButton = document.querySelector('.composer-btn-primary');
    this.chips = document.querySelectorAll('.chat-chip');
    
    if (!this.thread || !this.input || !this.form) {
      console.warn('Chat UI elements not found');
      return;
    }
    
    this.bindEvents();
    this.setupAutoResize();
  }
  
  bindEvents() {
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSend();
    });
    
    // Enter/Shift+Enter handling
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    
    // Suggestion chips
    this.chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent.trim();
        this.input.value = text;
        this.input.focus();
        this.handleSend();
      });
    });
    
    // Theme toggle (if present)
    const themeToggle = document.querySelector('#theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', this.toggleTheme);
    }
  }
  
  setupAutoResize() {
    // Auto-resize textarea
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
      this.updateSendButton();
    });
    
    // Initial resize
    this.updateSendButton();
  }
  
  updateSendButton() {
    const hasText = this.input.value.trim().length > 0;
    this.sendButton.disabled = !hasText;
  }
  
  async handleSend() {
    const message = this.input.value.trim();
    if (!message) return;
    
    // Clear input immediately
    this.input.value = '';
    this.input.style.height = 'auto';
    this.updateSendButton();
    
    // Add user message
    this.appendMessage('user', message);
    
    // Show typing indicator
    this.showTyping(true);
    
    try {
      // Send to LLM backend (implement your integration here)
      const response = await this.sendToLLM(message);
      
      // Hide typing and show response
      this.showTyping(false);
      this.appendMessage('assistant', response);
      
    } catch (error) {
      console.error('Chat error:', error);
      this.showTyping(false);
      this.appendMessage('system', 'Sorry, I encountered an error. Please try again.');
    }
    
    // Return focus to input
    this.input.focus();
  }
  
  appendMessage(type, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `msg ${type}`;
    msgEl.setAttribute('role', type === 'system' ? 'status' : 'text');
    
    const contentEl = document.createElement('div');
    contentEl.className = 'msg-content';
    contentEl.textContent = text;
    
    const timeEl = document.createElement('time');
    timeEl.className = 'msg-time';
    const now = new Date();
    timeEl.setAttribute('datetime', now.toISOString());
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgEl.appendChild(contentEl);
    if (type !== 'system') {
      msgEl.appendChild(timeEl);
    }
    
    // Insert before typing indicator if it exists
    if (this.typingIndicator && this.typingIndicator.parentNode) {
      this.thread.insertBefore(msgEl, this.typingIndicator);
    } else {
      this.thread.appendChild(msgEl);
    }
    
    // Scroll to bottom
    this.scrollToBottom();
    
    // Announce to screen readers
    if (type === 'assistant') {
      this.announceMessage(text);
    }
  }
  
  showTyping(show) {
    if (this.typingIndicator) {
      this.typingIndicator.style.display = show ? 'flex' : 'none';
      if (show) {
        this.scrollToBottom();
      }
    }
  }
  
  scrollToBottom() {
    // Use smooth scroll unless reduced motion is preferred
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    this.thread.scrollTo({ top: this.thread.scrollHeight, behavior });
  }
  
  announceMessage(text) {
    // Create temporary element for screen reader announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.className = 'visually-hidden';
    announcement.textContent = `Assistant: ${text}`;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
  
  toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    root.setAttribute('data-theme', newTheme);
    
    // Update toggle button
    const toggle = document.querySelector('#theme-toggle');
    if (toggle) {
      toggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
      toggle.setAttribute('aria-label', `Switch to ${currentTheme} mode`);
    }
    
    // Store preference
    localStorage.setItem('chat-theme', newTheme);
  }
  
  /**
   * LLM Integration Hook
   * Replace this with your actual backend integration
   * @param {string} message - User message
   * @returns {Promise<string>} - Assistant response
   */
  async sendToLLM(message) {
    // Demo implementation - replace with your actual API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const responses = [
          "Thanks for your question! This is a demo response from the UND Assistant.",
          "I'd be happy to help you with information about the University of North Dakota.",
          "That's a great question! Let me provide you with some helpful information.",
          "I'm here to assist you with any questions about UND programs, campus life, or admissions."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        resolve(`${randomResponse}\n\nNote: This is a demonstration. In a real implementation, this would connect to your LLM service.`);
      }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
    });
    
    /* 
    // Example real implementation:
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
    */
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatController());
} else {
  new ChatController();
}

// Restore theme preference
const savedTheme = localStorage.getItem('chat-theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggle = document.querySelector('#theme-toggle');
  if (toggle) {
    toggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
  }
}