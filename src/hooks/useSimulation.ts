import { useState } from 'react';
import type { ArchNode, SimulationTraceEdge } from '../types/architecture';
import { runSimulationUntilComplete } from '../utils/simulationApi';

export const useSimulation = () => {
  // 1. We move all the simulation state variables out of App.tsx
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [simulationEdges, setSimulationEdges] = useState<SimulationTraceEdge[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // 2. A clean helper to reset everything
  const clearSimulation = () => {
    setSimulationStatus('idle');
    setSimulationEdges([]);
    setCurrentStep(0);
  };

  // 3. The main function. Notice how we pass `addMessage` so the hook can still log to the chat!
  const runSimulation = async (nodes: ArchNode[], addMessage: (msg: string) => void) => {
    if (nodes.length < 2) {
      addMessage('Error: At least 2 nodes are required to run a simulation.');
      return;
    }

    try {
      setSimulationStatus('starting');
      addMessage('Starting simulation request...');
      
      setSimulationStatus('running');
      addMessage('Simulation running. Waiting for results (approx 15s)...');

      // We call that clean API function we made in Step 1!
      const trace = await runSimulationUntilComplete(nodes);

      if (trace.length === 0) {
        setSimulationStatus('idle');
        addMessage('Simulation completed, but no trace was returned. Add more nodes.');
        return;
      }

      setSimulationEdges(trace);
      setSimulationStatus('completed');
      setCurrentStep(0);
      addMessage(`Simulation completed! Trace generated with ${trace.length} steps.`);
      
    } catch (error: unknown) {
      setSimulationStatus('error');
      const message = error instanceof Error ? error.message : "Unexpected API error occurred.";
      addMessage(`API Error: ${message}`);
    }
  };

  // 4. Helpers for the stepper UI
  const nextStep = () => setCurrentStep(prev => Math.min(simulationEdges.length - 1, prev + 1));
  const prevStep = () => setCurrentStep(prev => Math.max(0, prev - 1));

  // 5. We "export" these so App.tsx can use them
  return {
    simulationStatus,
    simulationEdges,
    currentStep,
    activeSimStep: simulationStatus === 'completed' ? simulationEdges[currentStep] : null,
    runSimulation,
    clearSimulation,
    nextStep,
    prevStep
  };
};