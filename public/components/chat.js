window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.Chat = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;

  let isTyping = false;

  function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    let html = (messages || []).map(renderMessage).join('');

    if (isTyping) {
      html += `
        <div class="message assistant typing">
          <div class="message-content">
            <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function renderMessage(msg) {
    const cls = msg.role === 'user' ? 'user' : 'assistant';
    const content = formatText(msg.content || '');
    return `<div class="message ${cls}"><div class="message-content">${content}</div></div>`;
  }

  /**
   * Simple markdown-like formatting:
   *  - **bold**
   *  - `inline code`
   *  - newlines -> <br>
   *  - escape HTML first for safety
   */
  function formatText(text) {
    // Escape HTML
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold: **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Inline code: `text`
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Newlines
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  async function handleSend() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.focus();

    State().addChatMessage('user', message);

    isTyping = true;
    renderMessages(State().get('chatMessages'));

    try {
      const response = await API().sendChat(message);
      isTyping = false;

      if (response.ok !== false) {
        const assistantMsg = response.message || (response.data && response.data.message) || 'Done.';
        const proposedActions = response.proposedActions || (response.data && response.data.proposedActions) || [];

        State().addChatMessage('assistant', assistantMsg, {
          actions: proposedActions
        });

        // If there are proposed actions, show action cards
        if (proposedActions.length > 0) {
          const context = response.context || (response.data && response.data.context) || {};
          const requiresConfirmation = response.requiresConfirmation != null
            ? response.requiresConfirmation
            : (response.data && response.data.requiresConfirmation);

          State().set('pendingActions', {
            actions: proposedActions,
            context: context,
            requiresConfirmation: requiresConfirmation
          });
        }
      } else {
        State().addChatMessage('assistant', 'Sorry, something went wrong. Try again?');
      }
    } catch (e) {
      isTyping = false;
      console.error('Chat send error:', e);
      State().addChatMessage('assistant', 'Connection issue. Is the server running?');
    }

    renderMessages(State().get('chatMessages'));
  }

  function init() {
    State().on('chatMessages', renderMessages);

    const sendBtn = document.getElementById('chat-send');
    const chatInput = document.getElementById('chat-input');

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Welcome message
    State().addChatMessage(
      'assistant',
      "Hey! I'm your session engineer. I can set up vocal tracks, prepare punch-ins, troubleshoot monitoring issues, and help organize your session.\n\nWhat are we working on?"
    );
  }

  return { init };
})();
