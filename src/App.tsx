import { useState, KeyboardEvent, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { parseCommand } from './utils/parser';
import type { ArchNode, ArchEdge } from './types/architecture';

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
  const [messages, setMessages] = useState<string[]>(['System initialized. Try typing "add Database".']);

  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [simulationEdges, setSimulationEdges] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));

  // --- PARSER LOGIC ---
  const handleCommand = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim()) return;

    // Reset simulation if user alters architecture
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
          const newEdge: ArchEdge = { id: `edge_${uuidv4()}`, source: sourceNode.id, target: targetNode.id };
          setEdges((eds) => [...eds, newEdge]);
          logMsg = `Connected ${command.source} to ${command.target}`;
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

  // --- API INTEGRATION LOGIC ---
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
          setSimulationEdges(pollData.edges || []);
          setSimulationStatus('completed');
          setCurrentStep(0);
          setMessages((prev) => [`Simulation completed! Trace generated with ${(pollData.edges || []).length} steps.`, ...prev]);
          return;
        }
        attempts++;
      }
      throw new Error('Simulation timed out after 60 seconds.');
    } catch (error: any) {
      setSimulationStatus('error');
      setMessages((prev) => [`API Error: ${error.message}`, ...prev]);
    }
  };

  // --- NEW: VISUAL DERIVED STATE ---
  const activeSimStep = simulationStatus === 'completed' ? simulationEdges[currentStep] : null;

  // Render architecture edges as solid gray. If a simulation is active, render an animated blue trace edge over it.
  const displayEdges = useMemo(() => {
    const baseEdges = edges.map(e => ({ ...e, style: { stroke: '#9ca3af', strokeWidth: 2 } }));
    
    if (activeSimStep) {
      baseEdges.push({
        id: `trace_${currentStep}`,
        source: activeSimStep.source,
        target: activeSimStep.target,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 4 } // Thick blue animated line
      });
    }
    return baseEdges;
  }, [edges, activeSimStep, currentStep]);

  // Highlight nodes involved in the current simulation step
  const displayNodes = useMemo(() => {
    return nodes.map(node => {
      const isSource = activeSimStep?.source === node.id;
      const isTarget = activeSimStep?.target === node.id;
      return {
        ...node,
        style: (isSource || isTarget) ? { border: '2px solid #3b82f6', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' } : {}
      };
    });
  }, [nodes, activeSimStep]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      
      <div style={{ flexGrow: 1, borderBottom: '2px solid #e5e7eb' }}>
        <ReactFlow nodes={displayNodes} edges={displayEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
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
            placeholder="e.g., 'add Firewall' or 'connect Internet to Firewall'"
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

          {/* NEW: Stepper UI */}
          {simulationStatus === 'completed' && simulationEdges.length > 0 && (
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#1f2937' }}>
                Simulation Step {currentStep + 1} of {simulationEdges.length}
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <button 
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  style={{ padding: '8px 12px', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6' }}
                >
                  ◀ Prev
                </button>
                <button 
                  onClick={() => setCurrentStep(prev => Math.min(simulationEdges.length - 1, prev + 1))}
                  disabled={currentStep === simulationEdges.length - 1}
                  style={{ padding: '8px 12px', cursor: currentStep === simulationEdges.length - 1 ? 'not-allowed' : 'pointer', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6' }}
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