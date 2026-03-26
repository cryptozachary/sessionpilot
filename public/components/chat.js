window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.Chat = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;
  const PendingActions = () => window.SessionPilot.PendingActions;

  let isTyping = false;
  let pendingRequestCount = 0;
  let sendQueue = Promise.resolve();

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

  function setTypingState(active) {
    isTyping = active;
    renderMessages(State().get('chatMessages'));
  }

  function derivePendingContext(response, proposedActions) {
    const context = response.context || (response.data && response.data.context) || {};
    if (context.workflow || context.actionType) {
      return context;
    }

    if (proposedActions.length === 1 && proposedActions[0].type) {
      return {
        actionType: proposedActions[0].type,
        args: proposedActions[0].args || window.SessionPilot.PendingActions.extractActionArgs(proposedActions[0])
      };
    }

    return context;
  }

  async function sendMessage(message, options = {}) {
    const trimmed = (message || '').trim();
    if (!trimmed) return null;

    if (options.echoUser !== false) {
      State().addChatMessage('user', trimmed, {
        source: options.source || 'text'
      });
    }

    pendingRequestCount += 1;
    setTypingState(true);

    try {
      const response = await API().sendChat(trimmed, {
        source: options.source || 'text'
      });

      if (response.ok !== false) {
        const assistantMsg = response.message || (response.data && response.data.message) || 'Done.';
        const proposedActions = response.proposedActions || (response.data && response.data.proposedActions) || [];

        State().addChatMessage('assistant', assistantMsg, {
          actions: proposedActions
        });

        if (proposedActions.length > 0) {
          const requiresConfirmation = response.requiresConfirmation != null
            ? response.requiresConfirmation
            : (response.data && response.data.requiresConfirmation);
          const pending = {
            actions: proposedActions,
            context: derivePendingContext(response, proposedActions),
            requiresConfirmation
          };

          if (options.autoExecuteSafeActions && !requiresConfirmation) {
            await PendingActions().execute(pending, {
              label: (pending.context && (pending.context.workflow || pending.context.actionType)) || 'Voice command'
            });
          } else {
            State().set('pendingActions', pending);
          }
        }
      } else {
        State().addChatMessage('assistant', 'Sorry, something went wrong. Try again?');
      }

      return response;
    } catch (e) {
      console.error('Chat send error:', e);
      State().addChatMessage('assistant', 'Connection issue. Is the server running?');
      throw e;
    } finally {
      pendingRequestCount = Math.max(0, pendingRequestCount - 1);
      setTypingState(pendingRequestCount > 0);
    }
  }

  function queueMessage(message, options = {}) {
    sendQueue = sendQueue
      .catch(() => null)
      .then(() => sendMessage(message, options));
    return sendQueue;
  }

  function handleSend() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.focus();
    queueMessage(message, { source: 'text' }).catch(() => null);
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

  return { init, sendMessage: queueMessage };
})();
