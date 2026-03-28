# SessionPilot for REAPER

AI Recording Engineer Assistant for REAPER DAW. SessionPilot provides a natural language interface for controlling REAPER, with specialized workflows for vocal recording sessions, monitoring diagnostics, and track organization.

## Features

- Natural language recording assistant (text, voice, and quick-action buttons)
- Transport controls (play, stop, record, pause, go-to-bar) from chat, voice, keyboard, or UI
- Keyboard shortcuts for transport (Space, R, Home, End, Esc)
- Volume and pan control via voice commands, chat, or UI sliders
- Vocal session setup workflows (lead, doubles, adlibs, full stack)
- Punch-in and loop-punch preparation with pre-roll
- FX chain management (insert, remove, bypass, and parameter control per track)
- FX parameter control with real-time sliders (EQ freq, compressor threshold, etc.)
- MIDI/instrument track creation with automatic input routing
- MIDI composition via natural language — chord progressions, scale runs, and note entry
- Music theory engine powered by [tonal](https://github.com/tonaljs/tonal) (chords, scales, voicings)
- Session template system — save and restore full session configurations
- Peak meter visualization (per-track sidebar meters and selected track stereo meter)
- Track type detection and display (audio, MIDI, instrument, folder)
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
- Real-time session state display via WebSocket with file-change-driven updates
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
|  Workflow Service (17 workflows) | Music Theory | Template Service    |
|  Action Routes (60+ bridge methods)                                  |
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
  - `services/` - AI orchestrator, workflow service, music theory, template service, action log
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
| GET | /api/tracks/:id/fx/:idx/params | FX parameters for a specific plugin |
| GET | /api/session-templates | List saved session templates |
| GET | /api/session-templates/:id | Get a specific template |
| POST | /api/session-templates | Save current session as template |
| POST | /api/session-templates/:id/load | Load a session template |
| DELETE | /api/session-templates/:id | Delete a session template |
| GET | /api/action-log | Recent action history |

## WebSocket

Connect to `ws://localhost:3000` for real-time updates:

- `session_update` - session state push (file-change-driven + interval fallback)
- `initial_state` - sent on connection
- `transport_update` - transport state changes
- `action_executed` - sent when actions complete
- `peak_update` - track peak meter data (250ms poll)

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
| createMidiTrack | Create MIDI/instrument track with optional plugin |
| moveTrackToFolder | Move track into a folder track |
| insertMarker, createRegion | Markers and regions |
| insertMidiNotes | Write MIDI notes into a track (chords, scales, melodies) |
| createMidiItem | Create an empty MIDI item on a track |
| getFxParameters, setFxParameter, setFxPreset | FX parameter control |
| getTrackFx, removeFx, toggleFxBypass | FX management |
| getTrackPeaks | Real-time peak meter data |
| undo, redo | Undo/redo history |
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
- "Create a MIDI track" / "Add an instrument track with ReaSynth"
- "Chord progression with C, Am, F, G" / "Chords using C major and E minor"
- "Play a C major scale" / "Write A minor pentatonic scale in octave 3"
- "Write midi notes C4 E4 G4 B4"
- "Set threshold to -20 on the compressor" / "Show me the parameters"
- "Save template as My Session" / "Load template Vocal Session" / "List my templates"
- "Undo" / "Redo"

## MIDI Composition

SessionPilot can write MIDI notes directly into REAPER from natural language. The music theory engine uses [tonal](https://github.com/tonaljs/tonal) to resolve chord names, scales, and note names into MIDI data.

### Chord Progressions

```
"chord progression with C, Am, F, G"
"create a chord progression using C major, E minor, and G dominant 7"
"write chords Dm7, G7, Cmaj7 with half notes"
"chords using F sharp minor and B flat major in octave 3"
```

Supports major, minor, 7th, maj7, dim, aug, sus, and more. Natural language names like "C major", "E minor", "G dominant 7", "F sharp minor" are normalized automatically.

### Scale Runs

```
"play a C major scale"
"write A minor pentatonic scale in octave 3"
"create a D dorian scale"
"E flat blues scale"
```

Supports major, minor, pentatonic, blues, dorian, mixolydian, lydian, phrygian, locrian, harmonic minor, melodic minor, whole tone, and more.

### Direct Note Entry

```
"write midi notes C4 E4 G4 B4"
"insert midi notes D3 F#3 A3"
```

Notes are written sequentially as quarter notes. If no MIDI track is selected, one is created automatically.

### Options

- **Octave**: "in octave 3" (default: 4)
- **Duration**: "whole notes", "half notes", "quarter notes", "2 beats each"
- **Velocity**: "soft" (60), "loud" (120), "velocity 100"

## Session Templates

Save and restore full session configurations (tracks, markers, regions):

```
"save template as My Vocal Session"
"list my templates"
"load template My Vocal Session"
```

Templates are stored as JSON files in the `templates/` directory.

## Command Chaining

You can chain multiple commands with "then":

- "Arm track then hit record"
- "Go to bar 8 then hit play"
- "Stop then go to start"

## License

MIT
