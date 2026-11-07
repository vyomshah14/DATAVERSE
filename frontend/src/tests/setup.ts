import '@testing-library/jest-dom';

// Polyfill ResizeObserver for responsive charts in JSDOM environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock;
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}
