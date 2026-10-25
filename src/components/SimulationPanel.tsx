// This component provides a panel for running simulations, stepping through simulation traces, 
// and displaying metrics for the active simulation step.

import type { SimulationTraceEdge } from '../types/architecture';

// Define the exact data and functions this panel needs to operate from App.tsx
interface SimulationPanelProps {
  simulationStatus: 'idle' | 'starting' | 'running' | 'completed' | 'error';
  simulationEdges: SimulationTraceEdge[];
  currentStep: number;
  activeSimStep: SimulationTraceEdge | null;
  
  onRunSimulation: () => void;
  onClearTrace: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
}

export default function SimulationPanel({
  simulationStatus,
  simulationEdges,
  currentStep,
  activeSimStep,
  onRunSimulation,
  onClearTrace,
  onNextStep,
  onPrevStep
}: SimulationPanelProps) {
  
  return (
    <div className="right-panel">
      {/* Run Button */}
      <button 
        disabled={simulationStatus === 'starting' || simulationStatus === 'running'}
        className="btn-primary"
        onClick={onRunSimulation}
      >
        {simulationStatus === 'running' ? 'Running Simulation...' : 'Run Simulation ▶'}
      </button>

      {/* Clear Trace Button */}
      {simulationStatus === 'completed' && (
        <button 
          className="btn-secondary"
          onClick={onClearTrace}
        >
          Clear Trace ↺
        </button>
      )}

      {/* Stepper and Metrics Area */}
      {simulationStatus === 'completed' && simulationEdges.length > 0 && (
        <div className="metrics-panel">
          <h4 style={{ margin: '0 0 12px 0', textAlign: 'center', color: '#f8fafc', fontSize: '14px' }}>
            Simulation Step <span style={{ color: '#3b82f6' }}>{currentStep + 1}</span> of {simulationEdges.length}
          </h4>
          
          {/* Stepper Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
            <button 
              onClick={onPrevStep}
              disabled={currentStep === 0}
              className="btn-step"
            >
              ◀ Prev
            </button>
            <button 
              onClick={onNextStep}
              disabled={currentStep === simulationEdges.length - 1}
              className="btn-step"
            >
              Next ▶
            </button>
          </div>
          
          {/* Active Step Metrics */}
          {activeSimStep && (
            <div className="metrics-card">
              <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                Metrics
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Latency:</span> <span style={{ color: '#f8fafc' }}>{activeSimStep.latency_ms} ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Packets:</span> <span style={{ color: '#f8fafc' }}>{activeSimStep.packets}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status:</span> 
                <span style={{ color: activeSimStep.status === 'success' ? '#10b981' : '#ef4444' }}>
                  {activeSimStep.status}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}