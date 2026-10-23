import { Node, Edge } from '@xyflow/react';

export interface ArchNodeData extends Record<string, unknown> {
  label: string;
  type: string; // Normalized string for the API (e.g., "web_server")
  isHighlighted?: boolean;
}

export interface ArchEdgeData extends Record<string, unknown> {
  isTraceEdge?: boolean;
  isActiveStep?: boolean;
  latency_ms?: number;
  packets?: number;
  status?: string;
}

export type ArchNode = Node<ArchNodeData>;
export type ArchEdge = Edge<ArchEdgeData>;

// Strict parser output to separate intent from state updates
export type CommandResult =
  | { action: 'add'; label: string; normalizedType: string }
  | { action: 'remove'; label: string }
  | { action: 'connect'; source: string; target: string }
  | { action: 'disconnect'; source: string; target: string }
  | { action: 'unknown'; message: string };