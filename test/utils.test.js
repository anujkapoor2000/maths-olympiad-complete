import { describe, it, expect } from 'vitest';
import { formatTime, parseOptions, gradeAnswer } from '../src/utils.js';

describe('formatTime', () => {
  it('zero-pads the seconds', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(9)).toBe('0:09');
  });

  it('formats whole minutes', () => {
    expect(formatTime(300)).toBe('5:00');
    expect(formatTime(0)).toBe('0:00');
  });
});

describe('parseOptions', () => {
  it('returns null for empty / falsy input', () => {
    expect(parseOptions(null)).toBeNull();
    expect(parseOptions(undefined)).toBeNull();
    expect(parseOptions('')).toBeNull();
  });

  it('returns null for malformed JSON (regression: MC crash)', () => {
    expect(parseOptions('not json')).toBeNull();
    expect(parseOptions('{')).toBeNull();
  });

  it('returns null for a valid-but-empty array', () => {
    expect(parseOptions('[]')).toBeNull();
  });

  it('returns the array for valid, non-empty options', () => {
    expect(parseOptions('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });
});

describe('gradeAnswer', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    expect(gradeAnswer('  Hello ', 'hello')).toBe(true);
    expect(gradeAnswer('4', '4')).toBe(true);
  });

  it('returns false for a wrong answer', () => {
    expect(gradeAnswer('5', '4')).toBe(false);
  });

  it('handles a null/undefined expected answer without throwing', () => {
    expect(gradeAnswer('anything', null)).toBe(false);
    expect(gradeAnswer('', null)).toBe(true);
  });

  it('coerces a non-string expected answer', () => {
    expect(gradeAnswer('42', 42)).toBe(true);
  });
});
