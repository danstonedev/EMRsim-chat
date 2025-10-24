import React, { useState, useEffect } from 'react';
import { useBackendSocket } from '../hooks/useBackendSocket';
import { ErrorBoundary } from './ErrorBoundary';
import { useErrorLog } from '../providers/ErrorLogContext';
import './PatientMonitor.css';

interface VitalSigns {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation: number;
  respiratoryRate: number;
  temperature: number;
  timestamp: string;
}

interface PatientMonitorProps {
  patientId: string;
  simulationId: string;
  onVitalChange?: (vitals: VitalSigns) => void;
}

/**
 * PatientMonitor Component
 * 
 * Displays real-time vital signs for a patient during simulation.
 * This component has been migrated from using BackendSocketManager to useBackendSocket hook.
 * 
 * Original code with BackendSocketManager:
 * 
 * class PatientMonitor extends React.Component {
 *   componentDidMount() {
 *     BackendSocketManager.getInstance().addMessageHandler('vitals', this.handleVitalsUpdate);
 *     BackendSocketManager.getInstance().sendMessage('vitals', { 
 *       action: 'subscribe', 
 *       patientId: this.props.patientId 
 *     });
 *   }
 *   
 *   componentWillUnmount() {
 *     BackendSocketManager.getInstance().removeMessageHandler('vitals', this.handleVitalsUpdate);
 *     BackendSocketManager.getInstance().sendMessage('vitals', { 
 *       action: 'unsubscribe', 
 *       patientId: this.props.patientId 
 *     });
 *   }
 *   
 *   handleVitalsUpdate = (data) => {
 *     this.setState({ vitals: data });
 *     if (this.props.onVitalChange) this.props.onVitalChange(data);
 *   }
 * }
 */

export const PatientMonitor: React.FC<PatientMonitorProps> = ({ 
  patientId, 
  simulationId,
  onVitalChange 
}) => {
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { logError } = useErrorLog();
  
  // Initialize socket connection with vitals event type
  const { 
    sendMessage, 
    lastMessage, 
    connectionStatus 
  } = useBackendSocket<VitalSigns>('vitals');
  
  // Subscribe to patient vitals on mount
  useEffect(() => {
    if (connectionStatus === 'connected') {
      sendMessage({ 
        action: 'subscribe', 
        patientId,
        simulationId
      });
      
      // Unsubscribe when component unmounts
      return () => {
        sendMessage({
          action: 'unsubscribe',
          patientId,
          simulationId
        });
      };
    }
  }, [connectionStatus, patientId, simulationId, sendMessage]);
  
  // Handle incoming vitals updates
  useEffect(() => {
    if (lastMessage) {
      try {
        setVitals(lastMessage);
        if (onVitalChange) onVitalChange(lastMessage);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to process vital signs');
        setError(error);
        logError(error, { context: 'PatientMonitor', patientId, simulationId });
      }
    }
  }, [lastMessage, onVitalChange, patientId, simulationId, logError]);
  
  // Helper function to determine vital sign status
  const getVitalStatus = (
    vital: string, 
    value: number
  ): 'normal' | 'warning' | 'critical' => {
    switch (vital) {
      case 'heartRate':
        if (value < 50 || value > 120) return 'critical';
        if (value < 60 || value > 100) return 'warning';
        return 'normal';
        
      case 'oxygenSaturation':
        if (value < 90) return 'critical';
        if (value < 95) return 'warning';
        return 'normal';
        
      case 'respiratoryRate':
        if (value < 8 || value > 30) return 'critical';
        if (value < 12 || value > 25) return 'warning';
        return 'normal';
        
      case 'temperature':
        if (value < 35 || value > 39.5) return 'critical';
        if (value < 36 || value > 38) return 'warning';
        return 'normal';
        
      case 'bloodPressureSystolic':
        if (value < 90 || value > 180) return 'critical';
        if (value < 100 || value > 140) return 'warning';
        return 'normal';
        
      case 'bloodPressureDiastolic':
        if (value < 50 || value > 120) return 'critical';
        if (value < 60 || value > 90) return 'warning';
        return 'normal';
        
      default:
        return 'normal';
    }
  };
  
  // Format the BP reading
  const formatBP = (systolic: number, diastolic: number) => {
    return `${systolic}/${diastolic} mmHg`;
  };
  
  return (
    <ErrorBoundary>
      <div className="patient-monitor">
        <div className="monitor-header">
          <h3>Patient Vital Signs</h3>
          <div className={`connection-status status-${connectionStatus}`}>
            {connectionStatus}
          </div>
        </div>
        
        {error && (
          <div className="monitor-error">
            <p>Error: {error.message}</p>
          </div>
        )}
        
        {connectionStatus === 'disconnected' && (
          <div className="monitor-disconnected">
            <p>Monitor disconnected. Attempting to reconnect...</p>
          </div>
        )}
        
        {connectionStatus === 'connecting' && (
          <div className="monitor-connecting">
            <p>Connecting to patient monitoring system...</p>
          </div>
        )}
        
        {connectionStatus === 'connected' && !vitals && (
          <div className="monitor-loading">
            <p>Waiting for vital signs data...</p>
          </div>
        )}
        
        {vitals && (
          <div className="vital-signs">
            <div className={`vital heart-rate status-${getVitalStatus('heartRate', vitals.heartRate)}`}>
              <div className="vital-label">HR</div>
              <div className="vital-value">{vitals.heartRate}</div>
              <div className="vital-unit">BPM</div>
            </div>
            
            <div className={`vital blood-pressure status-${getVitalStatus('bloodPressureSystolic', vitals.bloodPressure.systolic)}`}>
              <div className="vital-label">BP</div>
              <div className="vital-value">{formatBP(vitals.bloodPressure.systolic, vitals.bloodPressure.diastolic)}</div>
              <div className="vital-unit"></div>
            </div>
            
            <div className={`vital oxygen status-${getVitalStatus('oxygenSaturation', vitals.oxygenSaturation)}`}>
              <div className="vital-label">SpO₂</div>
              <div className="vital-value">{vitals.oxygenSaturation}</div>
              <div className="vital-unit">%</div>
            </div>
            
            <div className={`vital respiratory status-${getVitalStatus('respiratoryRate', vitals.respiratoryRate)}`}>
              <div className="vital-label">RR</div>
              <div className="vital-value">{vitals.respiratoryRate}</div>
              <div className="vital-unit">breaths/min</div>
            </div>
            
            <div className={`vital temperature status-${getVitalStatus('temperature', vitals.temperature)}`}>
              <div className="vital-label">TEMP</div>
              <div className="vital-value">{vitals.temperature.toFixed(1)}</div>
              <div className="vital-unit">°C</div>
            </div>
          </div>
        )}
        
        {vitals && (
          <div className="monitor-timestamp">
            Last updated: {new Date(vitals.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
