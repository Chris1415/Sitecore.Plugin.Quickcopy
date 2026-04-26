import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

// T035 — extend Vitest's `expect` with `toHaveNoViolations` so a11y smoke
// tests can assert `axe(container)` results directly. See
// `__tests__/a11y.test.tsx`.
expect.extend(toHaveNoViolations);
