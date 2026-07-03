// SessionPilot for REAPER - AI Mode Tool Registry
//
// Produces the Anthropic `tools` array (+ a byName lookup) from the app's
// real capabilities: read-only session/state queries execute live during the
// agent loop; everything else (direct actions + workflows) is recorded as a
// plan (`toAction`) and executed later via the existing actions pipeline.
//
// Parity is enforced by test/toolRegistry.test.js: every DIRECT_ACTION_MAP
// key and every workflow name must have a matching tool, or be listed in
// EXCLUDED (reserved for actions that are purely read-only and already
// covered by one of the READ_TOOLS below).

const workflowService = require('./workflowService');
const { buildSessionContext } = require('./contextBuilder');

// Actions kept out of the write-tool surface:
//  - getTrackFx / getFxParameters: read-only, already exposed as READ_TOOLS
//    (get_track_fx / get_fx_parameters) below.
//  - getTrackPeaks: transient real-time meter data with no meaningful
//    "plan and execute later" semantics — intentionally omitted from the
//    agent's toolset (it has no corresponding read tool).
const EXCLUDED = new Set(['getTrackFx', 'getFxParameters', 'getTrackPeaks']);

const trackIdProp = {
  trackId: { type: 'string', description: 'Track id (e.g. "track_2"). Omit to target the currently selected track.' },
  trackIndex: { type: 'number', description: '0-based track index. Used to resolve the track if trackId is not provided.' }
};

// ---------------------------------------------------------------------------
// READ tools — run live during the agent loop via bridge calls.
// ---------------------------------------------------------------------------

const READ_TOOLS = [
  {
    name: 'get_session_state',
    description: 'Full session snapshot: tracks (armed/monitoring/fx/takes/volume/pan), transport, markers/regions, health warnings.',
    input_schema: { type: 'object', properties: {} },
    execute: async (bridge) => buildSessionContext(bridge)
  },
  {
    name: 'list_takes',
    description: 'List the takes on a track (for comping).',
    input_schema: { type: 'object', properties: { ...trackIdProp } },
    execute: async (bridge, input) => (await bridge.listTakes({ trackId: input.trackId })).data
  },
  {
    name: 'get_track_fx',
    description: 'List the FX/plugins on a track.',
    input_schema: { type: 'object', properties: { ...trackIdProp } },
    execute: async (bridge, input) => (await bridge.getTrackFx({ trackId: input.trackId })).data
  },
  {
    name: 'get_fx_parameters',
    description: 'List parameters of one FX on a track.',
    input_schema: {
      type: 'object',
      properties: { ...trackIdProp, fxIndex: { type: 'number', description: '0-based FX index' } },
      required: ['fxIndex']
    },
    execute: async (bridge, input) => (await bridge.getFxParameters({ trackId: input.trackId, fxIndex: input.fxIndex })).data
  }
];

// ---------------------------------------------------------------------------
// WRITE tools — one entry per DIRECT_ACTION_MAP action (minus EXCLUDED).
// Recorded as a plan ({ type, args }); executed later via the actions
// pipeline (server/routes/actions.js DIRECT_ACTION_MAP).
// ---------------------------------------------------------------------------

