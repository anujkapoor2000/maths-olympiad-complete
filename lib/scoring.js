// Pure scoring logic, extracted from the /api/progress/update handler so it can be
// unit-tested in isolation (no Express / DB needed).

// Coins awarded for a single answered question. A wrong answer earns nothing.
// Year 6 and Year 7 are worth 10, Year 8 is worth 15, and anything harder
// (Year 9 and any unknown level) is worth 20 — matching the original inline rule.
function calculateCoins(correct, difficulty) {
  if (!correct) return 0;
  switch (difficulty) {
    case 'year6':
    case 'year7':
      return 10;
    case 'year8':
      return 15;
    default:
      return 20;
  }
}

module.exports = { calculateCoins };
