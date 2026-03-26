const workflows = {
  setupLeadVocal: require('./setupLeadVocal'),
  setupLeadDoubleAdlib: require('./setupLeadDoubleAdlib'),
  preparePunchIn: require('./preparePunchIn'),
  organizeSessionTracks: require('./organizeSessionTracks'),
  colorCodeVocals: require('./colorCodeVocals'),
  diagnoseMonitoringIssue: require('./diagnoseMonitoringIssue'),
  diagnoseLowInputIssue: require('./diagnoseLowInputIssue'),
  setupHeadphoneMix: require('./setupHeadphoneMix'),
  compTakes: require('./compTakes'),
  roughMix: require('./roughMix'),
  markSongStructure: require('./markSongStructure'),
  sessionNotes: require('./sessionNotes'),
  preflightCheck: require('./preflightCheck'),
  quickPunchLoop: require('./quickPunchLoop'),
  manageFxChain: require('./manageFxChain'),
  batchRecording: require('./batchRecording'),
  exportBounce: require('./exportBounce')
};

module.exports = {
  workflows,
  getWorkflow(name) { return workflows[name] || null; },
  listWorkflows() { return Object.keys(workflows).map(k => ({ name: k, description: workflows[k].description })); }
};
