import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests default to a Node environment (pure logic in lib/scoring.js & src/utils.js,
// and the Express API via supertest with a fake pg pool). React component tests
// opt into jsdom per-file with a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      include: ['lib/**', 'src/utils.js', 'server.js'],
    },
  },
});
