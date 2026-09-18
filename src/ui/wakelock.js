// Screen Wake Lock – displej nezhasne, dokud běží hra. Bez podpory tiše nic.

let wanted = false;
let sentinel = null;
let pending = null;

export function keepAwake(on) {
  wanted = Boolean(on);
  if (wanted) acquire();
  else release();
}

export function isAwake() {
  return Boolean(sentinel && !sentinel.released);
}

async function acquire() {
  if (!('wakeLock' in navigator) || isAwake() || pending || document.visibilityState !== 'visible') return;
  pending = navigator.wakeLock.request('screen');
  try {
    const lock = await pending;
    if (!wanted) {
      await lock.release(); // mezitím hra skončila
      return;
    }
    sentinel = lock;
    lock.addEventListener('release', () => {
      if (sentinel === lock) sentinel = null;
    });
  } catch {
    // Např. úspora baterie nebo chybějící oprávnění – hra jede dál.
  } finally {
    pending = null;
  }
}

function release() {
  const lock = sentinel;
  sentinel = null;
  lock?.release().catch(() => {});
}

// Prohlížeč zámek při skrytí stránky sám uvolní – po návratu ho obnovíme.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});
