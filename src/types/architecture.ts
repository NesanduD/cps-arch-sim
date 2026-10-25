import type { Node, Edge } from '@xyflow/react';

// The data structure for each node in the architecture diagram.
export interface ArchNodeData extends Record<string, unknown> {
  label: string;
  type: string;
  isHighlighted?: boolean;
}

// The data structure for each edge in the architecture diagram.
export interface ArchEdgeData extends Record<string, unknown> {
  isTraceEdge?: boolean;
  isActiveStep?: boolean;
  latency_ms?: number;
  packets?: number;
  status?: string;
}

// combining the node and edge types with their respective data structures
export type ArchNode = Node<ArchNodeData>;
export type ArchEdge = Edge<ArchEdgeData>;

// All accepted actions that can be performed on the architecture diagram.
export type CommandResult =
  | { action: 'add'; label: string; normalizedType: string }
  | { action: 'remove'; label: string }
  | { action: 'connect'; source: string; target: string }
  | { action: 'disconnect'; source: string; target: string }
  | { action: 'unknown'; message: string };

// The data structure for each edge in the simulation trace(what backend returns).
export interface SimulationTraceEdge {
  source: string;
  target: string;
  latency_ms: number;
  packets: number;
  status: string;
}