const WRITE_ACTIONS = [
  // Track creation / identity
  {
    type: 'createTrack',
    description: 'Create a new audio track.',
    properties: {
      name: { type: 'string', description: 'Track name' },
      color: { type: 'string', description: 'Track color, e.g. hex "#FF0000"' },
      insertIndex: { type: 'number', description: '0-based index to insert the track at' },
      parentTrackId: { type: 'string', description: 'Parent folder track id, to nest inside a folder' }
    }
  },
  {
    type: 'renameTrack',
    description: 'Rename a track.',
    properties: { ...trackIdProp, name: { type: 'string' } },
    required: ['name']
  },
  {
    type: 'setTrackColor',
    description: 'Set a track color.',
    properties: { ...trackIdProp, color: { type: 'string', description: 'Color, e.g. hex "#FF0000"' } },
    required: ['color']
  },
  {
    type: 'selectTrack',
    description: 'Select a track in the REAPER track list.',
    properties: { ...trackIdProp }
  },
  {
    type: 'armTrack',
    description: 'Arm a track for recording.',
    properties: { ...trackIdProp }
  },
  {
    type: 'disarmTrack',
    description: 'Disarm a track.',
    properties: { ...trackIdProp }
  },
  {
    type: 'toggleMonitoring',
    description: 'Turn input monitoring on/off for a track.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } },
    required: ['enabled']
  },
  {
    type: 'muteTrack',
    description: 'Mute/unmute a track.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } },
    required: ['enabled']
  },
  {
    type: 'soloTrack',
    description: 'Solo/unsolo a track.',
    properties: { ...trackIdProp, enabled: { type: 'boolean' } },
    required: ['enabled']
  },
  {
    type: 'duplicateTrack',
    description: 'Duplicate a track.',
    properties: { ...trackIdProp, newName: { type: 'string', description: 'Name for the duplicated track' } }
  },
  {
    type: 'createFolderTrack',
    description: 'Create a folder track to group other tracks.',
    properties: { name: { type: 'string' }, color: { type: 'string' } }
  },

  // Markers / regions
  {
    type: 'insertMarker',
    description: 'Insert a marker at a position or bar.',
    properties: {
      name: { type: 'string' },
      position: { type: 'number', description: 'Position in seconds' },
      bar: { type: 'number', description: 'Bar number (alternative to position)' }
    }
  },
  {
    type: 'createRegion',
    description: 'Create a region on the timeline.',
    properties: {
      name: { type: 'string' },
      start: { type: 'number', description: 'Start position in seconds' },
      end: { type: 'number', description: 'End position in seconds' },
      startBar: { type: 'number' },
      endBar: { type: 'number' }
    }
  },

  // Templates / FX chains
  {
    type: 'loadTrackTemplate',
    description: 'Load a track template (FX/routing preset) onto a track.',
    properties: { ...trackIdProp, templateName: { type: 'string' } },
    required: ['templateName']
  },
  {
    type: 'loadFxChain',
    description: 'Load an FX chain preset onto a track.',
    properties: { ...trackIdProp, fxChainName: { type: 'string' } },
    required: ['fxChainName']
  },

  // Transport
  { type: 'play', description: 'Start playback.', properties: {} },
  { type: 'stop', description: 'Stop transport.', properties: {} },
  { type: 'pause', description: 'Pause playback.', properties: {} },
  { type: 'record', description: 'Start recording (refused if no track is armed).', properties: {} },
  {
    type: 'goToPosition',
    description: 'Move the play cursor to a position or bar.',
    properties: {
      position: { type: 'number', description: 'Position in seconds' },
      bar: { type: 'number', description: 'Bar number (alternative to position)' }
    }
  },
  { type: 'goToStart', description: 'Move the play cursor to the project start.', properties: {} },
  { type: 'goToEnd', description: 'Move the play cursor to the project end.', properties: {} },
  {
    type: 'goToMarker',
    description: 'Move the play cursor to a named marker.',
    properties: { name: { type: 'string' } },
    required: ['name']
  },

  // Volume / pan
  {
    type: 'setTrackVolume',
    description: 'Set track volume (linear, 1.0 = unity).',
    properties: { ...trackIdProp, volume: { type: 'number' } },
    required: ['volume']
  },
  {
    type: 'setTrackPan',
    description: 'Set track pan (-1 left .. 1 right).',
    properties: { ...trackIdProp, pan: { type: 'number' } },
    required: ['pan']
  },

  // History
  { type: 'undo', description: 'Undo the last action.', properties: {} },
  { type: 'redo', description: 'Redo the last undone action.', properties: {} },

  // FX control (mutating)
  {
    type: 'removeFx',
    description: 'Remove an FX/plugin from a track.',
    properties: { ...trackIdProp, fxIndex: { type: 'number', description: '0-based FX index' } },
    required: ['fxIndex']
  },
  {
    type: 'toggleFxBypass',
    description: 'Bypass or enable an FX/plugin on a track.',
    properties: { ...trackIdProp, fxIndex: { type: 'number' }, bypassed: { type: 'boolean' } },
    required: ['fxIndex', 'bypassed']
  },
  {
    type: 'setFxParameter',
    description: 'Set an FX parameter value on a track.',
    properties: {
      ...trackIdProp,
      fxIndex: { type: 'number' },
      paramIndex: { type: 'number' },
      value: { type: 'number' }
    },
    required: ['fxIndex', 'paramIndex', 'value']
  },
  {
    type: 'setFxPreset',
    description: 'Load a named preset on an FX/plugin.',
    properties: { ...trackIdProp, fxIndex: { type: 'number' }, presetName: { type: 'string' } },
    required: ['fxIndex', 'presetName']
  },

  // Render / bounce
  {
    type: 'renderProject',
    description: 'Render/export the full project to an audio file.',
    properties: {
      outputPath: { type: 'string', description: 'Output file path' },
      format: { type: 'string', description: 'Render format, e.g. "wav", "mp3"' },
      sampleRate: { type: 'number' },
      bounds: { type: 'string', description: 'Render bounds, e.g. "project", "timeSelection"' }
    }
  },
  {
    type: 'renderStems',
    description: 'Render selected tracks as individual stem audio files.',
    properties: {
      outputPath: { type: 'string' },
      format: { type: 'string' },
      trackIds: { type: 'array', items: { type: 'string' }, description: 'Track ids to render as stems; omit for all tracks' }
    }
  },

  // MIDI / instrument tracks
  {
    type: 'createMidiTrack',
    description: 'Create a new MIDI/instrument track.',
    properties: {
      name: { type: 'string' },
      color: { type: 'string' },
      insertIndex: { type: 'number' },
      midiChannel: { type: 'number' },
      instrument: { type: 'string', description: 'Instrument/plugin name to load' }
    }
  },
  {
    type: 'insertMidiNotes',
    description: 'Insert MIDI notes into a track, creating a MIDI item.',
    properties: {
      ...trackIdProp,
      notes: { type: 'array', items: { type: 'object' }, description: 'Array of MIDI note objects' },
      startPositionQN: { type: 'number', description: 'Start position in quarter notes' },
      lengthQN: { type: 'number', description: 'Length in quarter notes' },
      itemName: { type: 'string' }
    },
    required: ['notes']
  },
  {
    type: 'createMidiItem',
    description: 'Create an empty MIDI item on a track.',
    properties: {
      ...trackIdProp,
      startPositionQN: { type: 'number' },
      lengthQN: { type: 'number' },
      itemName: { type: 'string' }
    }
  }
];

