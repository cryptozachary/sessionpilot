const workflows = {
  setupLeadVocal: require('./setupLeadVocal'),
  setupLeadDoubleAdlib: require('./setupLeadDoubleAdlib'),
  preparePunchIn: require('./preparePunchIn'),
  organizeSessionTracks: require('./organizeSessionTracks'),
  colorCodeVocals: require('./colorCodeVocals'),
  diagnoseMonitoringIssue: require('./diagnoseMonitoringIssue'),
  diagnoseLowInputIssue: require('./diagnoseLowInputIssue')
};

module.exports = {
  workflows,
  getWorkflow(name) { return workflows[name] || null; },
  listWorkflows() { return Object.keys(workflows).map(k => ({ name: k, description: workflows[k].description })); }
};
