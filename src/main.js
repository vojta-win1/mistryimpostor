// Bootstrap aplikace.
import { show } from './ui/router.js';
import { loadContent } from './game/content.js';
import { initLocal } from './local/local.js';

const contentPromise = loadContent();
contentPromise.catch((err) => console.error(err));

initLocal({ getContent: () => contentPromise });

const params = new URLSearchParams(location.search);
show(params.has('room') ? 'online-join' : 'home');
