// Bootstrap aplikace.
import { show } from './ui/router.js';
import { loadContent } from './game/content.js';
import { initLocal, restoreLocal } from './local/local.js';
import { sound, isMuted, setMuted, onMutedChange } from './ui/sound.js';

const contentPromise = loadContent();
contentPromise.catch((err) => console.error(err));

// ---------- zvuk ----------

const muteBtn = document.getElementById('mute');
const renderMute = (muted) => {
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Zapnout zvuky' : 'Ztlumit zvuky');
};
renderMute(isMuted());
onMutedChange(renderMute);
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  sound.tap();
});

// Klik na běžné ovládací prvky (karta s rolí má vlastní zvuky).
document.addEventListener('click', (e) => {
  if (e.target.closest('#mute')) return;
  if (e.target.closest('.btn, .btn-back, .btn-link, .chip, .segmented button, .mode-tile, .toggle input')) sound.tap();
});

// ---------- start ----------

initLocal({ getContent: () => contentPromise });

const params = new URLSearchParams(location.search);
if (params.has('room')) {
  restoreLocal({ navigate: false });
  show('online-join');
} else if (!restoreLocal()) {
  show('home');
}
