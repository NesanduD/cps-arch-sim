import { useState, KeyboardEvent, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection
} from '@xyflow/react';
import { useCallback } from 'react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { parseCommand } from './utils/parser';
import type { ArchNode, ArchEdge, SimulationTraceEdge } from './types/architecture';

const initialNodes: ArchNode[] = [
  { id: 'node_1', position: { x: 100, y: 100 }, data: { label: 'Internet', type: 'internet' } },
  { id: 'node_2', position: { x: 400, y: 100 }, data: { label: 'Web Server', type: 'web_server' } },
];
const initialEdges: ArchEdge[] = [
  { id: 'edge_1', source: 'node_1', target: 'node_2' }
];

export default function App() {
  const [nodes, setNodes] = useNodesState<ArchNode>(initialNodes);
  const [edges, setEdges] = useEdgesState<ArchEdge>(initialEdges);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>(['System initialized. Try "add Database".']);

  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [simulationEdges, setSimulationEdges] = useState<SimulationTraceEdge[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = useCallback((connection: Connection) => {
    // Prevent duplicate edges when using the mouse
    const duplicate = edges.some(edge => edge.source === connection.source && edge.target === connection.target);
    if (duplicate) {
      setMessages((prev) => [`Error: These nodes are already connected.`, ...prev]);
      return;
    }
    
    // Add the edge and log it
    setEdges((eds) => addEdge(connection, eds));
    
    // Find node names for the log
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (sourceNode && targetNode) {
      setMessages((prev) => [`Connected ${sourceNode.data.label} to ${targetNode.data.label} (via mouse)`, ...prev]);
    }
  }, [edges, nodes, setEdges]);
  const onEdgesDelete = useCallback((deletedEdges: ArchEdge[]) => {
    deletedEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (sourceNode && targetNode) {
        setMessages((prev) => [`Disconnected ${sourceNode.data.label} from ${targetNode.data.label} (via UI)`, ...prev]);
      }
    });
  }, [nodes]);

  const onNodesDelete = useCallback((deletedNodes: ArchNode[]) => {
    deletedNodes.forEach(node => {
      setMessages((prev) => [`Removed node: ${node.data.label} (via UI)`, ...prev]);
    });
  }, []);

  const handleCommand = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim()) return;

    if (simulationStatus === 'completed') {
      setSimulationStatus('idle');
      setSimulationEdges([]);
      setCurrentStep(0);
    }

    const command = parseCommand(input);
    let logMsg = '';

    switch (command.action) {
      case 'add': {
        const newNode: ArchNode = {
          id: `node_${uuidv4()}`,
          position: { x: 250 + Math.random() * 50, y: 250 + Math.random() * 50 },
          data: { label: command.label, type: command.normalizedType }
        };
        setNodes((nds) => [...nds, newNode]);
        logMsg = `Added node: ${command.label}`;
        break;
      }
      case 'remove': {
        const targetLabel = command.label.toLowerCase();
        const nodeToRemove = nodes.find(n => n.data.label.toLowerCase() === targetLabel);
        if (nodeToRemove) {
          setNodes((nds) => nds.filter(n => n.id !== nodeToRemove.id));
          setEdges((eds) => eds.filter(edge => edge.source !== nodeToRemove.id && edge.target !== nodeToRemove.id));
          logMsg = `Removed node: ${command.label}`;
        } else {
          logMsg = `Error: Node "${command.label}" not found.`;
        }
        break;
      }
      case 'connect': {
        const sourceNode = nodes.find(n => n.data.label.toLowerCase() === command.source.toLowerCase());
        const targetNode = nodes.find(n => n.data.label.toLowerCase() === command.target.toLowerCase());
        if (sourceNode && targetNode) {
          // DUPLICATE VALIDATION
          const duplicate = edges.some(edge => edge.source === sourceNode.id && edge.target === targetNode.id);
          if (duplicate) {
            logMsg = `Error: ${command.source} is already connected to ${command.target}.`;
          } else {
            const newEdge: ArchEdge = { id: `edge_${uuidv4()}`, source: sourceNode.id, target: targetNode.id };
            setEdges((eds) => [...eds, newEdge]);
            logMsg = `Connected ${command.source} to ${command.target}`;
          }
        } else {
          logMsg = `Error: Could not find "${command.source}" or "${command.target}".`;
        }
        break;
      }
      case 'disconnect': {
        const sourceNode = nodes.find(n => n.data.label.toLowerCase() === command.source.toLowerCase());
        const targetNode = nodes.find(n => n.data.label.toLowerCase() === command.target.toLowerCase());
        if (sourceNode && targetNode) {
          setEdges((eds) => eds.filter(edge => !(edge.source === sourceNode.id && edge.target === targetNode.id)));
          logMsg = `Disconnected ${command.source} from ${command.target}`;
        } else {
          logMsg = `Error: Nodes not found.`;
        }
        break;
      }
      case 'unknown':
        logMsg = command.message;
        break;
    }
    setMessages((prev) => [logMsg, ...prev]);
    setInput('');
  };

  const handleRunSimulation = async () => {
    if (nodes.length < 2) {
      setMessages((prev) => ['Error: At least 2 nodes are required to run a simulation.', ...prev]);
      return;
    }
    try {
      setSimulationStatus('starting');
      setMessages((prev) => ['Starting simulation request...', ...prev]);
      
      const payload = { nodes: nodes.map(n => ({ id: n.id, type: n.data.type })) };
      const startRes = await fetch('/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!startRes.ok) throw new Error('Failed to reach simulation API');
      const startData = await startRes.json();
      const simId = startData.simulation_id;

      setSimulationStatus('running');
      setMessages((prev) => [`Simulation running. Waiting for results (approx 15s)...`, ...prev]);

      let attempts = 0;
      while (attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const pollRes = await fetch(`/simulate/${simId}`);
        if (!pollRes.ok) throw new Error('Failed to fetch simulation status');
        const pollData = await pollRes.json();

        if (pollData.status === 'completed') {
          // EMPTY TRACE HANDLING
          if (!pollData.edges || pollData.edges.length === 0) {
            setSimulationStatus('idle');
            setMessages((prev) => ['Simulation completed, but no trace was returned. Add more nodes.', ...prev]);
            return;
          }
          setSimulationEdges(pollData.edges);
          setSimulationStatus('completed');
          setCurrentStep(0);
          setMessages((prev) => [`Simulation completed! Trace generated with ${pollData.edges.length} steps.`, ...prev]);
          return;
        }
        attempts++;
      }
      throw new Error('Simulation timed out after 60 seconds.');
    } catch (error: unknown) {
      setSimulationStatus('error');
      const message = error instanceof Error ? error.message : "Unexpected API error occurred.";
      setMessages((prev) => [`API Error: ${message}`, ...prev]);
    }
  };

  const activeSimStep = simulationStatus === 'completed' ? simulationEdges[currentStep] : null;

  // FULL TRACE VISUALIZATION
  const displayEdges = useMemo(() => {
    const baseEdges = edges.map(e => ({ 
      ...e, 
      style: { 
        stroke: e.selected ? '#ef4444' : '#9ca3af', // Red if selected, gray if not
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

  const displayNodes = useMemo(() => {
    return nodes.map(node => {
      const isSource = activeSimStep?.source === node.id;
      const isTarget = activeSimStep?.target === node.id;
      
      let customStyle = {};
      if (node.selected) {
        customStyle = { border: '2px solid #ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }; // Red highlight
      } else if (isSource || isTarget) {
        customStyle = { border: '2px solid #3b82f6', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }; // Blue simulation highlight
      }

      return {
        ...node,
        style: customStyle
      };
    });
  }, [nodes, activeSimStep]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ flexGrow: 1, borderBottom: '2px solid #e5e7eb' }}>
        <ReactFlow nodes={displayNodes} edges={displayEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div style={{ height: '35%', padding: '20px', backgroundColor: '#f9fafb', display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Architecture Command Center</h3>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCommand}
            placeholder="e.g., 'create Database' or 'link Internet to Database'"
            style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
          <div style={{ marginTop: '10px', flexGrow: 1, overflowY: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '14px', color: '#4b5563' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
                <span style={{ color: '#9ca3af', marginRight: '8px' }}>{messages.length - idx}.</span>{msg}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            disabled={simulationStatus === 'starting' || simulationStatus === 'running'}
            style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: 'white', border: 'none', borderRadius: '6px', backgroundColor: (simulationStatus === 'starting' || simulationStatus === 'running') ? '#9ca3af' : '#2563eb' }}
            onClick={handleRunSimulation}
          >
            {simulationStatus === 'running' ? 'Running (~15s)...' : 'Run Simulation ▶'}
          </button>

          {/* RESET BUTTON */}
          {simulationStatus === 'completed' && (
            <button 
              style={{ padding: '8px', fontSize: '14px', cursor: 'pointer', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff' }}
              onClick={() => { setSimulationStatus('idle'); setSimulationEdges([]); setCurrentStep(0); }}
            >
              Clear Trace ↺
            </button>
          )}

          {simulationStatus === 'completed' && simulationEdges.length > 0 && (
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#1f2937' }}>
                Step {currentStep + 1} of {simulationEdges.length}
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <button 
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  style={{ 
                    padding: '8px 12px', 
                    cursor: currentStep === 0 ? 'not-allowed' : 'pointer', 
                    borderRadius: '4px', 
                    border: '1px solid #d1d5db', 
                    backgroundColor: '#f3f4f6',
                    color: currentStep === 0 ? '#9ca3af' : '#1f2937', // Light gray if disabled, dark gray if active
                    fontWeight: 'bold'
                  }}
                >
                  ◀ Prev
                </button>
                <button 
                  onClick={() => setCurrentStep(prev => Math.min(simulationEdges.length - 1, prev + 1))}
                  disabled={currentStep === simulationEdges.length - 1}
                  style={{ 
                    padding: '8px 12px', 
                    cursor: currentStep === simulationEdges.length - 1 ? 'not-allowed' : 'pointer', 
                    borderRadius: '4px', 
                    border: '1px solid #d1d5db', 
                    backgroundColor: '#f3f4f6',
                    color: currentStep === simulationEdges.length - 1 ? '#9ca3af' : '#1f2937', // Light gray if disabled, dark gray if active
                    fontWeight: 'bold'
                  }}
                >
                  Next ▶
                </button>
              </div>
              {activeSimStep && (
                <div style={{ fontSize: '14px', color: '#4b5563', backgroundColor: '#eff6ff', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', color: '#1d4ed8', marginBottom: '5px' }}>Trace Details:</div>
                  <div>Latency: {activeSimStep.latency_ms} ms</div>
                  <div>Packets: {activeSimStep.packets}</div>
                  <div>Status: {activeSimStep.status}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}