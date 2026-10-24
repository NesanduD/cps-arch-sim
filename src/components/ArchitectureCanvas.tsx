import { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  type NodeChange, 
  type EdgeChange, 
  type Connection 
} from '@xyflow/react';
import type { ArchNode, ArchEdge, SimulationTraceEdge } from '../types/architecture';

// 1. We define the "Props" (the data) this component needs to receive from App.tsx
interface ArchitectureCanvasProps {
  nodes: ArchNode[];
  edges: ArchEdge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (nodes: ArchNode[]) => void;
  onEdgesDelete: (edges: ArchEdge[]) => void;
  
  // Simulation visual state
  simulationStatus: string;
  simulationEdges: SimulationTraceEdge[];
  currentStep: number;
  activeSimStep: SimulationTraceEdge | null;
}

export default function ArchitectureCanvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodesDelete, onEdgesDelete,
  simulationStatus, simulationEdges, currentStep, activeSimStep
}: ArchitectureCanvasProps) {

  // 2. We moved your brilliant displayEdges logic here!
  const displayEdges = useMemo(() => {
    const baseEdges: ArchEdge[] = edges.map(e => ({ 
      ...e, 
      style: { 
        stroke: e.selected ? '#ef4444' : '#9ca3af', 
        strokeWidth: e.selected ? 3 : 2 
      } 
    }));
    
    if (simulationStatus === 'completed' && simulationEdges.length > 0) {
      simulationEdges.forEach((step, index) => {
        baseEdges.push({
          id: `trace_${index}`,
          source: step.source,
          target: step.target,
          animated: index === currentStep,
          style: { 
            stroke: index === currentStep ? '#2563eb' : '#93c5fd',
            strokeWidth: index === currentStep ? 4 : 2,
            strokeDasharray: index === currentStep ? undefined : '6 4'
          }
        });
      });
    }
    return baseEdges;
  }, [edges, simulationEdges, currentStep, simulationStatus]);

  // 3. We moved your displayNodes logic here (with the capitalize fix!)
  const displayNodes = useMemo(() => {
    return nodes.map(node => {
      const isSource = activeSimStep?.source === node.id;
      const isTarget = activeSimStep?.target === node.id;
      
      let customStyle: React.CSSProperties = { 
        backgroundColor: '#1e293b', 
        color: '#f8fafc', 
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        padding: '12px 24px',
        fontWeight: 'bold',
        fontSize: '13px',
        letterSpacing: '0.5px',
        textTransform: 'capitalize' // <-- Added this fix!
      };

      if (node.selected) {
        customStyle = { ...customStyle, border: '2px solid #ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' };
      } else if (isSource || isTarget) {
        customStyle = { ...customStyle, border: '2px solid #3b82f6', boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)' };
      }

      return {
        ...node,
        style: customStyle
      };
    });
  }, [nodes, activeSimStep]);

  // 4. Clean, simple render using your new CSS class
  return (
    <div className="canvas-container">
      <ReactFlow 
        nodes={displayNodes} 
        edges={displayEdges} 
        onNodesChange={onNodesChange} 
        onEdgesChange={onEdgesChange} 
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}