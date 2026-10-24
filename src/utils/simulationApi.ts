import type { ArchNode, SimulationTraceEdge } from '../types/architecture';

const SIMULATION_BASE_URL = '/simulate';
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40;

// 1. We define strict TypeScript interfaces for what the API returns
export interface SimulationStartResponse {
  simulation_id: string;
  status: string;
  edges?: SimulationTraceEdge[] | null;
}

export interface SimulationStatusResponse {
  simulation_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  edges?: SimulationTraceEdge[] | null;
}

// A simple helper function to pause execution
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. Function to start the simulation
export const startSimulationAPI = async (nodes: ArchNode[]): Promise<SimulationStartResponse> => {
  const payload = {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.type,
    })),
  };

  const response = await fetch(SIMULATION_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to reach simulation API');
  }

  return response.json();
};

// 3. Function to check the status
export const pollSimulationAPI = async (simulationId: string): Promise<SimulationStatusResponse> => {
  const response = await fetch(`${SIMULATION_BASE_URL}/${simulationId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch simulation status');
  }

  return response.json();
};

// 4. The Master Function that hides the loop from React
export async function runSimulationUntilComplete(nodes: ArchNode[]): Promise<SimulationTraceEdge[]> {
  const startResponse = await startSimulationAPI(nodes);
  const simulationId = startResponse.simulation_id;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await pollSimulationAPI(simulationId);

    if (statusResponse.status === 'completed') {
      // The ?? operator means "if edges is null/undefined, return an empty array [] instead"
      return statusResponse.edges ?? [];
    }
  }

  throw new Error('Simulation timed out after 60 seconds.');
}