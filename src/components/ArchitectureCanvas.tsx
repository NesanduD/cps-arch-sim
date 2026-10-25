// This component is responsible for rendering the architecture canvas using React Flow.

  // useMemo = React hook that memoizes the result of a function, preventing unnecessary recalculations on re-renders. 
  // It is used here to optimize the rendering of nodes and edges based on their dependencies.
import { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MarkerType,
  type NodeChange, 
  type EdgeChange, 
  type Connection 
} from '@xyflow/react';
import type { ArchNode, ArchEdge, SimulationTraceEdge } from '../types/architecture';

// App.tsx should pass these values(props)
interface ArchitectureCanvasProps {
  nodes: ArchNode[];
  edges: ArchEdge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodesDelete: (nodes: ArchNode[]) => void;
  onEdgesDelete: (edges: ArchEdge[]) => void;
  
  // Here are the additional props for simulation status and edges
  simulationStatus: string;
  simulationEdges: SimulationTraceEdge[];
  currentStep: number;
  activeSimStep: SimulationTraceEdge | null;
}
export default function ArchitectureCanvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodesDelete, onEdgesDelete,
  simulationStatus, simulationEdges, currentStep, activeSimStep
}: ArchitectureCanvasProps) {

  // This attaches arrow markers to the edges and changes their color based on selection and simulation status.
  const displayEdges = useMemo(() => {
    const baseEdges: ArchEdge[] = edges.map(e => ({ 
      ...e, 
      style: { 
        stroke: e.selected ? '#ef4444' : '#9ca3af', 
        strokeWidth: e.selected ? 3 : 2 
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: e.selected ? '#ef4444' : '#9ca3af',
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
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: index === currentStep ? '#2563eb' : '#93c5fd',
          }
        });
      });
    }
    return baseEdges;
  }, [edges, simulationEdges, currentStep, simulationStatus]);

  // This attaches custom styles to the nodes based on their selection and simulation status.
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
        textTransform: 'capitalize'
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