// SessionPilot for REAPER - Music Theory Service
// Uses the tonal library to resolve chords, scales, and notes into MIDI data.

const { Chord, Scale, Note } = require('tonal');

// ---------------------------------------------------------------------------
// Chord name normalization — bridges natural language to tonal's syntax
// ---------------------------------------------------------------------------

const QUALITY_MAP = {
  'major': '', 'maj': '', 'M': '',
  'minor': 'm', 'min': 'm',
  'dominant': '', 'dom': '',
  'diminished': 'dim', 'dimin': 'dim',
  'augmented': 'aug',
  'suspended': 'sus', 'sus': 'sus',
  'half diminished': 'm7b5', 'half-diminished': 'm7b5'
};

function normalizeChordName(input) {
  let name = input.trim();

  // Handle sharp/flat words and collapse surrounding spaces
  name = name.replace(/\s*\bsharp\b\s*/gi, '#').replace(/\s*\bflat\b\s*/gi, 'b');

  // Extract root note (letter + optional accidental)
  const rootMatch = name.match(/^([A-Ga-g][#b]?)\s*(.*)/);
  if (!rootMatch) return name;

  const root = rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1);
  let quality = rootMatch[2].trim().toLowerCase();

  // Handle compound qualities first: "minor 7" -> "m7", "major 7" -> "maj7"
  quality = quality
    .replace(/^minor\s*(\d+)/i, 'm$1')
    .replace(/^major\s*(\d+)/i, 'maj$1')
    .replace(/^dominant\s*(\d+)/i, '$1')
    .replace(/^diminished\s*(\d+)/i, 'dim$1')
    .replace(/^augmented\s*(\d+)/i, 'aug$1')
    .replace(/^suspended\s*(\d+)/i, 'sus$1');

  // Map standalone spoken qualities to tonal symbols
  for (const [spoken, symbol] of Object.entries(QUALITY_MAP)) {
    if (quality.toLowerCase() === spoken) {
      quality = symbol;
      break;
    }
  }

  quality = quality.replace(/\s+/g, '');

  return root + quality;
}

// ---------------------------------------------------------------------------
// Core resolution functions
// ---------------------------------------------------------------------------

function resolveChord(chordName, octave = 4) {
  const normalized = normalizeChordName(chordName);
  const chord = Chord.get(normalized);

  if (chord.empty) {
    throw new Error(`Unknown chord: "${chordName}" (normalized: "${normalized}")`);
  }

  // Resolve notes with ascending voicing — bump notes below the root up an octave
  const rootMidi = Note.midi(chord.notes[0] + octave);
  const notes = chord.notes.map((noteName, i) => {
    let midi = Note.midi(noteName + octave);
    if (midi === null || midi === undefined) {
      throw new Error(`Could not resolve note "${noteName + octave}" to MIDI`);
    }
    // If a chord tone is below the root, voice it up an octave
    if (i > 0 && midi < rootMidi) {
      midi += 12;
    }
    return { pitch: midi, name: Note.fromMidi(midi) };
  });

  return { notes, name: chord.name, symbol: chord.symbol, root: chord.tonic };
}

function resolveScale(scaleName, octave = 4) {
  const scale = Scale.get(scaleName);

  if (scale.empty) {
    // Try with "major" default
    const withMajor = Scale.get(scaleName + ' major');
    if (!withMajor.empty) return resolveScale(scaleName + ' major', octave);
    throw new Error(`Unknown scale: "${scaleName}"`);
  }

  // Build ascending notes — bump octave when pitch wraps below the root
  const rootMidi = Note.midi(scale.notes[0] + octave);
  let currentOctave = octave;

  const notes = scale.notes.map((noteName, i) => {
    let midi = Note.midi(noteName + currentOctave);
    if (midi === null || midi === undefined) {
      throw new Error(`Could not resolve note "${noteName + currentOctave}" to MIDI`);
    }
    // If this note is lower than the root, bump up an octave
    if (i > 0 && midi < rootMidi) {
      currentOctave++;
      midi = Note.midi(noteName + currentOctave);
    }
    return { pitch: midi, name: noteName + currentOctave };
  });

  // Add the root note one octave above the starting root for a complete run
  const octaveUpPitch = rootMidi + 12;
  if (notes[notes.length - 1].pitch < octaveUpPitch) {
    const octaveUpName = Note.fromMidi(octaveUpPitch);
    notes.push({ pitch: octaveUpPitch, name: octaveUpName });
  }

  return { notes, name: scale.name, root: scale.tonic, type: scale.type };
}

function noteToMidi(noteName) {
  const midi = Note.midi(noteName);
  if (midi === null || midi === undefined) {
    throw new Error(`Could not resolve note "${noteName}" to MIDI`);
  }
  return midi;
}

// ---------------------------------------------------------------------------
// High-level builders — produce the note arrays that flow to the bridge
// ---------------------------------------------------------------------------

function buildChordProgression(chordNames, options = {}) {
  const {
    octave = 4,
    beatsPerChord = 4,
    velocity = 96,
    channel = 0
  } = options;

  let currentQN = 0;

  return chordNames.map(name => {
    const resolved = resolveChord(name, octave);
    const entry = {
      chordName: name,
      displayName: resolved.symbol || resolved.name,
      startQN: currentQN,
      durationQN: beatsPerChord,
      notes: resolved.notes.map(n => ({
        pitch: n.pitch,
        velocity,
        channel
      }))
    };
    currentQN += beatsPerChord;
    return entry;
  });
}

function buildScaleRun(scaleName, options = {}) {
  const {
    octave = 4,
    beatsPerNote = 1,
    velocity = 80,
    channel = 0
  } = options;

  const resolved = resolveScale(scaleName, octave);
  let currentQN = 0;

  return resolved.notes.map(n => {
    const entry = {
      noteName: n.name,
      startQN: currentQN,
      durationQN: beatsPerNote,
      pitch: n.pitch,
      velocity,
      channel
    };
    currentQN += beatsPerNote;
    return entry;
  });
}

function buildMelodyFromNotes(noteNames, options = {}) {
  const {
    beatsPerNote = 1,
    velocity = 96,
    channel = 0
  } = options;

  let currentQN = 0;

  return noteNames.map(name => {
    const pitch = noteToMidi(name);
    const entry = {
      noteName: name,
      startQN: currentQN,
      durationQN: beatsPerNote,
      pitch,
      velocity,
      channel
    };
    currentQN += beatsPerNote;
    return entry;
  });
}

// ---------------------------------------------------------------------------
// Utility: flatten chord progression to flat note array for bridge
// ---------------------------------------------------------------------------

function flattenProgression(progression) {
  const allNotes = [];
  for (const chord of progression) {
    for (const note of chord.notes) {
      allNotes.push({
        pitch: note.pitch,
        velocity: note.velocity,
        channel: note.channel,
        startQN: chord.startQN,
        durationQN: chord.durationQN
      });
    }
  }
  return allNotes;
}

function flattenNoteSequence(noteSequence) {
  return noteSequence.map(n => ({
    pitch: n.pitch,
    velocity: n.velocity,
    channel: n.channel,
    startQN: n.startQN,
    durationQN: n.durationQN
  }));
}

module.exports = {
  normalizeChordName,
  resolveChord,
  resolveScale,
  noteToMidi,
  buildChordProgression,
  buildScaleRun,
  buildMelodyFromNotes,
  flattenProgression,
  flattenNoteSequence
};
