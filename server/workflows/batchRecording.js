const { v4: uuidv4 } = require('uuid');

const DEFAULT_SONG_GAP_BARS = 4;
const DEFAULT_SONG_LENGTH_BARS = 80; // ~2.5 min at 120 BPM

function barToSeconds(bar, bpm) {
  if (!bpm || bpm <= 0) bpm = 120;
  return (bar - 1) * (4 * 60 / bpm);
}

module.exports = {
  name: 'batchRecording',
  description: 'Set up playlist-style recording for multiple songs in one session.',

  async preview(bridge, args = {}) {
    const songs = args.songs || [];

    if (songs.length === 0) {
      return {
        workflow: 'batchRecording',
        summary: 'Batch recording setup. Provide a list of song names to get started.',
        requiresConfirmation: false,
        proposedActions: [{
          id: uuidv4(),
          type: 'promptForSongs',
          label: 'Enter song names',
          description: 'Tell me the song names separated by commas, e.g. "songs: Track 1, Track 2, Track 3".',
          riskLevel: 'low',
          requiresConfirmation: false,
          args: {}
        }],
        checklist: [
          'No songs provided yet',
          'Say "batch record songs: Song A, Song B, Song C"',
          'Each song will get a marker and region for easy navigation'
        ],
        expectedOutcome: 'Waiting for song list.'
      };
    }

    // Get project BPM
    let bpm = 120;
    try {
      const projectResult = await bridge.getProjectSummary();
      bpm = projectResult.data?.bpm || 120;
    } catch (_e) { /* use default */ }

    const songLengthBars = args.songLengthBars || DEFAULT_SONG_LENGTH_BARS;
    const gapBars = args.gapBars || DEFAULT_SONG_GAP_BARS;

    const proposedActions = [];
    const checklist = [`BPM: ${bpm}`, `Songs: ${songs.length}`];
    let currentBar = 1;

    for (const song of songs) {
      const name = song.name || song;
      const startBar = currentBar;
      const endBar = startBar + songLengthBars - 1;
      const startTime = barToSeconds(startBar, bpm);
      const endTime = barToSeconds(endBar + 1, bpm);

      proposedActions.push({
        id: uuidv4(),
        type: 'createSongRegion',
        label: `"${name}" — bars ${startBar} to ${endBar}`,
        description: `Create marker and region for "${name}" (${Math.round(endTime - startTime)}s).`,
        riskLevel: 'low',
        requiresConfirmation: false,
        args: { name, startBar, endBar, startTime, endTime }
      });

      checklist.push(`${name}: bars ${startBar}–${endBar}`);
      currentBar = endBar + gapBars + 1;
    }

    return {
      workflow: 'batchRecording',
      summary: `Batch recording setup for ${songs.length} song(s). Markers and regions will be created.`,
      requiresConfirmation: true,
      proposedActions,
      checklist,
      expectedOutcome: `${songs.length} song markers and regions created for playlist-style recording.`
    };
  },

  async execute(bridge, args = {}) {
    const executedActions = [];
    const songs = args.songs || [];

    if (songs.length === 0) {
      return {
        workflow: 'batchRecording',
        summary: 'No songs provided. Use "batch record songs: Song A, Song B" to set up.',
        requiresConfirmation: false,
        proposedActions: [],
        checklist: ['No songs to process'],
        expectedOutcome: 'No action taken.',
        executedActions
      };
    }

    let bpm = 120;
    try {
      const projectResult = await bridge.getProjectSummary();
      bpm = projectResult.data?.bpm || 120;
    } catch (_e) { /* use default */ }

    const songLengthBars = args.songLengthBars || DEFAULT_SONG_LENGTH_BARS;
    const gapBars = args.gapBars || DEFAULT_SONG_GAP_BARS;
    let currentBar = 1;

    for (const song of songs) {
      const name = song.name || song;
      const startBar = currentBar;
      const endBar = startBar + songLengthBars - 1;
      const startTime = barToSeconds(startBar, bpm);
      const endTime = barToSeconds(endBar + 1, bpm);

      // Create marker at song start
      try {
        await bridge.insertMarker({ position: startTime, name, bar: startBar });
        executedActions.push({ action: 'insertMarker', name, bar: startBar });
      } catch (err) {
        executedActions.push({ action: 'insertMarker', name, note: 'Failed: ' + err.message });
      }

      // Create region spanning the song
      try {
        await bridge.createRegion({ start: startTime, end: endTime, name, startBar, endBar });
        executedActions.push({ action: 'createRegion', name, startBar, endBar });
      } catch (err) {
        executedActions.push({ action: 'createRegion', name, note: 'Failed: ' + err.message });
      }

      currentBar = endBar + gapBars + 1;
    }

    // Navigate to first song if requested
    if (args.navigateTo) {
      const targetSong = songs.find(s => (s.name || s) === args.navigateTo);
      if (targetSong) {
        try {
          const startTime = barToSeconds(1, bpm);
          await bridge.setTimeSelection({ start: startTime, end: startTime + 10 });
          executedActions.push({ action: 'navigateToSong', song: args.navigateTo });
        } catch (err) {
          executedActions.push({ action: 'navigateToSong', note: 'Failed: ' + err.message });
        }
      }
    }

    return {
      workflow: 'batchRecording',
      summary: `Batch recording setup complete. ${songs.length} song(s) mapped with markers and regions.`,
      requiresConfirmation: false,
      proposedActions: [],
      checklist: songs.map(s => `${s.name || s}: created marker + region`),
      expectedOutcome: `${songs.length} songs ready for playlist-style recording.`,
      executedActions
    };
  }
};
