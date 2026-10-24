# Architecture Update via Chat Input & Simulation Exploration

This is a React + TypeScript web application that allows a user to modify a system architecture through text-based commands. The architecture is displayed as an interactive, dark-themed node-and-edge diagram using React Flow.

The user can add, remove, connect, and disconnect architecture nodes through text input or UI interactions. The application sends the current architecture to the supplied FastAPI simulation service, polls for the asynchronous result, and displays the returned simulation trace directly on the canvas as an interactive overlay.

## Features

### Core Features
- **Interactive Canvas:** Architecture visualization built with React Flow.
- **Command-Driven Editing:** Add, remove, connect, and disconnect nodes via text.
- **UI Fallbacks:** Support for mouse-based connections and keyboard deletions (Backspace/Delete).
- **Async API Integration:** Sends architecture state to the supplied simulation API and polls for results.
- **Simulation Playback:** Visual stepper to move forward and backward through the returned simulation trace.
- **Trace Visualization:** Highlights active nodes and edges during simulation playback and displays metrics (latency, packet count, status).

### Bonus Features Implemented
- **Dark-themed interface:** Professional slate/dark-mode interface with color-coded highlighting.
- **Context-Aware Autocomplete:** Floating suggestion menu that auto-populates based on current canvas state and user input.
- **Flexible Parser:** Supports multiple command aliases (e.g., `add`/`create`/`new`).
- **Validation and Error Handling:** Prevents duplicate edges, reports unknown nodes, and handles API timeouts and network failures gracefully.
- **Command Legend:** Collapsible cheat-sheet in the UI for quick reference.

## Tech Stack

- **React 18+** & **TypeScript**
- **Vite** (with proxy configuration for local development)
- **React Flow (`@xyflow/react`)** for diagram rendering and state management
- **UUID** for unique component identification
- **FastAPI** (Supplied backend simulation service)

## Project Structure

```text
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types/
│   │   └── architecture.ts
│   └── utils/
│       └── parser.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

### Important

Start the supplied simulation service before starting the frontend. The frontend expects the service to be available at `http://127.0.0.1:8000`.

The frontend uses a Vite development proxy for `/simulate` requests, so it does not need to call `http://127.0.0.1:8000` directly from the browser.

### Prerequisites

- Node.js 18 or later
- npm
- Python 3.10 or later
- The supplied `simulation_service.py` file

### 1. Start the Simulation Service

From the directory containing `simulation_service.py`:

```bash
python -m pip install fastapi uvicorn
python -m uvicorn simulation_service:app --reload
```

The service will be available at `http://127.0.0.1:8000`.

### 2. Start the Frontend

From the frontend project directory:

```bash
npm install
npm run dev
```

Open your browser to `http://localhost:5173`.

### 3. Try It

Type the following sequence in the command input (or use the autocomplete menu):

```text
add Firewall
connect Web Server to Firewall
connect Firewall to Database
```

Then click **Run Simulation** to see the async polling and trace visualization in action.

## Supported Commands

Commands are case-insensitive and extra spaces are safely trimmed.

### Add a node

| Input | Expected behaviour |
|---|---|
| `add Firewall` | Adds a node labelled Firewall |
| `create Database` | Adds a node labelled Database |
| `new API` | Adds a node labelled API |

### Remove a node

| Input | Expected behaviour |
|---|---|
| `remove Firewall` | Removes the Firewall node and all connected edges |
| `delete Database` | Removes the Database node and its connected edges |
| `drop UnknownNode` | Logs an error: Node not found |

### Connect nodes

| Input | Expected behaviour |
|---|---|
| `connect Internet to Web Server` | Adds a directed edge from Internet to Web Server |
| `link Web Server to Firewall` | Adds a directed edge between the two nodes |
| `connect Internet to Firewall` (again) | Logs a duplicate-edge error |

### Disconnect nodes

| Input | Expected behaviour |
|---|---|
| `disconnect Internet from Web Server` | Removes the edge from Internet to Web Server |
| `unlink Web Server from Firewall` | Removes the edge between those nodes |

## Example Session

```text
User: add Firewall
System: Added node: Firewall

User: connect Web Server to Firewall
System: Connected Web Server to Firewall

User: connect Web Server to Firewall
System: Error: Web Server is already connected to Firewall.

User: remove Firewall
System: Removed node: Firewall (and cleaned up connected edges).
```

## Simulation API Interaction

The frontend treats `simulation_service.py` as an external third-party API.

- **Start Simulation:** Clicking "Run Simulation" maps the React Flow nodes into the required JSON array and POSTs to `/simulate`. The service responds with a `202 Accepted` and a `simulation_id`.
- **Async Polling:** The UI enters a loading state and polls `GET /simulate/{simulation_id}` every 1.5 seconds (max 40 attempts / 60 seconds).
- **Trace Display:** Once the status is `completed`, the returned edges array is saved to state. The UI unlocks a stepper allowing the user to scrub through the trace step-by-step.
- **Empty Result:** If the simulation completes with no returned edges, the application displays a message indicating that at least two nodes are required to generate a trace.

## UI Behaviour

- **Architecture Canvas:** User-created nodes are dark slate; user-created edges are solid grey.
- **Simulation Trace:** Simulation paths overlay the canvas dynamically. Future steps are dashed light-blue lines, while the active step is a thick, solid blue line.
- **Node Highlighting:** Source and target nodes of the active simulation step glow blue. Selected nodes glow red.
- **Error Handling:** Network drops, API timeouts, or invalid commands do not crash the app; they are caught safely and displayed in the terminal-style chat log.

## Key Design Decisions

### React Flow for Visualization

React Flow’s node-and-edge model aligns closely with the architecture data required by the assignment. The node/edge paradigm aligns closely with the expected JSON payload, making architecture state synchronization straightforward.

### Separation of Parsing and State Mutation

Text input is parsed in a standalone utility (`utils/parser.ts`) into a strict TypeScript Discriminated Union (`CommandResult`). The UI component only updates the canvas if it receives a structurally valid command. This ensures the parser is decoupled from React's rendering lifecycle.

### Non-Destructive Trace Overlays

Simulation results are not permanently merged into the user's `edges` array. They are injected via a `useMemo` hook. This ensures the baseline architecture remains pure, while clearly distinguishing user-created connections from API-generated traces.

### Vite Development Proxy

To bypass CORS restrictions during local development without altering the provided backend, Vite proxies all requests from `/simulate` directly to `http://127.0.0.1:8000`.

## Assumptions and Limitations

- Node labels are treated as case-insensitive identifiers for command matching.
- The command parser is strictly rule-based/deterministic. An LLM is not utilized, adhering to the baseline requirements.
- Removing a node programmatically cascades to remove all attached edges to prevent orphaned connections.
- The supplied simulation service is assumed to be running locally on port 8000.
- A duplicate edge is defined as another architecture edge with the same source and target node. Reverse-direction edges, such as A → B and B → A, are treated as separate connections.

## Possible Improvements

- Add unit tests for the command parser utility.
- Implement persistence (e.g., `localStorage`) so architectures survive page reloads.
- Add an optional LLM-based intent parser as a fallback for complex, non-standard natural language requests.
- Support importing and exporting architecture definitions as JSON files.

This project demonstrates a lightweight, extensible interface for editing a system architecture and exploring simulation results. Its structure separates user input interpretation, architecture state, external simulation integration, and visualization, making it suitable for future extension into more advanced threat-modelling workflows.
