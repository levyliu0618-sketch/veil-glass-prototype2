// The two windows talk over a BroadcastChannel on the same machine (no server).
// Console → participant: { kind: 'state', ... }   (only content the current view allows)
// Participant → console: { kind: 'hello' } | { kind: 'request', text } | { kind: 'accept' } | { kind: 'seen', ... }

export const CHANNEL = 'agent-veil-session';

export function open(onMessage) {
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = e => onMessage(e.data);
  return msg => ch.postMessage(msg);
}

export const fmtClock = s => {
  const v = Math.max(0, Math.round(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};
