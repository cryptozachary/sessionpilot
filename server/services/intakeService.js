// SessionPilot for REAPER - Session Intake Service
// Lightweight session briefing: 2 quick questions at the start of each new session.
// Stores answers in sessionMemory so the LLM context includes project goal and genre.

const INTAKE_QUESTIONS = [
  {
    id: 'goal',
    question: 'What are we working on today? (new song, overdubs, a hook, etc.)'
  },
  {
    id: 'genre',
    question: 'What\'s the genre or vibe? (hip-hop, R&B, rock... or say "skip")'
  }
];

const SKIP_RE = /^\s*(skip|s|n\/a|pass|no|nah|idk|not sure|dunno|nothing|whatever|nm|nvm)\s*$/i;

function isSkipCommand(text) {
  return SKIP_RE.test(String(text || '').trim());
}

function getNextQuestion(answers) {
  return INTAKE_QUESTIONS.find(q => !(q.id in answers)) || null;
}

function buildFirstMessage() {
  return `Hey! Quick session brief — ${INTAKE_QUESTIONS[0].question}`;
}

/**
 * Handles one turn of the intake flow.
 *
 * @param {string} message - user's message
 * @param {Object|null} intake - current intake state from sessionMemory
 * @param {boolean} isCommandMessage - true if the message matched a non-advice intent
 * @returns {{ message: string|null, newIntakeState: Object }}
 *   message = null means bypass intake and proceed to normal processing.
 */
function handleIntakeMessage(message, intake, isCommandMessage) {
  if (!intake) {
    intake = { started: false, complete: false, answers: {}, currentQuestion: null };
  }

  // If the user typed a real command on the very first message, bypass intake
  if (!intake.started && isCommandMessage) {
    return {
      message: null,
      newIntakeState: { started: true, complete: true, answers: {}, currentQuestion: null }
    };
  }

  // First message — not a command, so start the intake flow
  if (!intake.started) {
    return {
      message: buildFirstMessage(),
      newIntakeState: {
        started: true,
        complete: false,
        answers: {},
        currentQuestion: INTAKE_QUESTIONS[0].id
      }
    };
  }

  // Intake is already in progress — record the answer to the current question
  const currentId = intake.currentQuestion;
  const answers = { ...intake.answers };

  if (currentId) {
    answers[currentId] = isSkipCommand(message) ? null : message.trim().slice(0, 150);
  }

  const nextQuestion = getNextQuestion(answers);

  if (!nextQuestion) {
    // All questions answered — wrap up intake
    const goalAck = answers.goal ? `Got it — ${answers.goal}.` : 'Got it.';
    const genreAck = answers.genre ? ` ${answers.genre} session, noted.` : '';
    return {
      message: `${goalAck}${genreAck} Let's make it happen — what do you need first?`,
      newIntakeState: { started: true, complete: true, answers, currentQuestion: null }
    };
  }

  return {
    message: nextQuestion.question,
    newIntakeState: {
      started: true,
      complete: false,
      answers,
      currentQuestion: nextQuestion.id
    }
  };
}

/**
 * Returns true when intake is done (either completed or bypassed by a command).
 */
function isComplete(intake) {
  return Boolean(intake && intake.complete);
}

module.exports = { handleIntakeMessage, isComplete };
