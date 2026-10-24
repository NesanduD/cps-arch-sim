import { useState, useCallback } from 'react';
import { 
  useNodesState, 
  useEdgesState, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge, 
  type NodeChange, 
  type EdgeChange, 
  type Connection 
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { parseCommand } from '../utils/parser';
import type { ArchNode, ArchEdge } from '../types/architecture';

const initialNodes: ArchNode[] = [
  { id: 'node_1', position: { x: 100, y: 100 }, data: { label: 'Internet', type: 'internet' } },
  { id: 'node_2', position: { x: 400, y: 100 }, data: { label: 'Web Server', type: 'web_server' } },
];
const initialEdges: ArchEdge[] = [
  { id: 'edge_1', source: 'node_1', target: 'node_2' }
];

export const useArchitectureGraph = () => {
  const [nodes, setNodes] = useNodesState<ArchNode>(initialNodes);
  const [edges, setEdges] = useEdgesState<ArchEdge>(initialEdges);
  const [messages, setMessages] = useState<string[]>(['System initialized. Try "add Database".']);

  // A clean helper to add messages to the log safely
  const addMessage = useCallback((msg: string) => {
    setMessages((prev) => [msg, ...prev]);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as ArchNode[]), [setNodes]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as ArchEdge[]), [setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    const duplicate = edges.some(edge => edge.source === connection.source && edge.target === connection.target);
    if (duplicate) {
      addMessage(`Error: These nodes are already connected.`);
      return;
    }
    setEdges((eds) => addEdge(connection, eds));
    
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (sourceNode && targetNode) {
      addMessage(`Connected ${sourceNode.data.label} to ${targetNode.data.label} (via mouse)`);
    }
  }, [edges, nodes, setEdges, addMessage]);

  const onEdgesDelete = useCallback((deletedEdges: ArchEdge[]) => {
    deletedEdges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (sourceNode && targetNode) {
        addMessage(`Disconnected ${sourceNode.data.label} from ${targetNode.data.label} (via UI)`);
      }
    });
  }, [nodes, addMessage]);

  const onNodesDelete = useCallback((deletedNodes: ArchNode[]) => {
    deletedNodes.forEach(node => addMessage(`Removed node: ${node.data.label} (via UI)`));
  }, [addMessage]);

  // The command processor! Returns `true` if the architecture changed so we know to clear the trace.
  const processCommand = (input: string): boolean => {
    const command = parseCommand(input);
    let logMsg = '';
    let architectureChanged = false;

    switch (command.action) {
      case 'add': {
        const newNode: ArchNode = {
          id: `node_${uuidv4()}`,
          position: { x: 250 + Math.random() * 50, y: 250 + Math.random() * 50 },
          data: { label: command.label, type: command.normalizedType }
        };
        setNodes((nds) => [...nds, newNode]);
        logMsg = `Added node: ${command.label}`;
        architectureChanged = true;
        break;
      }
      case 'remove': {
        const targetLabel = command.label.toLowerCase();
        const nodeToRemove = nodes.find(n => n.data.label.toLowerCase() === targetLabel);
        if (nodeToRemove) {
          setNodes((nds) => nds.filter(n => n.id !== nodeToRemove.id));
          setEdges((eds) => eds.filter(edge => edge.source !== nodeToRemove.id && edge.target !== nodeToRemove.id));
          logMsg = `Removed node: ${command.label}`;
          architectureChanged = true;
        } else {
          logMsg = `Error: Node "${command.label}" not found.`;
        }
        break;
      }
      case 'connect': {
        const sourceNode = nodes.find(n => n.data.label.toLowerCase() === command.source.toLowerCase());
        const targetNode = nodes.find(n => n.data.label.toLowerCase() === command.target.toLowerCase());
        
        if (sourceNode && targetNode) {
          const duplicate = edges.some(edge => edge.source === sourceNode.id && edge.target === targetNode.id);
          if (duplicate) {
            logMsg = `Error: ${command.source} is already connected to ${command.target}.`;
          } else {
            const newEdge: ArchEdge = { id: `edge_${uuidv4()}`, source: sourceNode.id, target: targetNode.id };
            setEdges((eds) => [...eds, newEdge]);
            logMsg = `Connected ${command.source} to ${command.target}`;
            architectureChanged = true;
          }
        } else if (!sourceNode && !targetNode) {
          logMsg = `Error: Could not find nodes "${command.source}" and "${command.target}".`;
        } else if (!sourceNode) {
          logMsg = `Error: Could not find node "${command.source}".`;
        } else {
          logMsg = `Error: Could not find node "${command.target}".`;
        }
        break;
      }
      case 'disconnect': {
        const sourceNode = nodes.find(n => n.data.label.toLowerCase() === command.source.toLowerCase());
        const targetNode = nodes.find(n => n.data.label.toLowerCase() === command.target.toLowerCase());
        
        if (sourceNode && targetNode) {
          // 1. Check if the edge actually exists in the specified direction
          const edgeExists = edges.some(edge => edge.source === sourceNode.id && edge.target === targetNode.id);
          
          if (edgeExists) {
            setEdges((eds) => eds.filter(edge => !(edge.source === sourceNode.id && edge.target === targetNode.id)));
            logMsg = `Disconnected ${command.source} from ${command.target}`;
            architectureChanged = true;
          } else {
            // 2. Check if they just got the direction backwards!
            const reverseExists = edges.some(edge => edge.source === targetNode.id && edge.target === sourceNode.id);
            if (reverseExists) {
              logMsg = `Error: The connection goes the other way. Try: disconnect ${command.target} from ${command.source}`;
            } else {
              logMsg = `Error: No connection exists between ${command.source} and ${command.target}.`;
            }
          }
        } else if (!sourceNode && !targetNode) {
          logMsg = `Error: Could not find nodes "${command.source}" and "${command.target}".`;
        } else if (!sourceNode) {
          logMsg = `Error: Could not find node "${command.source}".`;
        } else {
          logMsg = `Error: Could not find node "${command.target}".`;
        }
        break;
      }
      case 'unknown':
        logMsg = command.message;
        break;
    }
    
    addMessage(logMsg);
    return architectureChanged;
  };

  return {
    nodes,
    edges,
    messages,
    addMessage,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDelete,
    onEdgesDelete,
    processCommand
  };
};