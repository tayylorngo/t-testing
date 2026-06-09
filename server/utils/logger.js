// Gated debug logger — only emits when DEBUG=true. Use for noisy per-request /
// per-socket diagnostics; keep console.error for genuine errors.
export const debugLog = (...args) => {
  if (process.env.DEBUG === 'true') {
    console.log(...args);
  }
};
