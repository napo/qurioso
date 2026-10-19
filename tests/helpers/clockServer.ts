// Test-only bootstrap: advance wall-clock credential expiry without waiting a day.
// Question deadlines still use the unchanged monotonic server clock.
const now = Date.now;
let offset = 0;
Date.now = () => now() + offset;
process.on('message', (message: { advanceMs?: number }) => {
  if (typeof message?.advanceMs === 'number') { offset += message.advanceMs; process.send?.({ advanced: true }); }
});
await import('../../server');
