import { defineConfig } from 'vitest/config';

// Tests run in a Node environment: the current suite covers pure logic
// (lib/scoring.js, src/utils.js) and the Express API (via supertest with the
// pg Pool mocked). No DOM is required yet. Add `environment: 'jsdom'` here when
// React component tests are introduced.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      include: ['lib/**', 'src/utils.js', 'server.js'],
    },
  },
});
