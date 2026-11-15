// Stand-in for the onboard hub: BroadcastChannel lets two tabs of the app on the
// same machine message each other with no network at all. Open the app in two
// tabs (Chris's tablet + the crew medical officer) to demo crew sync.
const NAME = 'astropulse-crew';

export function sendCrewMessage(msg) {
  try {
    const ch = new BroadcastChannel(NAME);
    ch.postMessage({ ...msg, at: Date.now() });
    ch.close();
  } catch { /* BroadcastChannel not available: nothing to sync */ }
}

export function onCrewMessage(handler) {
  let ch;
  try {
    ch = new BroadcastChannel(NAME);
    ch.onmessage = (e) => handler(e.data);
  } catch { return () => {}; }
  return () => ch.close();
}
