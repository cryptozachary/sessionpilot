# SessionPilot for REAPER

AI Recording Engineer Assistant for REAPER DAW. SessionPilot provides a natural language interface for controlling REAPER, with specialized workflows for vocal recording sessions, monitoring diagnostics, and track organization.

## Features

- Natural language recording assistant (text, voice, and quick-action buttons)
- Transport controls (play, stop, record, pause, go-to-bar) from chat, voice, keyboard, or UI
- Keyboard shortcuts for transport (Space, R, Home, End, Esc)
- Volume and pan control via voice commands, chat, or UI sliders
- Vocal session setup workflows (lead, doubles, adlibs, full stack)
- Punch-in and loop-punch preparation with pre-roll
- FX chain management (insert, remove, bypass plugins per track)
- Batch recording setup (playlist-style multi-song sessions)
- Export/bounce workflows (mix, stems, or both)
- Marker navigation ("go to chorus", "jump to verse 2")
- Undo/redo with history log
- Monitoring and input level diagnostics
- Track organization with folder management, color-coding, and rough mixing
- Comp takes review and selection
- Song structure marking (verse/chorus/bridge markers and regions)
- Action preview and confirmation for destructive operations
- Transport-aware action gating (blocks destructive ops while recording)
- Command chaining ("arm track then hit record")
- Action queue for sequential command execution
- Voice command help overlay (press ? or click help button)
- Real-time session state display via WebSocket
- Optional Claude LLM fallback for ambiguous messages
- Context-aware fallback suggestions based on session state

## Quick Start

```
npm install
npm start
# Open http://localhost:3000
```

## Architecture Overview

```
+----------------------------------------------------------------------+
|                      Frontend (Vanilla JS)                            |
|  Chat | Transport | Voice | Quick Actions | Shortcuts | Help Overlay  |
+----------------------------------+-----------------------------------+
                                   | REST + WebSocket
+----------------------------------+-----------------------------------+
|                       Express Backend                                |
|  Chat Orchestrator -> AI Orchestrator (regex) -> LLM Planner (Claude)|
|  Workflow Service (17 workflows) | Action Routes (56+ bridge methods)|
+----------------------------------+-----------------------------------+
                                   | Bridge Interface
+----------------------------------+-----------------------------------+
|                    REAPER Bridge Layer                                |
|  MockBridge (dev) | JsonQueueBridge (file IPC) | (future: WS/HTTP)   |
+----------------------------------+-----------------------------------+
                                   | JSON file queue
+----------------------------------+-----------------------------------+
|              SessionPilotBridge.lua (REAPER ReaScript)               |
+----------------------------------------------------------------------+
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
| GET | /api/transport | Current transport state (play/stop/record position) |
| GET | /api/action-log | Recent action history |

## WebSocket

Connect to `ws://localhost:3000` for real-time updates:

- `session_update` - periodic session state push
- `initial_state` - sent on connection
- `transport_update` - transport state changes
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
| manageFxChain | Insert, remove, or bypass FX plugins on tracks |
| batchRecording | Playlist-style multi-song recording setup with markers and regions |
| exportBounce | Render/export mix, stems, or both |

## Direct Actions

These actions execute immediately without a workflow preview:

| Action | Description |
|--------|-------------|
| play, stop, pause, record | Transport controls |
| goToPosition, goToStart, goToEnd | Cursor navigation (supports bar numbers) |
| goToMarker | Navigate to a named marker or region ("chorus", "verse 2") |
| armTrack, disarmTrack | Recording arm toggle |
| toggleMonitoring | Input monitoring on/off |
| muteTrack, soloTrack | Track mute/solo |
| setTrackVolume, setTrackPan | Volume and pan control |
| createTrack, renameTrack, duplicateTrack | Track management |
| moveTrackToFolder | Move track into a folder track |
| insertMarker, createRegion | Markers and regions |
| undo, redo | Undo/redo history |
| getTrackFx, removeFx, toggleFxBypass | FX management |
| renderProject, renderStems | Rendering/export |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause toggle |
| Escape | Stop transport |
| R | Toggle recording |
| Home | Go to start |
| End | Go to end |
| ? | Show help overlay |

Shortcuts are active when the chat input is not focused.

## Voice Commands

With voice control enabled (Web Speech API), you can say:

- "Hit play" / "Stop" / "Pause" / "Hit record" / "Roll tape"
- "Go to start" / "From the top" / "Go to bar 16"
- "Go to chorus" / "Go to verse 2" / "Jump to marker Bridge"
- "Arm this track" / "Disarm" / "Solo" / "Mute"
- "Volume up" / "Louder" / "Volume 80%" / "Turn down"
- "Pan left" / "Pan right" / "Pan center" / "Pan 50% left"
- "Set me up to record vocals" / "Punch loop bars 8 to 16"
- "Preflight check" / "Rough mix" / "Comp takes"
- "Undo" / "Redo"

## Command Chaining

You can chain multiple commands with "then":

- "Arm track then hit record"
- "Go to bar 8 then hit play"
- "Stop then go to start"

## License

MIT
