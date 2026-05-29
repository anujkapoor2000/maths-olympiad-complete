import { describe, it, expect } from 'vitest';
import { calculateCoins } from '../lib/scoring.js';

describe('calculateCoins', () => {
  it('awards no coins for an incorrect answer regardless of difficulty', () => {
    expect(calculateCoins(false, 'year6')).toBe(0);
    expect(calculateCoins(false, 'year7')).toBe(0);
    expect(calculateCoins(false, 'year8')).toBe(0);
    expect(calculateCoins(false, 'year9')).toBe(0);
  });

  it('awards 10 coins for year6 and year7', () => {
    expect(calculateCoins(true, 'year6')).toBe(10);
    expect(calculateCoins(true, 'year7')).toBe(10);
  });

  it('awards 15 coins for year8', () => {
    expect(calculateCoins(true, 'year8')).toBe(15);
  });

  it('awards 20 coins for year9', () => {
    expect(calculateCoins(true, 'year9')).toBe(20);
  });

  it('defaults to 20 coins for an unknown difficulty', () => {
    expect(calculateCoins(true, 'year10')).toBe(20);
    expect(calculateCoins(true, undefined)).toBe(20);
  });
});
