import { useState, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as ArchNode[]), [setNodes]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as ArchEdge[]), [setEdges]);
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

  // --- NEW: DYNAMIC SUGGESTION ENGINE (ALL ALIASES) ---
  const suggestions = useMemo(() => {
    const currentLabels = nodes.map(n => String(n.data.label));
    const allPossible: string[] = [];

    // Default suggestions when the input is empty
    if (!input.trim()) {
      if (currentLabels.length === 0) return ['add Internet', 'create Web Server'];
      if (currentLabels.length === 1) return [`add Database`, `remove ${currentLabels[0]}`];
      if (currentLabels.length >= 2) return [`connect ${currentLabels[0]} to ${currentLabels[1]}`, `add Firewall`];
    }

    // 1. Suggest creating nodes (all aliases)
    const commonTypes = ['Database', 'Firewall', 'Load Balancer', 'Router', 'Microservice', 'API'];
    commonTypes.forEach(t => {
      allPossible.push(`add ${t}`);
      allPossible.push(`create ${t}`);
      allPossible.push(`new ${t}`);
    });

    // 2. Suggest removing existing nodes (all aliases)
    currentLabels.forEach(l => {
      allPossible.push(`remove ${l}`);
      allPossible.push(`delete ${l}`);
      allPossible.push(`drop ${l}`);
    });

    // 3. Suggest connecting existing nodes (all aliases)
    currentLabels.forEach(l1 => {
      currentLabels.forEach(l2 => {
        if (l1 !== l2) {
          allPossible.push(`connect ${l1} to ${l2}`);
          allPossible.push(`link ${l1} to ${l2}`);
        }
      });
    });

    // 4. Suggest disconnecting existing edges (all aliases)
    edges.forEach(e => {
      const s = nodes.find(n => n.id === e.source)?.data.label;
      const t = nodes.find(n => n.id === e.target)?.data.label;
      if (s && t) {
        allPossible.push(`disconnect ${s} from ${t}`);
        allPossible.push(`unlink ${s} from ${t}`);
      }
    });

    // Filter by whatever the user is currently typing, limit to top 4 results
    return allPossible
      .filter(s => s.toLowerCase().includes(input.toLowerCase()))
      .slice(0, 4);
  }, [input, nodes, edges]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top: Canvas Area */}
      <div style={{ flexGrow: 1 }}>
        <ReactFlow 
          nodes={displayNodes} 
          edges={displayEdges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          fitView
        >
          {/* Optional: Add color="#475569" to Background if the dots are too bright */}
          <Background />
          <Controls/>
        </ReactFlow>
      </div>

      {/* Bottom: Modernized Command Panel */}
      <div style={{ height: '35%', padding: '24px', backgroundColor: '#1e293b', display: 'flex', gap: '24px', borderTop: '1px solid #334155', boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        
        {/* Left: Input & Chat Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Command Center Header with Floating Help Menu */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'relative' }}>
            <h3 style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
              Architecture Command Center
            </h3>
            <button 
              onClick={() => setShowHelp(!showHelp)}
              style={{ 
                background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', 
                cursor: 'pointer', fontWeight: 'bold', padding: 0 
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#60a5fa'}
              onMouseOut={(e) => e.currentTarget.style.color = '#3b82f6'}
            >
              {showHelp ? 'Hide Commands ▴' : 'View Commands ▾'}
            </button>

            {/* Floating Command Cheat Sheet */}
            {showHelp && (
              <div style={{ 
                position: 'absolute', bottom: '100%', right: 0, marginBottom: '12px',
                backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', 
                padding: '16px', fontSize: '13px', color: '#cbd5e1', zIndex: 20,
                boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: '#60a5fa', width: '85px', textAlign: 'right', marginRight: '12px' }}>Add:</strong> 
                    <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>add | create | new &lt;node&gt;</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: '#ef4444', width: '85px', textAlign: 'right', marginRight: '12px' }}>Remove:</strong> 
                    <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>remove | delete | drop &lt;node&gt;</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: '#10b981', width: '85px', textAlign: 'right', marginRight: '12px' }}>Connect:</strong> 
                    <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>connect | link &lt;A&gt; to &lt;B&gt;</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <strong style={{ color: '#f59e0b', width: '85px', textAlign: 'right', marginRight: '12px' }}>Disconnect:</strong> 
                    <code style={{ backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>disconnect | unlink &lt;A&gt; from &lt;B&gt;</code>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Input with Auto-Suggest Dropdown */}
          <div style={{ position: 'relative' }}>
            
            {/* Floating Suggestion Menu - NOW CHECKS isInputFocused */}
            {isInputFocused && suggestions.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px',
                backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px',
                overflow: 'hidden', boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.3)', zIndex: 10
              }}>
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setInput(s);
                      setIsInputFocused(false); // Hide menu after selection
                    }}
                    style={{
                      padding: '10px 16px', cursor: 'pointer', color: '#e2e8f0', fontSize: '14px',
                      borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid #334155',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ color: '#3b82f6', marginRight: '8px', fontWeight: 'bold' }}>↵</span> {s}
                  </div>
                ))}
              </div>
            )}

            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleCommand}
              placeholder="e.g., 'create Database' or 'link Internet to Database' (Press Enter)"
              style={{ 
                width: '100%', padding: '14px 16px', fontSize: '15px', borderRadius: '8px', 
                border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', 
                outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                setIsInputFocused(true); // Show menu
              }}
              onBlur={(e) => {
                // Delay blur slightly so click events on the suggestion menu can fire before it unmounts
                setTimeout(() => {
                  e.target.style.borderColor = '#475569';
                  setIsInputFocused(false); // Hide menu
                }, 200);
              }}
            />
          </div>
          
          {/* Terminal-style Log */}
          <div style={{ 
            marginTop: '12px', flexGrow: 1, overflowY: 'auto', backgroundColor: '#0f172a', 
            padding: '16px', borderRadius: '8px', border: '1px solid #334155', fontSize: '14px' 
          }}>
            {messages.map((msg, idx) => {
              // Color code messages based on content
              const isError = msg.toLowerCase().includes('error');
              const isSuccess = msg.toLowerCase().includes('completed') || msg.toLowerCase().includes('connected');
              const textColor = isError ? '#ef4444' : (isSuccess ? '#10b981' : '#cbd5e1');

              return (
                <div key={idx} style={{ marginBottom: '8px', borderBottom: idx === messages.length - 1 ? 'none' : '1px solid #1e293b', paddingBottom: '8px', color: textColor, display: 'flex' }}>
                  <span style={{ color: '#475569', marginRight: '12px', minWidth: '24px', textAlign: 'right', fontSize: '12px', paddingTop: '2px' }}>
                    {messages.length - idx}.
                  </span>
                  <span style={{ lineHeight: '1.4' }}>{msg}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Controls & Stepper */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <button 
            disabled={simulationStatus === 'starting' || simulationStatus === 'running'}
            style={{ 
              padding: '14px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', color: 'white', 
              border: 'none', borderRadius: '8px', transition: 'background-color 0.2s',
              backgroundColor: (simulationStatus === 'starting' || simulationStatus === 'running') ? '#475569' : '#2563eb',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
            onClick={handleRunSimulation}
          >
            {simulationStatus === 'running' ? 'Running Simulation (~15s)...' : 'Run Simulation ▶'}
          </button>

          {simulationStatus === 'completed' && (
            <button 
              style={{ 
                padding: '10px', fontSize: '14px', cursor: 'pointer', color: '#cbd5e1', 
                border: '1px solid #475569', borderRadius: '8px', backgroundColor: '#0f172a',
                transition: 'all 0.2s ease'
              }}
              onClick={() => { setSimulationStatus('idle'); setSimulationEdges([]); setCurrentStep(0); }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#f8fafc'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              Clear Trace ↺
            </button>
          )}

          {simulationStatus === 'completed' && simulationEdges.length > 0 && (
            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 12px 0', textAlign: 'center', color: '#f8fafc', fontSize: '14px' }}>
                Simulation Step <span style={{ color: '#3b82f6' }}>{currentStep + 1}</span> of {simulationEdges.length}
              </h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
                <button 
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  style={{ 
                    flex: 1, padding: '8px', cursor: currentStep === 0 ? 'not-allowed' : 'pointer', 
                    borderRadius: '6px', border: '1px solid #334155', 
                    backgroundColor: currentStep === 0 ? '#0f172a' : '#1e293b',
                    color: currentStep === 0 ? '#475569' : '#e2e8f0', fontWeight: 'bold'
                  }}
                >
                  ◀ Prev
                </button>
                <button 
                  onClick={() => setCurrentStep(prev => Math.min(simulationEdges.length - 1, prev + 1))}
                  disabled={currentStep === simulationEdges.length - 1}
                  style={{ 
                    flex: 1, padding: '8px', cursor: currentStep === simulationEdges.length - 1 ? 'not-allowed' : 'pointer', 
                    borderRadius: '6px', border: '1px solid #334155', 
                    backgroundColor: currentStep === simulationEdges.length - 1 ? '#0f172a' : '#1e293b',
                    color: currentStep === simulationEdges.length - 1 ? '#475569' : '#e2e8f0', fontWeight: 'bold'
                  }}
                >
                  Next ▶
                </button>
              </div>
              
              {activeSimStep && (
                <div style={{ fontSize: '13px', color: '#94a3b8', backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>Metrics</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Latency:</span> <span style={{ color: '#f8fafc' }}>{activeSimStep.latency_ms} ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Packets:</span> <span style={{ color: '#f8fafc' }}>{activeSimStep.packets}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Status:</span> <span style={{ color: activeSimStep.status === 'success' ? '#10b981' : '#ef4444' }}>{activeSimStep.status}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );;
}