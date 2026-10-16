import '@testing-library/jest-dom/vitest';

// jsdom lays nothing out and has no scrollIntoView; pages call it to bring an anchor into view.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
