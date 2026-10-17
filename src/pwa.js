// Registrace service workeru + nabídka obnovení, když je připravená nová verze.
import { el } from './ui/dom.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Na první návštěvě převezme řízení nový worker – to není důvod k reloadu.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      // Relativní cesta, aby scope seděl i na podcestě (GitHub Pages).
      const reg = await navigator.serviceWorker.register('sw.js');
      if (reg.waiting && hadController) return showUpdateToast(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(installing);
          }
        });
      });
    } catch (err) {
      console.error('Service worker se nepodařilo zaregistrovat:', err);
    }
  });
}

function showUpdateToast(worker) {
  if (document.querySelector('.toast')) return;
  const toast = el('div', { class: 'toast', role: 'status' },
    el('span', {}, 'Nová verze je připravená.'),
    el('button', {
      class: 'toast-btn',
      type: 'button',
      onclick: () => {
        toast.remove();
        worker.postMessage('skip-waiting'); // po převzetí řízení se stránka sama obnoví
      },
    }, 'Obnovit'),
  );
  document.body.append(toast);
}
