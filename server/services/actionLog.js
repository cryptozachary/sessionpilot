// SessionPilot for REAPER - Action Log Service
// In-memory action log that stores executed and proposed actions.

class ActionLog {
  constructor() {
    this.entries = [];
    this.maxEntries = 500;
  }

  /**
   * Log an executed action.
   */
  logExecution({ actionId, type, label, result, ok, timestamp }) {
    this.entries.push({
      kind: 'execution',
      actionId,
      type,
      label,
      result,
      ok,
      timestamp: timestamp || new Date().toISOString()
    });
    this._trim();
  }

  /**
   * Log a proposed action set.
   */
  logProposal({ actions, source, timestamp }) {
    this.entries.push({
      kind: 'proposal',
      actions,
      source,
      timestamp: timestamp || new Date().toISOString()
    });
    this._trim();
  }

  /**
   * Get recent entries, optionally filtered by kind.
   */
  getRecent(limit = 50, kind = null) {
    let filtered = this.entries;
    if (kind) {
      filtered = filtered.filter(e => e.kind === kind);
    }
    return filtered.slice(-limit).reverse();
  }

  /**
   * Clear log.
   */
  clear() {
    this.entries = [];
  }

  /**
   * Trim entries to maxEntries.
   */
  _trim() {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxEntries);
    }
  }
}

module.exports = new ActionLog();
