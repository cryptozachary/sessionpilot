window.SessionPilot = window.SessionPilot || {};

window.SessionPilot.VoiceRouter = (() => {
  const State = () => window.SessionPilot.State;
  const API = () => window.SessionPilot.API;
  const PendingActions = () => window.SessionPilot.PendingActions;

  const FILLER_PHRASES = new Set([
    'uh',
    'um',
    'hmm',
    'mm',
    'mhm',
    'okay',
    'ok',
    'thanks',
    'thank you'
  ]);

  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isConfirmationPhrase(text) {
    return /^(yes|yeah|yep|confirm|do it|go ahead|run it|execute|okay do it|proceed|sounds good)$/.test(text);
  }

  function isCancelPhrase(text) {
    return /^(no|nope|cancel|stop|never mind|dismiss|skip it|abort|don t do that|do not do that)$/.test(text);
  }

  function interpretPendingReply(transcript) {
    const normalized = normalizeText(transcript);
    if (!normalized) return 'none';
    if (isCancelPhrase(normalized)) return 'cancel';
    if (isConfirmationPhrase(normalized)) return 'confirm';
    return 'none';
  }

  function isNoiseTranscript(transcript) {
    const normalized = normalizeText(transcript);
    if (!normalized) return true;
    if (FILLER_PHRASES.has(normalized)) return true;
    if (normalized.length <= 2) return true;
    return false;
  }

  function getTracks() {
    return State().get('tracks') || [];
  }

  function getSelectedTrack() {
    return State().get('selectedTrack');
  }

  function buildTrackAliases(track) {
    const name = normalizeText(track.name || '');
    const aliases = new Set([name]);

    if (!name) {
      return aliases;
    }

    aliases.add(name.replace(/\btrack\b/g, '').replace(/\s+/g, ' ').trim());

    if (name.includes('lead') && (name.includes('vocal') || name.includes('vox'))) {
      ['lead', 'lead vocal', 'main vocal', 'main vox', 'lead vox'].forEach((alias) => aliases.add(alias));
    }

    if (name.includes('double') || name.includes('dub')) {
      const isLeft = /\b(l|left)\b/.test(name);
      const isRight = /\b(r|right)\b/.test(name);
      if (isLeft) {
        ['double left', 'left double', 'double l', 'left dub', 'dub left'].forEach((alias) => aliases.add(alias));
      }
      if (isRight) {
        ['double right', 'right double', 'double r', 'right dub', 'dub right'].forEach((alias) => aliases.add(alias));
      }
      if (!isLeft && !isRight) {
        ['double', 'dub'].forEach((alias) => aliases.add(alias));
      }
    }

    if (name.includes('adlib') || name.includes('ad lib')) {
      ['adlib', 'adlibs', 'ad lib', 'ad libs'].forEach((alias) => aliases.add(alias));
    }

    if (name.includes('cue mix')) {
      ['cue mix', 'headphone mix', 'headphones'].forEach((alias) => aliases.add(alias));
    }

    if (name.includes('vocal bus') || name === 'vocals') {
      ['vocal bus', 'vox bus', 'vocals'].forEach((alias) => aliases.add(alias));
    }

    return new Set(Array.from(aliases).filter(Boolean));
  }

  function scoreTrackMatch(track, target) {
    const normalizedTarget = normalizeText(target)
      .replace(/\b(track|the|for|on|to|please)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedTarget) return 0;

    const aliases = buildTrackAliases(track);
    let bestScore = 0;

    aliases.forEach((alias) => {
      if (!alias) return;
      if (alias === normalizedTarget) {
        bestScore = Math.max(bestScore, 100);
      } else if (normalizedTarget.includes(alias) && alias.length > 3) {
        bestScore = Math.max(bestScore, 80 + alias.length / 100);
      } else if (alias.includes(normalizedTarget) && normalizedTarget.length > 3) {
        bestScore = Math.max(bestScore, 70 + normalizedTarget.length / 100);
      } else {
        const targetWords = normalizedTarget.split(' ');
        const aliasWords = alias.split(' ');
        const shared = targetWords.filter((word) => aliasWords.includes(word));
        if (shared.length > 0) {
          bestScore = Math.max(bestScore, shared.length * 20);
        }
      }
    });

    return bestScore;
  }

  function resolveTrackReference(targetPhrase) {
    const selectedTrack = getSelectedTrack();
    const normalizedTarget = normalizeText(targetPhrase);

    if (!normalizedTarget) return selectedTrack || null;

    if (/^(selected|current|this|that|it)( track)?$/.test(normalizedTarget)) {
      return selectedTrack || null;
    }

    const scored = getTracks()
      .map((track) => ({ track, score: scoreTrackMatch(track, normalizedTarget) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return null;
    }

    if (scored.length > 1 && scored[0].score === scored[1].score && selectedTrack) {
      const selectedMatch = scored.find((entry) => entry.track.id === selectedTrack.id);
      if (selectedMatch) return selectedMatch.track;
    }

    return scored[0].track;
  }

  function makePendingAction(actionType, args, label, requiresConfirmation = false) {
    return {
      actions: [{
        type: actionType,
        args,
        label,
        requiresConfirmation
      }],
      context: {
        actionType,
        args
      },
      requiresConfirmation
    };
  }

  async function previewWorkflow(workflow, args = {}, fallbackLabel = workflow) {
    const preview = await API().previewAction(workflow, args);
    if (!preview.ok) {
      return {
        kind: 'fallback'
      };
    }

    const proposedActions = preview.proposedActions || (preview.data && preview.data.proposedActions) || [];
    const context = preview.context || (preview.data && preview.data.context) || {};
    const requiresConfirmation = preview.requiresConfirmation != null
      ? preview.requiresConfirmation
      : (preview.data && preview.data.requiresConfirmation);
    const summary = preview.message || (preview.data && preview.data.summary) || fallbackLabel;

    return {
      kind: requiresConfirmation ? 'pending' : 'execute',
      pending: {
        actions: proposedActions,
        context: {
          ...context,
          workflow,
          args
        },
        requiresConfirmation: !!requiresConfirmation
      },
      reply: summary
    };
  }

  function extractMarkerName(text) {
    const quoted = text.match(/(?:marker|bookmark|note)(?: called| named)?\s+["'](.+?)["']/i);
    if (quoted) return quoted[1];

    const raw = text.match(/(?:drop|add|insert|place)(?: a)? (?:marker|bookmark)(?: called| named)?\s+(.+)$/i);
    if (raw) return raw[1].trim();

    return 'Marker';
  }

  function extractTrackNameForCreate(text) {
    const quoted = text.match(/(?:create|add|new)(?: a)? track(?: called| named)?\s+["'](.+?)["']/i);
    if (quoted) return quoted[1];

    const raw = text.match(/(?:create|add|new)(?: a)? track(?: called| named)?\s+(.+)$/i);
    if (raw) return raw[1].trim();

    return 'New Track';
  }

  function extractRename(text) {
    const quoted = text.match(/rename(?: the)? (.+?) to ["'](.+?)["']/i);
    if (quoted) return { target: quoted[1], name: quoted[2] };

    const raw = text.match(/rename(?: the)? (.+?) to (.+)$/i);
    if (raw) return { target: raw[1].trim(), name: raw[2].trim() };

    return null;
  }

  function extractBarRange(text) {
    const range = text.match(/bars?\s*(\d+)\s*(?:to|-|through)\s*(\d+)/i);
    if (range) {
      return {
        startBar: parseInt(range[1], 10),
        endBar: parseInt(range[2], 10)
      };
    }

    return null;
  }

  async function routeTrackControl(text, actionConfig) {
    const target = actionConfig.targetExtractor
      ? actionConfig.targetExtractor(text)
      : text.replace(actionConfig.pattern, '').trim();
    const resolvedTrack = resolveTrackReference(target);

    if (!resolvedTrack) {
      return {
        kind: 'handled',
        reply: 'Tell me which track you want, or select a track first.'
      };
    }

    const args = actionConfig.argsBuilder
      ? actionConfig.argsBuilder(resolvedTrack, text)
      : { trackId: resolvedTrack.id };

    return {
      kind: 'execute',
      pending: makePendingAction(
        actionConfig.actionType,
        args,
        actionConfig.labelBuilder ? actionConfig.labelBuilder(resolvedTrack, text) : `${actionConfig.actionType} ${resolvedTrack.name}`,
        false
      ),
      successMessage: actionConfig.successBuilder
        ? actionConfig.successBuilder(resolvedTrack, text)
        : `${actionConfig.actionType} complete for "${resolvedTrack.name}".`
    };
  }

  async function route(transcript) {
    if (isNoiseTranscript(transcript)) {
      return { kind: 'ignore' };
    }

    const text = normalizeText(transcript);

    if (/^(select|focus|highlight)\b/.test(text)) {
      const target = text.replace(/^(select|focus|highlight)\b/, '').replace(/\btrack\b/g, '').trim();
      const resolvedTrack = resolveTrackReference(target);
      if (!resolvedTrack) {
        return {
          kind: 'handled',
          reply: 'I could not tell which track you meant.'
        };
      }

      return {
        kind: 'execute',
        pending: makePendingAction('selectTrack', { trackId: resolvedTrack.id }, `Select "${resolvedTrack.name}"`),
        successMessage: `Selected "${resolvedTrack.name}".`
      };
    }

    if (/\b(disarm|unarm)\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\b(disarm|unarm)\b/,
        actionType: 'disarmTrack',
        labelBuilder: (track) => `Disarm "${track.name}"`,
        successBuilder: (track) => `Disarmed "${track.name}".`
      });
    }

    if (/\barm\b/.test(text) && !/\bdisarm\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\barm\b/,
        actionType: 'armTrack',
        labelBuilder: (track) => `Arm "${track.name}"`,
        successBuilder: (track) => `Armed "${track.name}".`
      });
    }

    if (/\b(unmute)\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\bunmute\b/,
        actionType: 'muteTrack',
        argsBuilder: (track) => ({ trackId: track.id, enabled: false }),
        labelBuilder: (track) => `Unmute "${track.name}"`,
        successBuilder: (track) => `Unmuted "${track.name}".`
      });
    }

    if (/\bmute\b/.test(text) && !/\bunmute\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\bmute\b/,
        actionType: 'muteTrack',
        argsBuilder: (track) => ({ trackId: track.id, enabled: true }),
        labelBuilder: (track) => `Mute "${track.name}"`,
        successBuilder: (track) => `Muted "${track.name}".`
      });
    }

    if (/\bunsolo\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\bunsolo\b/,
        actionType: 'soloTrack',
        argsBuilder: (track) => ({ trackId: track.id, enabled: false }),
        labelBuilder: (track) => `Unsolo "${track.name}"`,
        successBuilder: (track) => `Unsoloed "${track.name}".`
      });
    }

    if (/\bsolo\b/.test(text) && !/\bunsolo\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /\bsolo\b/,
        actionType: 'soloTrack',
        argsBuilder: (track) => ({ trackId: track.id, enabled: true }),
        labelBuilder: (track) => `Solo "${track.name}"`,
        successBuilder: (track) => `Soloed "${track.name}".`
      });
    }

    if (/\bmonitor(?:ing)?\b/.test(text)) {
      const enable = /\b(on|enable|start)\b/.test(text) || !/\b(off|disable|stop)\b/.test(text);
      return routeTrackControl(text, {
        pattern: /\b(?:turn|set)?\s*monitor(?:ing)?(?:\s*(on|off))?\b/,
        actionType: 'toggleMonitoring',
        argsBuilder: (track) => ({ trackId: track.id, enabled: enable }),
        labelBuilder: (track) => `${enable ? 'Enable' : 'Disable'} monitoring on "${track.name}"`,
        successBuilder: (track) => `${enable ? 'Enabled' : 'Disabled'} monitoring on "${track.name}".`
      });
    }

    if (/^(duplicate|copy)\b/.test(text)) {
      return routeTrackControl(text, {
        pattern: /^(duplicate|copy)\b/,
        actionType: 'duplicateTrack',
        labelBuilder: (track) => `Duplicate "${track.name}"`,
        successBuilder: (track) => `Duplicated "${track.name}".`
      });
    }

    if (/^(rename)\b/.test(text)) {
      const rename = extractRename(transcript);
      if (!rename || !rename.name) {
        return {
          kind: 'handled',
          reply: 'Say it like “rename lead vocal to main vocal.”'
        };
      }

      const resolvedTrack = resolveTrackReference(rename.target);
      if (!resolvedTrack) {
        return {
          kind: 'handled',
          reply: 'I could not tell which track to rename.'
        };
      }

      return {
        kind: 'execute',
        pending: makePendingAction('renameTrack', {
          trackId: resolvedTrack.id,
          name: rename.name
        }, `Rename "${resolvedTrack.name}" to "${rename.name}"`),
        successMessage: `Renamed "${resolvedTrack.name}" to "${rename.name}".`
      };
    }

    // --- Transport voice commands ---
    if (/\b(hit play|play it|play back|playback|start play|press play)\b/.test(text)) {
      return {
        kind: 'execute',
        pending: makePendingAction('play', {}, 'Start playback'),
        successMessage: 'Playback started.'
      };
    }

    if (/\b(hit stop|stop play|stop it|stop record|press stop)\b/.test(text) || /^stop$/.test(text)) {
      return {
        kind: 'execute',
        pending: makePendingAction('stop', {}, 'Stop transport'),
        successMessage: 'Transport stopped.'
      };
    }

    if (/\b(hit pause|pause it|press pause)\b/.test(text) || /^pause$/.test(text)) {
      return {
        kind: 'execute',
        pending: makePendingAction('pause', {}, 'Pause transport'),
        successMessage: 'Transport paused.'
      };
    }

    if (/\b(hit record|start record|press record|roll tape|record now|let'?s? record)\b/.test(text)) {
      return {
        kind: 'execute',
        pending: makePendingAction('record', {}, 'Start recording'),
        successMessage: 'Recording started.'
      };
    }

    if (/\b(go to start|from the top|top of|rewind to start)\b/.test(text)) {
      return {
        kind: 'execute',
        pending: makePendingAction('goToStart', {}, 'Go to project start'),
        successMessage: 'Cursor at the top.'
      };
    }

    if (/\bgo to bar (\d+)\b/.test(text) || /\bjump to bar (\d+)\b/.test(text)) {
      const barMatch = text.match(/(?:go|jump) to bar (\d+)/);
      const bar = barMatch ? parseInt(barMatch[1], 10) : 1;
      return {
        kind: 'execute',
        pending: makePendingAction('goToPosition', { bar }, `Go to bar ${bar}`),
        successMessage: `Cursor moved to bar ${bar}.`
      };
    }

    if (/\b(marker|bookmark)\b/.test(text)) {
      const markerName = extractMarkerName(transcript);
      return {
        kind: 'execute',
        pending: makePendingAction('insertMarker', { name: markerName }, `Insert marker "${markerName}"`),
        successMessage: `Inserted marker "${markerName}".`
      };
    }

    if (/^(create|add|new)\b/.test(text) && /\btrack\b/.test(text)) {
      const trackName = extractTrackNameForCreate(transcript);
      return {
        kind: 'execute',
        pending: makePendingAction('createTrack', { name: trackName }, `Create track "${trackName}"`),
        successMessage: `Created track "${trackName}".`
      };
    }

    if (/\b(color code|color|colour)\b/.test(text) && /\bvocal/.test(text)) {
      return previewWorkflow('colorCodeVocals', {}, 'Color-coding vocal tracks.');
    }

    if (/\b(organize|clean up|sort)\b/.test(text) && /\b(session|tracks?)\b/.test(text)) {
      return previewWorkflow('organizeSessionTracks', {}, 'Previewing track organization.');
    }

    if (/\b(preflight|ready to record|session check)\b/.test(text)) {
      return previewWorkflow('preflightCheck', {}, 'Running a pre-flight check.');
    }

    if (/\b(cue mix|headphone mix|headphones)\b/.test(text)) {
      return previewWorkflow('setupHeadphoneMix', {}, 'Previewing a headphone cue mix.');
    }

    if (/\brough mix\b|\bquick mix\b/.test(text)) {
      return previewWorkflow('roughMix', {}, 'Previewing a rough mix.');
    }

    if (/\b(vocal stack|double|adlib)\b/.test(text) && /\b(set up|setup|make|create)\b/.test(text)) {
      return previewWorkflow('setupLeadDoubleAdlib', {}, 'Previewing a full vocal stack.');
    }

    if (/\b(lead vocal|record vocals|vocal setup)\b/.test(text) && /\b(set up|setup|create|new)\b/.test(text)) {
      return previewWorkflow('setupLeadVocal', {}, 'Setting up a lead vocal track.');
    }

    if (/\b(comp|takes?)\b/.test(text) && /\b(review|pick|choose|comp)\b/.test(text)) {
      return previewWorkflow('compTakes', {}, 'Reviewing takes for comping.');
    }

    if (/\b(song map|mark song|song structure|verse|chorus|bridge)\b/.test(text) && /\bmark|map\b/.test(text)) {
      return {
        kind: 'fallback'
      };
    }

    if (/\b(punch loop|loop punch|loop record)\b/.test(text)) {
      const range = extractBarRange(text);
      if (!range) {
        return {
          kind: 'handled',
          reply: 'Tell me the bar range, like “punch loop bars 9 to 17.”'
        };
      }
      return previewWorkflow('quickPunchLoop', range, `Setting a punch loop from bar ${range.startBar} to ${range.endBar}.`);
    }

    if (/\bpunch in\b|\bdrop in\b/.test(text)) {
      const range = extractBarRange(text);
      if (!range) {
        return {
          kind: 'handled',
          reply: 'Tell me the bar range for the punch-in.'
        };
      }
      return previewWorkflow('preparePunchIn', range, `Preparing a punch-in from bar ${range.startBar} to ${range.endBar}.`);
    }

    return {
      kind: 'fallback'
    };
  }

  return {
    normalizeText,
    interpretPendingReply,
    isNoiseTranscript,
    resolveTrackReference,
    route
  };
})();
