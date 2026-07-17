const { compareAnswer } = require('../answerCheck');

const cases = [
  ['52', '52', { questionText: 'What percentage?' }, true],
  ['52%', '52', { questionText: 'What percentage?' }, true],
  [' 52% ', '52', { questionText: 'What percentage?' }, true],
  ['52!', '52', {}, true],
  ['52?', '52', {}, true],
  ['12,345.00', '12345', {}, true],
  ['1,234.00', '1234.00', {}, true],
  ['25%', '25%', {}, true],
  ['25', '25%', { questionText: 'What percentage?' }, true],
  ['4n + 7', '4n+7', {}, true],
  ['4n+7', '4n + 7', {}, true],
  ['53', '52', {}, false],
  ['52 cm', '52', {}, false],
];

let failed = 0;
for (const [user, expected, context, want] of cases) {
  const got = compareAnswer(user, expected, context);
  if (got !== want) {
    failed += 1;
    console.error(`FAIL: compareAnswer(${JSON.stringify(user)}, ${JSON.stringify(expected)}) => ${got}, want ${want}`);
  }
}

if (failed === 0) {
  console.log(`All ${cases.length} answerCheck tests passed.`);
  process.exit(0);
}

console.error(`${failed} test(s) failed.`);
process.exit(1);
