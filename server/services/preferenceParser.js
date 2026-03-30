// SessionPilot for REAPER - Preference Parser
// Extracts structured preference updates from natural language user messages.

const PREFERENCE_PATTERNS = [
  {
    pattern: /\b(?:always|prefer(?:s)?|like to|i\s+track)\s+track\s+(dry|wet)\b/i,
    field: 'preferredTrackStyle',
    extract: m => m[1].toLowerCase()
  },
  {
    pattern: /\btrack\s+(dry|wet)\b/i,
    field: 'preferredTrackStyle',
    extract: m => m[1].toLowerCase()
  },
  {
    pattern: /\bpunch[- ]in(?:s)?\s+(?:style\s+is\s+)?(?:by\s+)?(region|track)\b/i,
    field: 'punchInStyle',
    extract: m => m[1].toLowerCase()
  },
  {
    pattern: /\bpunch\s+by\s+(region|track)\b/i,
    field: 'punchInStyle',
    extract: m => m[1].toLowerCase()
  },
  {
    pattern: /\b(?:hook|chorus)\s+workflow\s+(?:is\s+)?(.{8,80})/i,
    field: 'hookWorkflow',
    extract: m => m[1].trim().replace(/[.!?]+$/, '')
  },
  {
    pattern: /\bmy\s+(?:naming|track\s+naming)\s+(?:convention|style|format)\s+(?:is\s+)?(.{4,60})/i,
    field: 'namingConventions',
    extract: m => m[1].trim().replace(/[.!?]+$/, '')
  },
  {
    pattern: /\b(?:preferred\s+)?octave\s+(\d)\b/i,
    field: 'preferredOctave',
    extract: m => parseInt(m[1], 10)
  },
  {
    pattern: /\b(?:i\s+(?:make|record|produce|do)\s+|my\s+(?:music\s+)?(?:is\s+)?|my\s+genre\s+(?:is\s+)?)(hip[- ]?hop|r&b|rnb|pop|rock|country|jazz|soul|trap|drill|afrobeats?|gospel|latin|edm|electronic|folk|indie)\b/i,
    field: 'genre',
    extract: m => m[1].toLowerCase().replace(/\s+/g, '-')
  },
  // Freeform "remember that X" → notes
  {
    pattern: /\bremember\s+that\s+(.{5,120})/i,
    field: 'notes',
    extract: m => m[1].trim().replace(/[.!?]+$/, '')
  },
  // "always X" freeform note — only if not already matched by a structured pattern
  {
    pattern: /\balways\s+((?:use|do|prefer|track|record|start|end|keep|set)\s+.{5,80})/i,
    field: 'notes',
    extract: m => m[1].trim().replace(/[.!?]+$/, '')
  }
];

/**
 * Extracts a preference update from a user message.
 * Returns { field, value, rawStatement } or null if nothing matched.
 * Structured fields take priority over freeform notes.
 */
function parsePreference(message) {
  if (!message || typeof message !== 'string') return null;

  // Try structured patterns first (stop at first match that isn't notes)
  for (const entry of PREFERENCE_PATTERNS) {
    if (entry.field === 'notes') continue;
    const match = message.match(entry.pattern);
    if (match) {
      const value = entry.extract(match);
      if (value !== null && value !== undefined) {
        return { field: entry.field, value, rawStatement: match[0] };
      }
    }
  }

  // Fall through to freeform notes
  for (const entry of PREFERENCE_PATTERNS) {
    if (entry.field !== 'notes') continue;
    const match = message.match(entry.pattern);
    if (match) {
      const value = entry.extract(match);
      if (value) {
        return { field: 'notes', value, rawStatement: match[0] };
      }
    }
  }

  return null;
}

module.exports = { parsePreference };
