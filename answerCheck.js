/**
 * Shared answer comparison and input guidance for child free-form responses.
 * Used by the React client and Express server so grading stays consistent.
 */

const TRAILING_PUNCTUATION = /[!?.]+$/;
const MULTI_VALUE_SEPARATORS = /\s*(?:\||;|\bor\b)\s*/i;
const ALGEBRA_CHARS = /[a-z+\-*/().^=]/i;
const LEADING_CURRENCY = /^[£$€]\s*/;
const TRAILING_UNITS =
  /\s*(?:miles?|mi|kilometres?|kilometers?|km|metres?|meters?|cm|mm|millimetres?|millimeters?|millimeters|millimetres|feet|ft|inches?|in|hours?|hrs?|hr|minutes?|mins?|min|seconds?|secs?|sec|pounds?|lbs?|lb|grams?|g|kilograms?|kg|pence|pennies|coins?)\.?\s*$/i;

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripTrailingPunctuation(value) {
  return String(value ?? '').replace(TRAILING_PUNCTUATION, '').trim();
}

function basicNormalize(value) {
  return normalizeWhitespace(stripTrailingPunctuation(String(value ?? '').toLowerCase()));
}

function stripThousandsSeparators(value) {
  const trimmed = String(value ?? '').trim();
  if (!/^[-+]?\d[\d,]*(\.\d+)?%?$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/,/g, '');
}

function stripPercent(value) {
  return String(value ?? '').replace(/%+\s*$/, '').trim();
}

function normalizeAlgebra(value) {
  return basicNormalize(value)
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');
}

