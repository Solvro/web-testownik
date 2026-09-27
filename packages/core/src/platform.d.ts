// Core runs in the browser and in React Native, so it is typed against plain
// ES only. Consumers must provide crypto.randomUUID (React Native needs a polyfill).
declare const crypto: {
  randomUUID: () => string;
};
