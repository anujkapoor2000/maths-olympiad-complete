// Pure presentation/grading helpers, extracted from App.jsx so they can be
// unit-tested without rendering the component.

// Format a number of seconds as M:SS (e.g. 65 -> "1:05").
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Safely parse multiple-choice options stored as a JSON string. Returns a
// non-empty array or null (many bank questions are marked multipleChoice but
// have no options stored, and some store malformed JSON).
export function parseOptions(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// Compare a user's answer to the expected answer, case- and whitespace-insensitive.
// The expected answer may be null/undefined or non-string in the question bank.
export function gradeAnswer(userAnswer, expectedAnswer) {
  const expected = (expectedAnswer ?? '').toString().toLowerCase().trim();
  return (userAnswer ?? '').toString().toLowerCase().trim() === expected;
}
