const { compareAnswer } = require('./answerCheck');

const REVIEW_MODEL = process.env.ANTHROPIC_REVIEW_MODEL || 'claude-sonnet-4-20250514';

function buildReviewPrompt({ questionText, expectedAnswer, userAnswer, solution }) {
  return [
    'You are grading a child maths worksheet answer.',
    'Decide whether the student answer is mathematically equivalent to the expected answer.',
    'Accept harmless formatting differences such as:',
    '- leading or trailing spaces',
    '- trailing ! or ?',
    '- thousand separators in numbers (12,345.00 equals 12345.00)',
    '- optional trailing % on percentage answers',
    '- optional units such as miles, cm, kg, or £ when the expected answer is numeric',
    '- optional spaces around + or - in algebraic expressions',
    'Reject answers that are mathematically different, even if close.',
    'Reply with exactly one word: CORRECT or INCORRECT.',
    '',
    `Question: ${questionText || '(not provided)'}`,
    `Expected answer: ${expectedAnswer}`,
    `Student answer: ${userAnswer}`,
    solution ? `Worked solution: ${solution}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function reviewAnswerWithAI({ questionText, expectedAnswer, userAnswer, solution }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { correct: false, method: 'ai-unavailable' };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: REVIEW_MODEL,
      max_tokens: 16,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildReviewPrompt({ questionText, expectedAnswer, userAnswer, solution }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI answer review failed:', response.status, errorText);
    return { correct: false, method: 'ai-error' };
  }

  const payload = await response.json();
  const text = payload.content?.find((part) => part.type === 'text')?.text?.trim().toUpperCase() || '';
  const correct = text.includes('CORRECT') && !text.includes('INCORRECT');
  return { correct, method: 'ai' };
}

async function gradeAnswer({ userAnswer, expectedAnswer, questionText, solution, source }) {
  const deterministic = compareAnswer(userAnswer, expectedAnswer, {
    questionText,
    source,
    expectedAnswer,
  });

  if (deterministic) {
    return { correct: true, method: 'normalized' };
  }

  if (!String(userAnswer ?? '').trim()) {
    return { correct: false, method: 'empty' };
  }

  const aiResult = await reviewAnswerWithAI({
    questionText,
    expectedAnswer,
    userAnswer,
    solution,
  });

  if (aiResult.method === 'ai' && aiResult.correct) {
    return aiResult;
  }

  return { correct: false, method: deterministic ? 'normalized' : aiResult.method || 'incorrect' };
}

module.exports = {
  gradeAnswer,
  reviewAnswerWithAI,
};
