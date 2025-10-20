import React, { useState, useCallback, useEffect } from 'react';
import { useBackendSocket } from '../hooks/useBackendSocket';
import { useErrorLog } from '../providers/ErrorLogContext';
import './ConnectionReliabilityTester.css';

interface ConnectionStats {
  sent: number;
  received: number;
  failed: number;
  avgLatency: number;
  latencies: number[];
  startTime: number;
  lastMessageTime?: number;
}

interface TestMessage {
  id: string;
  timestamp: number;
  payload: string;
}

interface TestResponse {
  id: string;
  originalTimestamp: number;
  responseTimestamp: number;
  echo: string;
}

/**
 * ConnectionReliabilityTester Component
 * 
 * This component tests WebSocket connection reliability under various simulated network conditions.
 * It measures message latency, success rate, and reconnection capabilities.
 */
const ConnectionReliabilityTester: React.FC = () => {
  const [testRunning, setTestRunning] = useState(false);
  const [testDuration, setTestDuration] = useState(30); // seconds
  const [messageInterval, setMessageInterval] = useState(500); // milliseconds
  const [packetLossSimulation, setPacketLossSimulation] = useState(false);
  const [latencySimulation, setLatencySimulation] = useState(false);
  const [testResults, setTestResults] = useState<ConnectionStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [testTimeRemaining, setTestTimeRemaining] = useState(0);
  
  const { logError } = useErrorLog();
  
  // Initialize socket connection
  const {
    sendMessage,
    lastMessage,
    connectionStatus,
    connect,
    disconnect
  } = useBackendSocket<TestResponse>('connection-test');
  
  // Handle incoming messages
  useEffect(() => {
    if (!testRunning || !lastMessage) return;
    
    setTestResults(prev => {
      if (!prev) return null;
      
      const latency = Date.now() - lastMessage.originalTimestamp;
      const newLatencies = [...prev.latencies, latency];
      
      // Calculate average latency
      const avgLatency = newLatencies.reduce((sum, val) => sum + val, 0) / newLatencies.length;
      
      return {
        ...prev,
        received: prev.received + 1,
        latencies: newLatencies,
        avgLatency,
        lastMessageTime: Date.now()
      };
    });
  }, [lastMessage, testRunning]);
  
  // Start the reliability test
  const startTest = useCallback(() => {
    // Initialize test stats
    setTestResults({
      sent: 0,
      received: 0,
      failed: 0,
      avgLatency: 0,
      latencies: [],
      startTime: Date.now()
    });
    
    setTestRunning(true);
    setProgress(0);
    setTestTimeRemaining(testDuration);
  }, [testDuration]);
  
  // Stop the reliability test
  const stopTest = useCallback(() => {
    setTestRunning(false);
    setProgress(100);
  }, []);
  
  // Handle the test running state
  useEffect(() => {
    if (!testRunning) return;
    
    let testTimer: number;
    let messageTimer: number;
    let progressTimer: number;
    
    // Set up test duration timer
    const testEndTime = Date.now() + testDuration * 1000;
    
    // Function to send test message
    const sendTestMessage = () => {
      // Apply packet loss simulation (20% chance of dropping the message)
      if (packetLossSimulation && Math.random() < 0.2) {
        setTestResults(prev => {
          if (!prev) return null;
          return {
            ...prev,
            sent: prev.sent + 1,
            failed: prev.failed + 1
          };
        });
        return;
      }
      
      // Create test message
      const message: TestMessage = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: Date.now(),
        payload: `Test message at ${new Date().toISOString()}`
      };
      
      // Apply artificial latency if enabled (simulate slow network)
      if (latencySimulation) {
        setTimeout(() => {
          sendMessage(message);
        }, 100 + Math.random() * 200); // Add 100-300ms random latency
      } else {
        sendMessage(message);
      }
      
      // Update sent count
      setTestResults(prev => {
        if (!prev) return null;
        return {
          ...prev,
          sent: prev.sent + 1
        };
      });
    };
    
    // Start sending messages
    messageTimer = window.setInterval(sendTestMessage, messageInterval);
    
    // Update progress and time remaining
    progressTimer = window.setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.round((testEndTime - now) / 1000));
      const progressPercent = 100 - (remaining / testDuration) * 100;
      
      setProgress(progressPercent);
      setTestTimeRemaining(remaining);
      
      // Check for unresponsive connection (no message for 5 seconds)
      if (testResults?.lastMessageTime && now - testResults.lastMessageTime > 5000) {
        logError('Connection appears to be unresponsive', {
          context: 'ConnectionReliabilityTester',
          lastMessageTime: testResults.lastMessageTime
        });
      }
    }, 1000);
    
    // Stop test after duration
    testTimer = window.setTimeout(() => {
      stopTest();
    }, testDuration * 1000);
    
    // Cleanup function
    return () => {
      clearTimeout(testTimer);
      clearInterval(messageTimer);
      clearInterval(progressTimer);
    };
  }, [
    testRunning, 
    testDuration, 
    messageInterval, 
    packetLossSimulation, 
    latencySimulation, 
    sendMessage, 
    stopTest, 
    testResults, 
    logError
  ]);
  
  // Format latency for display
  const formatLatency = (ms: number) => {
    return `${Math.round(ms)}ms`;
  };
  
  // Calculate packet loss percentage
  const calculatePacketLoss = () => {
    if (!testResults) return '0%';
    const { sent, received } = testResults;
    if (sent === 0) return '0%';
    const lossPercent = ((sent - received) / sent) * 100;
    return `${lossPercent.toFixed(1)}%`;
  };
  
  // Calculate test duration
  const calculateTestDuration = () => {
    if (!testResults) return '0s';
    const durationMs = Date.now() - testResults.startTime;
    return `${(durationMs / 1000).toFixed(1)}s`;
  };
  
  // Reset the test
  const resetTest = () => {
    setTestResults(null);
    setProgress(0);
  };
  
  return (
    <div className="connection-reliability-tester">
      <h2>Connection Reliability Tester</h2>
      
      <div className="connection-status-indicator">
        <span>Status: </span>
        <span className={`status status-${connectionStatus}`}>
          {connectionStatus}
        </span>
      </div>
      
      <div className="test-controls">
        <div className="control-group">
          <label>Test Duration (seconds)</label>
          <input 
            type="range" 
            min="5" 
            max="60" 
            value={testDuration} 
            disabled={testRunning}
            onChange={e => setTestDuration(parseInt(e.target.value))} 
          />
          <span>{testDuration}s</span>
        </div>
        
        <div className="control-group">
          <label>Message Interval (ms)</label>
          <input 
            type="range" 
            min="100" 
            max="2000" 
            step="100"
            value={messageInterval} 
            disabled={testRunning}
            onChange={e => setMessageInterval(parseInt(e.target.value))} 
          />
          <span>{messageInterval}ms</span>
        </div>
        
        <div className="control-group checkbox">
          <label>
            <input 
              type="checkbox" 
              checked={packetLossSimulation} 
              disabled={testRunning}
              onChange={e => setPacketLossSimulation(e.target.checked)} 
            />
            Simulate Packet Loss (20%)
          </label>
        </div>
        
        <div className="control-group checkbox">
          <label>
            <input 
              type="checkbox" 
              checked={latencySimulation} 
              disabled={testRunning}
              onChange={e => setLatencySimulation(e.target.checked)} 
            />
            Simulate Network Latency (100-300ms)
          </label>
        </div>
        
        <div className="button-group">
          {!testRunning ? (
            <>
              <button 
                className="start-button" 
                disabled={connectionStatus !== 'connected'} 
                onClick={startTest}
              >
                Start Test
              </button>
              {testResults && (
                <button 
                  className="reset-button" 
                  onClick={resetTest}
                >
                  Reset
                </button>
              )}
            </>
          ) : (
            <button 
              className="stop-button" 
              onClick={stopTest}
            >
              Stop Test ({testTimeRemaining}s)
            </button>
          )}
        </div>
      </div>
      
      {testRunning && (
        <div className="test-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-label">{Math.round(progress)}%</div>
        </div>
      )}
      
      {testResults && (
        <div className="test-results">
          <h3>Test Results</h3>
          <div className="results-grid">
            <div className="result-item">
              <div className="result-label">Messages Sent</div>
              <div className="result-value">{testResults.sent}</div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Messages Received</div>
              <div className="result-value">{testResults.received}</div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Packet Loss</div>
              <div className="result-value">{calculatePacketLoss()}</div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Average Latency</div>
              <div className="result-value">{formatLatency(testResults.avgLatency)}</div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Min Latency</div>
              <div className="result-value">
                {formatLatency(Math.min(...testResults.latencies) || 0)}
              </div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Max Latency</div>
              <div className="result-value">
                {formatLatency(Math.max(...testResults.latencies) || 0)}
              </div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Test Duration</div>
              <div className="result-value">{calculateTestDuration()}</div>
            </div>
            
            <div className="result-item">
              <div className="result-label">Success Rate</div>
              <div className="result-value">
                {testResults.sent > 0 
                  ? `${((testResults.received / testResults.sent) * 100).toFixed(1)}%`
                  : '0%'
                }
              </div>
            </div>
          </div>
          
          <div className="reliability-summary">
            <h4>Reliability Assessment</h4>
            {testResults.sent > 0 && (testResults.received / testResults.sent) > 0.95 && testResults.avgLatency < 300 && (
              <div className="reliability-excellent">
                Excellent: High success rate with low latency
              </div>
            )}
            {testResults.sent > 0 && (testResults.received / testResults.sent) > 0.9 && (testResults.received / testResults.sent) <= 0.95 && (
              <div className="reliability-good">
                Good: Acceptable success rate with some latency
              </div>
            )}
            {testResults.sent > 0 && (testResults.received / testResults.sent) > 0.8 && (testResults.received / testResults.sent) <= 0.9 && (
              <div className="reliability-fair">
                Fair: Moderate packet loss and/or high latency
              </div>
            )}
            {testResults.sent > 0 && (testResults.received / testResults.sent) <= 0.8 && (
              <div className="reliability-poor">
                Poor: High packet loss or connection issues
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="connection-actions">
        <button 
          className="connect-button" 
          onClick={connect}
          disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
        >
          Connect
        </button>
        <button 
          className="disconnect-button" 
          onClick={disconnect}
          disabled={connectionStatus !== 'connected'}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
};

export default ConnectionReliabilityTester;
