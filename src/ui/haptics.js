// Vibrace přes navigator.vibrate – kde není podpora (iOS Safari), tiše nic.

export const PATTERNS = Object.freeze({
  tap: 10,
  tick: 25,
  reveal: [90, 60, 90, 60, 260],
  timeUp: [200, 100, 200, 100, 400],
});

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Některé prohlížeče vibraci bez gesta uživatele blokují.
  }
}
