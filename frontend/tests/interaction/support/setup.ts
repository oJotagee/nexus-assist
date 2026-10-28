import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { afterEach, expect } = await import('bun:test');
const matchers = await import('@testing-library/jest-dom/matchers');
const { cleanup } = await import('@testing-library/react');

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);

afterEach(() => {
  cleanup();
});
