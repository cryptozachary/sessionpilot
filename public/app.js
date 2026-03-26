/**
 * SessionPilot for REAPER — Main Application Entry Point
 *
 * Initializes all components and establishes server connection.
 */
document.addEventListener('DOMContentLoaded', () => {
  const {
    State,
    API,
    WS,
    ConnectionStatus,
    Sidebar,
    TrackPanel,
    Chat,
    QuickActions,
    ActionCards,
    ConfirmModal,
    ActionLog,
    VoiceControl
  } = window.SessionPilot;

  // Initialize all UI components
  ConnectionStatus.init();
  Sidebar.init();
  TrackPanel.init();
  Chat.init();
  QuickActions.init();
  ActionCards.init();
  ConfirmModal.init();
  ActionLog.init();
  VoiceControl.init();

  // Connect WebSocket for real-time updates
  WS.connect();

  // Fetch initial data from REST API
  (async () => {
    try {
      const [workflows, log] = await Promise.all([
        API.getWorkflows().catch(() => ({ data: [] })),
        API.getActionLog().catch(() => ({ data: [] }))
      ]);

      if (workflows.data) State.set('workflows', workflows.data);
      if (log.data) State.set('actionLog', log.data);
    } catch (e) {
      console.error('Initial data fetch failed:', e);
    }
  })();

  console.log('SessionPilot initialized');
});
