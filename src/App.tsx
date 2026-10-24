import '@xyflow/react/dist/style.css';
import { useState, type KeyboardEvent } from 'react';
import './App.css';
import ArchitectureCanvas from './components/ArchitectureCanvas';
import CommandPanel from './components/CommandPanel';
import SimulationPanel from './components/SimulationPanel';
import { useArchitectureGraph } from './hooks/useArchitectureGraph';
import { useSimulation } from './hooks/useSimulation';

export default function App() {
  // 1. Initialize our powerful custom hooks
  const architecture = useArchitectureGraph();
  const simulation = useSimulation();

  // 2. Local state for the command input box
  const [input, setInput] = useState('');

  // 3. The master command handler that bridges our two independent hooks
  const handleCommandSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim()) return;

    // Process the command and check if it physically altered the nodes/edges
    const architectureChanged = architecture.processCommand(input);

    // If the user changed the architecture, we must clear the old, stale trace
    if (architectureChanged) {
      simulation.clearSimulation();
    }

    // Clear the input box for the next command
    setInput('');
  };

  // 4. A completely declarative, incredibly clean UI layout
  return (
    <div className="app-container">
      <ArchitectureCanvas
        nodes={architecture.nodes}
        edges={architecture.edges}
        onNodesChange={architecture.onNodesChange}
        onEdgesChange={architecture.onEdgesChange}
        onConnect={architecture.onConnect}
        onNodesDelete={architecture.onNodesDelete}
        onEdgesDelete={architecture.onEdgesDelete}
        simulationStatus={simulation.simulationStatus}
        simulationEdges={simulation.simulationEdges}
        currentStep={simulation.currentStep}
        activeSimStep={simulation.activeSimStep}
      />

      <div className="bottom-panel">
        <CommandPanel
          input={input}
          setInput={setInput}
          messages={architecture.messages}
          nodes={architecture.nodes}
          edges={architecture.edges}
          onCommandSubmit={handleCommandSubmit}
          isLocked={simulation.simulationStatus === 'starting' || simulation.simulationStatus === 'running'}
        />

        <SimulationPanel
          simulationStatus={simulation.simulationStatus}
          simulationEdges={simulation.simulationEdges}
          currentStep={simulation.currentStep}
          activeSimStep={simulation.activeSimStep}
          onRunSimulation={() => simulation.runSimulation(architecture.nodes, architecture.addMessage)}
          onClearTrace={simulation.clearSimulation}
          onNextStep={simulation.nextStep}
          onPrevStep={simulation.prevStep}
        />
      </div>
    </div>
  );
}