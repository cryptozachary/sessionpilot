// SessionPilot for REAPER - Persistent User Profile
// Stores cross-session workflow preferences in user_profile.json at the project root.

const fs = require('fs').promises;
const path = require('path');

const PROFILE_PATH = path.join(process.cwd(), 'user_profile.json');

const DEFAULT_PROFILE = {
  preferredTrackStyle: null,  // 'dry' | 'wet'
  punchInStyle: null,         // 'region' | 'track'
  hookWorkflow: null,         // e.g. 'lead then doubles then adlibs'
  namingConventions: null,    // e.g. 'Lead Vox / Dbl L / Dbl R'
  preferredOctave: null,      // number
  genre: null,                // e.g. 'hip-hop', 'pop', 'r&b'
  notes: []                   // freeform remembered facts (max 20)
};

const KNOWN_FIELDS = new Set(Object.keys(DEFAULT_PROFILE));

async function load() {
  try {
    const raw = await fs.readFile(PROFILE_PATH, 'utf8');
    const saved = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...saved };
  } catch (_e) {
    return { ...DEFAULT_PROFILE };
  }
}

async function save(profile) {
  const tmp = PROFILE_PATH + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(profile, null, 2), 'utf8');
  await fs.rename(tmp, PROFILE_PATH);
}

async function updateField(key, value) {
  if (!KNOWN_FIELDS.has(key)) {
    throw new Error(`Unknown profile field: ${key}`);
  }
  const profile = await load();
  profile[key] = value;
  await save(profile);
  return profile;
}

async function addNote(note) {
  const profile = await load();
  if (!Array.isArray(profile.notes)) profile.notes = [];
  if (!profile.notes.includes(note)) {
    profile.notes.unshift(note);
    profile.notes = profile.notes.slice(0, 20);
  }
  await save(profile);
  return profile;
}

function summarize(profile) {
  if (!profile) return null;
  const parts = [];
  if (profile.preferredTrackStyle) parts.push(`tracks ${profile.preferredTrackStyle}`);
  if (profile.punchInStyle) parts.push(`punch-in by ${profile.punchInStyle}`);
  if (profile.hookWorkflow) parts.push(`hook: ${profile.hookWorkflow}`);
  if (profile.namingConventions) parts.push(`naming: ${profile.namingConventions}`);
  if (profile.genre) parts.push(`genre: ${profile.genre}`);
  if (profile.preferredOctave !== null && profile.preferredOctave !== undefined) {
    parts.push(`octave ${profile.preferredOctave}`);
  }
  (profile.notes || []).slice(0, 3).forEach(n => parts.push(n));
  return parts.length > 0 ? parts.join(', ') : null;
}

module.exports = { load, save, updateField, addNote, summarize };
