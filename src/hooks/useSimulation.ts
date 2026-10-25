
import { useState } from 'react';
import type { ArchNode, SimulationTraceEdge } from '../types/architecture';
import { runSimulationUntilComplete } from '../utils/simulationApi';

// This exports a custom React hook that manages the state of a simulation. 
// It provides functions to run the simulation, clear the state, and navigate through the simulation steps. 
// The hook maintains the current status of the simulation, the edges generated during the simulation, and the current step in the simulation trace.
export const useSimulation = () => {
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [simulationEdges, setSimulationEdges] = useState<SimulationTraceEdge[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // This function resets the simulation state to its initial values.
  const clearSimulation = () => {
    setSimulationStatus('idle');
    setSimulationEdges([]);
    setCurrentStep(0);
  };

  // The main function. It runs the simulation and updates the state accordingly.
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

      // This function call simulates the network until it completes and returns a trace of the simulation.
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

  // These functions allow navigation through the simulation steps, ensuring that the current step index remains within valid bounds.
  const nextStep = () => setCurrentStep(prev => Math.min(simulationEdges.length - 1, prev + 1));
  const prevStep = () => setCurrentStep(prev => Math.max(0, prev - 1));

  // Export the state and functions for use in components that utilize this hook.
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