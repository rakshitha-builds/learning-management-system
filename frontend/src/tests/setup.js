import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine: stub what Recharts / hls.js expect.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.HTMLMediaElement.prototype.load = () => {};
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
