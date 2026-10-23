import { useState, KeyboardEvent } from 'react';
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

  // NEW: Simulation States
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'starting' | 'running' | 'completed' | 'error'>('idle');
  const [simulationEdges, setSimulationEdges] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));

  // --- PARSER LOGIC ---
  const handleCommand = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !input.trim()) return;

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
          const newEdge: ArchEdge = {
            id: `edge_${uuidv4()}`,
            source: sourceNode.id,
            target: targetNode.id,
          };
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

  // --- NEW: API INTEGRATION LOGIC ---
  const handleRunSimulation = async () => {
    if (nodes.length < 2) {
      setMessages((prev) => ['Error: At least 2 nodes are required to run a simulation.', ...prev]);
      return;
    }

    try {
      setSimulationStatus('starting');
      setMessages((prev) => ['Starting simulation request...', ...prev]);

      // 1. Map React Flow nodes to the exact format the Python API expects
      const payload = {
        nodes: nodes.map(n => ({ id: n.id, type: n.data.type }))
      };

      // 2. Start the simulation via POST
      const startRes = await fetch('/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!startRes.ok) throw new Error('Failed to reach simulation API');
      const startData = await startRes.json();
      const simId = startData.simulation_id;

      setSimulationStatus('running');
      setMessages((prev) => [`Simulation ${simId} running. Waiting for results (approx 15s)...`, ...prev]);

      // 3. Poll the GET endpoint every 1.5 seconds
      let attempts = 0;
      while (attempts < 40) { // Max 60 seconds
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Top: Canvas Area */}
      <div style={{ flexGrow: 1, borderBottom: '2px solid #e5e7eb' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Bottom: Command Panel & History */}
      <div style={{ height: '30%', padding: '20px', backgroundColor: '#f9fafb', display: 'flex', gap: '20px' }}>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Architecture Command Center</h3>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCommand}
            placeholder="e.g., 'add Firewall' or 'connect Internet to Firewall' (Press Enter)"
            style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
          
          <div style={{ marginTop: '10px', flexGrow: 1, overflowY: 'auto', backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '14px', color: '#4b5563' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: '4px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}>
                <span style={{ color: '#9ca3af', marginRight: '8px' }}>{messages.length - idx}.</span>
                {msg}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '10px' }}>
          <button 
            disabled={simulationStatus === 'starting' || simulationStatus === 'running'}
            style={{ 
              padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: 'white', border: 'none', borderRadius: '6px', width: '100%',
              backgroundColor: (simulationStatus === 'starting' || simulationStatus === 'running') ? '#9ca3af' : '#2563eb'
            }}
            onClick={handleRunSimulation}
          >
            {simulationStatus === 'running' ? 'Running (~15s)...' : 'Run Simulation ▶'}
          </button>
        </div>

      </div>
    </div>
  );
}