function parseNumeric(value) {
  const cleaned = stripPercent(stripThousandsSeparators(String(value ?? '').trim()));
  if (!/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(cleaned)) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function numbersEquivalent(left, right, tolerance = 1e-9) {
  const leftNum = parseNumeric(left);
  const rightNum = parseNumeric(right);
  if (leftNum === null || rightNum === null) {
    return false;
  }
  return Math.abs(leftNum - rightNum) <= tolerance;
}

function splitAlternates(expected) {
  return String(expected ?? '')
    .split(MULTI_VALUE_SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksNumericAnswer(value) {
  const cleaned = stripPercent(stripThousandsSeparators(String(value ?? '').trim()));
  return /^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(cleaned);
}

function looksAlgebraicAnswer(value) {
  const text = String(value ?? '');
  return /[a-z]/i.test(text) && ALGEBRA_CHARS.test(text);
}

function looksLikePercentageQuestion(context = {}) {
  const questionText = String(context.questionText ?? context.text ?? '').toLowerCase();
  const expected = String(context.expectedAnswer ?? context.answer ?? '');
  return (
    /percent|%/.test(questionText) ||
    /percent|%/.test(String(context.source ?? '')) ||
    (/%$/.test(expected.trim()) && looksNumericAnswer(stripPercent(expected)))
  );
}

function stripUnitsAndCurrency(value) {
  let next = basicNormalize(value);
  next = next.replace(LEADING_CURRENCY, '');
  while (TRAILING_UNITS.test(next)) {
    next = next.replace(TRAILING_UNITS, '').trim();
  }
  return next.trim();
}

function userAnswerVariants(userAnswer) {
  const basic = basicNormalize(userAnswer);
  const variants = new Set([
    basic,
    stripUnitsAndCurrency(basic),
    stripThousandsSeparators(stripPercent(stripUnitsAndCurrency(basic))),
    stripThousandsSeparators(stripPercent(basic)),
  ]);

  const leading = basic.match(/^[-+]?[\d,]+(?:\.\d+)?/);
  if (leading) {
    variants.add(stripThousandsSeparators(leading[0]));
  }

  const embeddedNumbers = basic.match(/[-+]?[\d,]+(?:\.\d+)?/g) || [];
  for (const number of embeddedNumbers) {
    variants.add(stripThousandsSeparators(number));
  }

  return [...variants].filter(Boolean);
}

function compareSingleNormalized(user, expected, context, rawUserAnswer, rawExpectedAnswer) {
  if (!expected) {
    return user === expected;
  }
  if (!user) {
    return false;
  }

  if (user === expected) {
    return true;
  }

  const userNoPercent = stripPercent(user);
  const expectedNoPercent = stripPercent(expected);
  if (userNoPercent === expectedNoPercent) {
    return true;
  }

  const userNumeric = stripThousandsSeparators(userNoPercent);
  const expectedNumeric = stripThousandsSeparators(expectedNoPercent);
  if (userNumeric === expectedNumeric) {
    return true;
  }

  if (numbersEquivalent(userNumeric, expectedNumeric)) {
    return true;
  }

  if (looksLikePercentageQuestion({ ...context, expectedAnswer: rawExpectedAnswer })) {
    if (numbersEquivalent(userNoPercent, expectedNoPercent)) {
      return true;
    }
    if (numbersEquivalent(`${userNoPercent}%`, expectedNoPercent)) {
      return true;
    }
  }

  if (normalizeAlgebra(rawUserAnswer) === normalizeAlgebra(rawExpectedAnswer)) {
    return true;
  }

  return false;
}

function compareSingle(userAnswer, expectedAnswer, context = {}) {
  const expected = basicNormalize(expectedAnswer);
  for (const variant of userAnswerVariants(userAnswer)) {
    if (compareSingleNormalized(variant, expected, context, userAnswer, expectedAnswer)) {
      return true;
    }
  }
  return false;
}

function compareAnswer(userAnswer, expectedAnswer, context = {}) {
  const expected = String(expectedAnswer ?? '');
  if (!expected.trim()) {
    return basicNormalize(userAnswer) === '';
  }

  const alternates = splitAlternates(expected);
  if (alternates.length > 1) {
    return alternates.some((alt) => compareSingle(userAnswer, alt, context));
  }

  return compareSingle(userAnswer, expected, context);
}

function inferAnswerFormat(question = {}) {
  const answer = String(question.answer ?? '').trim();
  const text = String(question.text ?? '').toLowerCase();
  const source = String(question.source ?? '');

  if (parseOptionsValue(question.options)) {
    return 'choice';
  }

  if (looksLikePercentageQuestion({ questionText: text, source, expectedAnswer: answer })) {
    return 'percentage';
  }

  if (looksAlgebraicAnswer(answer)) {
    return 'algebra';
  }

  if (looksNumericAnswer(answer)) {
    return 'number';
  }

  if (/:\d/.test(answer) || /\d:\d/.test(answer)) {
    return 'ratio';
  }

  if (/,\s*\S/.test(answer) && !looksNumericAnswer(answer.replace(/,/g, ''))) {
    return 'multi-part';
  }

  return 'text';
}

function parseOptionsValue(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function getAnswerInputConfig(question = {}) {
  const format = inferAnswerFormat(question);

  switch (format) {
    case 'percentage':
      return {
        format,
        placeholder: 'Enter a number (e.g. 52 or 52%)',
        hint: 'You can include % at the end or leave it out.',
        inputMode: 'decimal',
        pattern: '^[-+]?\\d*(?:[.,]\\d{0,3})*(?:\\.\\d+)?%?$',
      };
    case 'number':
      return {
        format,
        placeholder: 'Enter a number (e.g. 160 or 160 miles)',
        hint: 'Use the number only — units like miles or cm are optional.',
        inputMode: 'decimal',
        pattern: '^[-+]?\\d*(?:[,]\\d{3})*(?:\\.\\d+)?\\s*[a-zA-Z%£$€]*$',
      };
    case 'algebra':
      return {
        format,
        placeholder: 'Enter an expression (e.g. 4n + 7)',
        hint: 'Spaces around + and − are optional.',
        inputMode: 'text',
        pattern: '^[0-9a-zA-Z+\\-*/().^=\\s]+$',
      };
    case 'ratio':
      return {
        format,
        placeholder: 'Enter a ratio (e.g. 8:12:15)',
        hint: 'Use colons between numbers, with no extra spaces.',
        inputMode: 'text',
        pattern: '^\\d+(?::\\d+)+$',
      };
    case 'multi-part':
      return {
        format,
        placeholder: 'Enter your answer (use commas between parts)',
        hint: 'Match the wording in the question — extra spaces are ignored.',
        inputMode: 'text',
        pattern: null,
      };
    default:
      return {
        format: 'text',
        placeholder: 'Enter your answer...',
        hint: 'Leading/trailing spaces and ! or ? at the end are ignored.',
        inputMode: 'text',
        pattern: null,
      };
  }
}

function sanitizeAnswerInput(value, format) {
  let next = String(value ?? '');

  if (format === 'number' || format === 'percentage') {
    next = next.replace(/[^\d.,+\-%a-zA-Z£$€\s]/g, '');
    const percent = next.endsWith('%');
    next = next.replace(/%/g, '');
    const parts = next.split('.');
    if (parts.length > 2) {
      next = `${parts.shift()}.${parts.join('')}`;
    }
    if (percent) {
      next = `${next}%`;
    }
    return next.trim();
  }

  if (format === 'ratio') {
    return next.replace(/[^\d:]/g, '');
  }

  if (format === 'algebra') {
    return next.replace(/[^\d.a-zA-Z+\-*/().^=\s]/g, '');
  }

  return next.replace(/\s{2,}/g, ' ');
}

module.exports = {
  basicNormalize,
  compareAnswer,
  compareSingle,
  getAnswerInputConfig,
  inferAnswerFormat,
  looksLikePercentageQuestion,
  normalizeAlgebra,
  parseNumeric,
  sanitizeAnswerInput,
  stripThousandsSeparators,
  stripUnitsAndCurrency,
  userAnswerVariants,
};
