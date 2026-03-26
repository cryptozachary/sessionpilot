window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.VoiceControl = (() => {
  const State = () => window.SessionPilot.State;
  const Chat = () => window.SessionPilot.Chat;
  const PendingActions = () => window.SessionPilot.PendingActions;
  const VoiceRouter = () => window.SessionPilot.VoiceRouter;

  const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;
  let desiredListening = false;
  let lastSpokenMessageKey = null;
  let restartTimer = null;

  function getVoiceState() {
    return State().get('voice') || {};
  }

  function setVoiceState(patch) {
    State().set('voice', {
      ...getVoiceState(),
      ...patch
    });
  }

  function speechSupported() {
    return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function render(voice) {
    const container = document.getElementById('voice-control-bar');
    if (!container) return;

    if (!voice.supported) {
      container.innerHTML = `
        <div class="voice-strip unsupported">
          <div class="voice-summary">
            <div class="voice-title">Voice Control Unavailable</div>
            <div class="voice-caption">Use a Chromium-based browser on localhost or HTTPS for hands-free control.</div>
          </div>
        </div>
      `;
      return;
    }

    const modeLabel = voice.speaking
      ? 'Speaking'
      : voice.listening
        ? 'Listening'
        : voice.enabled
          ? 'Standing by'
          : 'Off';

    const transcript = voice.transcript
      ? `Heard: ${escapeHtml(voice.transcript)}`
      : voice.error
        ? escapeHtml(voice.error)
        : voice.enabled
          ? 'Say a command naturally. “Yes” and “cancel” work for confirmations.'
          : 'Turn on voice control to listen continuously and speak replies.';

    container.innerHTML = `
      <div class="voice-strip ${voice.enabled ? 'active' : ''} ${voice.listening ? 'live' : ''}">
        <div class="voice-actions">
          <button id="voice-toggle" class="voice-toggle ${voice.enabled ? 'active' : ''}">
            ${voice.enabled ? 'Stop Voice' : 'Start Voice'}
          </button>
          <button id="voice-speech-toggle" class="voice-speech-toggle ${voice.speakReplies ? 'active' : ''}">
            ${voice.speakReplies ? 'Voice Replies On' : 'Voice Replies Off'}
          </button>
        </div>
        <div class="voice-summary">
          <div class="voice-title">
            <span class="voice-dot ${voice.listening ? 'live' : ''} ${voice.speaking ? 'speaking' : ''}"></span>
            <span>${modeLabel}</span>
          </div>
          <div class="voice-caption">${transcript}</div>
        </div>
      </div>
    `;

    const toggle = document.getElementById('voice-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (desiredListening) {
          stopListening();
        } else {
          startListening();
        }
      });
    }

    const speechToggle = document.getElementById('voice-speech-toggle');
    if (speechToggle) {
      speechToggle.addEventListener('click', () => {
        const next = !getVoiceState().speakReplies;
        setVoiceState({ speakReplies: next });
        if (!next && speechSupported()) {
          window.speechSynthesis.cancel();
          setVoiceState({ speaking: false });
          scheduleRestart();
        }
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function handlePendingVoiceCommand(transcript) {
    const pending = State().get('pendingActions');
    if (!pending || !pending.actions || pending.actions.length === 0) {
      return false;
    }

    const pendingReply = VoiceRouter().interpretPendingReply(transcript);
    if (pendingReply === 'none') return false;

    if (pendingReply === 'cancel') {
      PendingActions().cancel('Okay, cancelled.');
      return true;
    }

    if (pending.requiresConfirmation && pendingReply === 'confirm') {
      try {
        await PendingActions().execute(pending, {
          label: (pending.context && (pending.context.workflow || pending.context.actionType)) || 'Voice confirmation'
        });
      } catch (error) {
        console.error('Voice confirmation failed:', error);
        State().addChatMessage('assistant', 'I could not complete that command.');
      }
      return true;
    }

    if (!pending.requiresConfirmation && pendingReply === 'confirm') {
      try {
        await PendingActions().execute(pending, {
          label: (pending.context && (pending.context.workflow || pending.context.actionType)) || 'Voice execution'
        });
      } catch (error) {
        console.error('Voice execution failed:', error);
        State().addChatMessage('assistant', 'I could not complete that command.');
      }
      return true;
    }

    return false;
  }

  function buildSpeechText(text) {
    return (text || '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scheduleRestart() {
    if (!desiredListening || getVoiceState().speaking) return;
    if (restartTimer) {
      clearTimeout(restartTimer);
    }
    restartTimer = setTimeout(() => {
      restartTimer = null;
      beginListening();
    }, 250);
  }

  function beginListening() {
    if (!recognition || !desiredListening || getVoiceState().speaking) return;
    try {
      recognition.start();
    } catch (error) {
      if (!/already started/i.test(String(error && error.message))) {
        setVoiceState({ error: 'Could not start the microphone.' });
      }
    }
  }

  function stopRecognition() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch (error) {
      // Ignore invalid state errors when recognition is already stopped.
    }
  }

  function speak(text) {
    if (!speechSupported()) return;
    const voice = getVoiceState();
    if (!voice.enabled || !voice.speakReplies) return;

    const speechText = buildSpeechText(text);
    if (!speechText) return;

    if (desiredListening) {
      stopRecognition();
    }

    window.speechSynthesis.cancel();
    setVoiceState({ speaking: true });

    const utterance = new window.SpeechSynthesisUtterance(speechText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setVoiceState({ speaking: false });
      scheduleRestart();
    };
    utterance.onerror = () => {
      setVoiceState({ speaking: false });
      scheduleRestart();
    };
    window.speechSynthesis.speak(utterance);
  }

  async function handleTranscript(finalTranscript) {
    const transcript = (finalTranscript || '').trim();
    if (!transcript) return;

    setVoiceState({ transcript, error: '' });

    if (await handlePendingVoiceCommand(transcript)) {
      setVoiceState({ transcript: '' });
      return;
    }

    const routed = await VoiceRouter().route(transcript);
    if (routed.kind === 'ignore') {
      setVoiceState({ transcript: '' });
      return;
    }

    if (routed.kind === 'handled') {
      if (routed.reply) {
        State().addChatMessage('assistant', routed.reply);
      }
      setVoiceState({ transcript: '' });
      return;
    }

    if ((routed.kind === 'execute' || routed.kind === 'pending') && routed.pending) {
      if (routed.kind === 'execute') {
        try {
          await PendingActions().execute(routed.pending, {
            label: (routed.pending.context && (routed.pending.context.workflow || routed.pending.context.actionType)) || 'Voice command',
            successMessage: routed.successMessage
          });
        } catch (error) {
          console.error('Routed voice command failed:', error);
          State().addChatMessage('assistant', 'I could not complete that command.');
        }
      } else {
        if (routed.reply) {
          State().addChatMessage('assistant', routed.reply);
        }
        State().set('pendingActions', routed.pending);
      }

      setVoiceState({ transcript: '' });
      return;
    }

    Chat().sendMessage(transcript, {
      source: 'voice',
      autoExecuteSafeActions: true
    }).catch((error) => {
      console.error('Voice command failed:', error);
    });

    setVoiceState({ transcript: '' });
  }

  function initRecognition() {
    if (!RecognitionCtor) {
      setVoiceState({ supported: false });
      return;
    }

    recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState({
        supported: true,
        enabled: true,
        listening: true,
        error: ''
      });
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0] && event.results[i][0].transcript
          ? event.results[i][0].transcript.trim()
          : '';

        if (!chunk) continue;

        if (event.results[i].isFinal) {
          finalTranscript += `${chunk} `;
        } else {
          interimTranscript += `${chunk} `;
        }
      }

      const preview = (interimTranscript || finalTranscript).trim();
      if (preview) {
        setVoiceState({ transcript: preview, error: '' });
      }

      if (finalTranscript.trim()) {
        handleTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        desiredListening = false;
        setVoiceState({
          enabled: false,
          listening: false,
          error: 'Microphone access was denied.'
        });
        return;
      }

      if (event.error === 'no-speech') {
        setVoiceState({ error: '' });
        return;
      }

      setVoiceState({
        error: `Voice input error: ${event.error}`
      });
    };

    recognition.onend = () => {
      setVoiceState({ listening: false });
      scheduleRestart();
    };

    setVoiceState({
      supported: true,
      speakReplies: speechSupported()
    });
  }

  function startListening() {
    desiredListening = true;
    setVoiceState({
      enabled: true,
      error: '',
      transcript: ''
    });
    beginListening();
  }

  function stopListening() {
    desiredListening = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    if (speechSupported()) {
      window.speechSynthesis.cancel();
    }
    setVoiceState({
      enabled: false,
      listening: false,
      speaking: false,
      transcript: '',
      error: ''
    });
    stopRecognition();
  }

  function maybeSpeakLatestAssistantMessage(messages) {
    if (!messages || messages.length === 0) return;

    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'assistant') return;

    const key = `${latest.timestamp || ''}:${latest.content || ''}`;
    if (key === lastSpokenMessageKey) return;
    lastSpokenMessageKey = key;

    speak(latest.content);
  }

  function init() {
    initRecognition();
    State().on('voice', render);
    State().on('chatMessages', maybeSpeakLatestAssistantMessage);
    render(State().get('voice'));
  }

  return {
    init,
    startListening,
    stopListening,
    speak
  };
})();
