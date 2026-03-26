# SessionPilot for REAPER

AI Recording Engineer Assistant for REAPER DAW. SessionPilot provides a natural language interface for controlling REAPER, with specialized workflows for vocal recording sessions, monitoring diagnostics, and track organization.

## Features

- Natural language recording assistant
- Vocal session setup workflows
- Punch-in preparation
- Monitoring diagnostics
- Track organization and color-coding
- Action preview and confirmation
- Real-time session state display

## Quick Start

```
npm install
npm start
# Open http://localhost:3000
```

## Architecture Overview

```
+---------------------------------------------------------+
|                    Frontend (Vanilla JS)                 |
|  Chat | Session Sidebar | Track Panel | Action Cards    |
+---------------------------+-----------------------------+
                            | REST + WebSocket
+---------------------------+-----------------------------+
|                  Express Backend                        |
|  Routes -> AI Orchestrator -> Workflow Service           |
+---------------------------+-----------------------------+
                            | Bridge Interface
+---------------------------+-----------------------------+
|              REAPER Bridge Layer                         |
|  MockBridge | JsonQueueBridge | (future: WS/HTTP)       |
+---------------------------------------------------------+
```

### Key Directories

- `server/` - Express backend
  - `bridge/` - REAPER bridge abstraction and implementations
  - `services/` - AI orchestrator, workflow service, action log
  - `workflows/` - Individual workflow handlers
  - `routes/` - REST API endpoints
  - `models/` - Data model factories
  - `websocket/` - WebSocket server
- `public/` - Frontend
  - `components/` - UI components
  - `modules/` - State management, API client, WebSocket client
- `reaper/` - REAPER Lua bridge script

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_REAL_BRIDGE` | `0` | Set to `1` to use the JSON queue bridge with a real REAPER instance |
| `REAPER_BRIDGE_DIR` | `./reaper_bridge` | Path to the bridge directory (commands/results/state.json) |
| `ANTHROPIC_API_KEY` | (none) | Optional. Enables Claude LLM fallback for ambiguous messages |
| `SESSIONPILOT_PLANNER_MODE` | `heuristic` | `heuristic` (default), `heuristic-only` (no LLM), or `off` |
| `PORT` | `3000` | Server port |

## Connecting to REAPER

The app defaults to `MockReaperBridge` for easy first-run. To connect to a real REAPER instance:

### JSON Queue Bridge

1. Copy `reaper/SessionPilotBridge.lua` into your REAPER Scripts folder
2. Load and run the script in REAPER (Actions > Load ReaScript)
3. Start the server with the real bridge:

```bash
USE_REAL_BRIDGE=1 npm start
```

### Option 2: Custom Bridge

Extend `ReaperBridge` base class and implement all methods. The bridge contract ensures the rest of the app works unchanged.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check with bridge status and system info |
| GET | /api/session | Project summary |
| GET | /api/tracks | All tracks |
| GET | /api/selected-track | Currently selected track |
| GET | /api/connection-status | Bridge connection status |
| GET | /api/markers | Markers and regions |
| GET | /api/workflows | Available workflows |
| POST | /api/chat | Send message to AI assistant |
| POST | /api/actions/execute | Execute action or workflow |
| POST | /api/actions/preview | Preview workflow actions |
| GET | /api/action-log | Recent action history |

## WebSocket

Connect to `ws://localhost:3000` for real-time updates:

- `session_update` - periodic session state push
- `initial_state` - sent on connection
- `action_executed` - sent when actions complete

## MCP Server Compatibility

The bridge layer is designed for future MCP server exposure:

- Bridge read methods -> MCP resources/read tools
- Bridge action methods -> MCP tools
- Workflow preview/execute -> Higher-level MCP tools

Method signatures use JSON-schema-friendly argument objects.

## Built-in Workflows

| Workflow | Description |
|----------|-------------|
| setupLeadVocal | Create and arm a lead vocal track |
| setupLeadDoubleAdlib | Full vocal stack with folder |
| preparePunchIn | Set up punch-in with markers and regions |
| organizeSessionTracks | Sort tracks into folders |
| colorCodeVocals | Color-code vocal tracks by role |
| diagnoseMonitoringIssue | Troubleshoot "can't hear myself" |
| diagnoseLowInputIssue | Troubleshoot low input levels |
| setupHeadphoneMix | Set up a cue mix with reverb for vocal monitoring |
| compTakes | Review and manage vocal takes for comping |
| roughMix | Quick rough mix with levels, panning, and bussing |
| markSongStructure | Mark verse/chorus/bridge sections with markers and regions |
| sessionNotes | Add timestamped session notes as markers |
| preflightCheck | Pre-session checklist for recording readiness |
| quickPunchLoop | Loop punch-in with pre-roll and auto-crossfade |

## License

MIT