function actionTool(a) {
  return {
    def: {
      name: a.type,
      description: a.description,
      input_schema: {
        type: 'object',
        properties: a.properties || {},
        ...(a.required ? { required: a.required } : {})
      }
    },
    entry: { kind: 'write', toAction: (input) => ({ type: a.type, args: input || {} }) }
  };
}

// A few workflows have common, well-known parameters worth exposing at the
// top level so the model supplies them directly instead of forgetting to nest
// them under a generic `args` object. Everything else falls back to a generic
// optional `args` object.
const WORKFLOW_SCHEMAS = {
  preparePunchIn: {
    properties: {
      startBar: { type: 'number', description: 'Bar to start the punch-in range' },
      endBar: { type: 'number', description: 'Bar to end the punch-in range' }
    }
  },
  quickPunchLoop: {
    properties: {
      startBar: { type: 'number', description: 'Bar to start the loop/problem section' },
      endBar: { type: 'number', description: 'Bar to end the loop/problem section' },
      preRollBeats: { type: 'number', description: 'Beats of pre-roll before the punch-in' }
    }
  }
};

function workflowTools() {
  return workflowService.listWorkflows().map((w) => {
    const custom = WORKFLOW_SCHEMAS[w.name];
    if (custom) {
      const fieldNames = Object.keys(custom.properties);
      return {
        def: {
          name: 'workflow_' + w.name,
          description: `Workflow: ${w.description}`,
          input_schema: { type: 'object', properties: custom.properties }
        },
        entry: {
          kind: 'write',
          toAction: (input) => {
            const args = {};
            const src = input || {};
            for (const key of fieldNames) {
              if (src[key] !== undefined) args[key] = src[key];
            }
            return { type: '__workflow__', workflow: w.name, args };
          }
        }
      };
    }
    return {
      def: {
        name: 'workflow_' + w.name,
        description: `Workflow: ${w.description}`,
        input_schema: {
          type: 'object',
          properties: { args: { type: 'object', description: 'Optional workflow arguments.' } }
        }
      },
      entry: { kind: 'write', toAction: (input) => ({ type: '__workflow__', workflow: w.name, args: (input && input.args) || {} }) }
    };
  });
}

function buildTools() {
  const tools = [];
  const byName = {};

  for (const rt of READ_TOOLS) {
    tools.push({ name: rt.name, description: rt.description, input_schema: rt.input_schema });
    byName[rt.name] = { kind: 'read', execute: rt.execute };
  }

  for (const a of WRITE_ACTIONS) {
    const { def, entry } = actionTool(a);
    tools.push(def);
    byName[def.name] = entry;
  }

  for (const wt of workflowTools()) {
    tools.push(wt.def);
    byName[wt.def.name] = wt.entry;
  }

  tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } };

  return { tools, byName };
}

module.exports = { buildTools, EXCLUDED };
