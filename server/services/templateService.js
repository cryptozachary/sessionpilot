// SessionPilot for REAPER - Session Template Service
// Saves and loads full session configurations as JSON templates.

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMPLATES_DIR = path.resolve('./templates');

async function ensureDir() {
  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

/**
 * List all saved session templates.
 */
async function listTemplates() {
  await ensureDir();
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templates = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(TEMPLATES_DIR, file), 'utf-8');
        const tpl = JSON.parse(raw);
        templates.push({
          id: tpl.id,
          name: tpl.name,
          description: tpl.description || '',
          createdAt: tpl.createdAt,
          trackCount: (tpl.tracks || []).length,
          markerCount: (tpl.markers || []).length
        });
      } catch (e) {
        // Skip invalid files
      }
    }
    return templates;
  } catch (e) {
    return [];
  }
}

/**
 * Get a specific template by ID.
 */
async function getTemplate(templateId) {
  await ensureDir();
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Save current session state as a template.
 */
async function saveTemplate(bridge, name, description) {
  await ensureDir();
  const id = uuidv4();

  const [sessionResult, tracksResult, markersResult] = await Promise.all([
    bridge.getProjectSummary(),
    bridge.listTracks(),
    bridge.getMarkersAndRegions()
  ]);

  const session = sessionResult.data || {};
  const tracks = tracksResult.data || [];
  const markersData = markersResult.data || {};

  const template = {
    id,
    name: name || session.projectName || 'Untitled Template',
    description: description || '',
    createdAt: new Date().toISOString(),
    bpm: session.bpm,
    sampleRate: session.sampleRate,
    tracks: tracks.map(t => ({
      name: t.name,
      color: t.color,
      trackType: t.trackType || 'audio',
      midiInput: t.midiInput || null,
      instrumentPlugin: t.instrumentPlugin || null,
      fxNames: t.fxNames || [],
      volume: t.volume,
      pan: t.pan,
      folderDepth: t.folderDepth || 0
    })),
    markers: (markersData.markers || []).map(m => ({
      name: m.name,
      position: m.position,
      bar: m.bar
    })),
    regions: (markersData.regions || []).map(r => ({
      name: r.name,
      start: r.start,
      end: r.end,
      startBar: r.startBar,
      endBar: r.endBar
    }))
  };

  await fs.writeFile(path.join(TEMPLATES_DIR, `${id}.json`), JSON.stringify(template, null, 2));
  return template;
}

/**
 * Load a template into the current session by creating tracks, markers, and regions.
 */
async function loadTemplate(bridge, templateId) {
  const template = await getTemplate(templateId);
  const results = [];

  // Create tracks
  for (const t of template.tracks) {
    try {
      let result;
      if (t.trackType === 'midi' || t.trackType === 'instrument') {
        result = await bridge.createMidiTrack({
          name: t.name,
          color: t.color,
          instrument: t.instrumentPlugin
        });
      } else if (t.folderDepth >= 1) {
        result = await bridge.createFolderTrack({ name: t.name, color: t.color });
      } else {
        result = await bridge.createTrack({ name: t.name, color: t.color });
      }
      results.push({ action: 'createTrack', name: t.name, ok: result.ok });
    } catch (e) {
      results.push({ action: 'createTrack', name: t.name, ok: false, error: e.message });
    }
  }

  // Create markers
  for (const m of (template.markers || [])) {
    try {
      await bridge.insertMarker({ name: m.name, position: m.position, bar: m.bar });
    } catch (e) { /* non-fatal */ }
  }

  // Create regions
  for (const r of (template.regions || [])) {
    try {
      await bridge.createRegion({
        name: r.name, start: r.start, end: r.end,
        startBar: r.startBar, endBar: r.endBar
      });
    } catch (e) { /* non-fatal */ }
  }

  return { template: template.name, tracksCreated: results.length, results };
}

/**
 * Delete a template.
 */
async function deleteTemplate(templateId) {
  await ensureDir();
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  await fs.unlink(filePath);
  return { deleted: templateId };
}

module.exports = {
  listTemplates,
  getTemplate,
  saveTemplate,
  loadTemplate,
  deleteTemplate
};
