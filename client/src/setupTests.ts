import "@testing-library/jest-dom";

// @ts-expect-error - React 18 reads this flag off globalThis at runtime; it is
// not in @types/node, and declaring it would leak a test-only global into src.
global.IS_REACT_ACT_ENVIRONMENT = true;
