// Registers jest-dom matchers (toBeInTheDocument, etc.) for all test files.
// Harmless in the Node environment used by the logic/API suites — it only
// extends `expect`, it doesn't touch the DOM at import time.
import '@testing-library/jest-dom';
