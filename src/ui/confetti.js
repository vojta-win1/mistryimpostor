// Konfety na <canvas> – vlastní malý částicový systém bez knihoven.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Vystřelí konfety přes celou obrazovku a po doběhnutí canvas odstraní.
 * @param {object} [opts]
 * @param {string[]} [opts.colors]  CSS barvy; výchozí se berou z tokenů
 * @param {number} [opts.count]
 * @param {number} [opts.duration]  ms
 */
export function confetti({ colors, count = 160, duration = 3800 } = {}) {
  if (reducedMotion.matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const palette = colors ?? tokenColors();
  const rand = (min, max) => min + Math.random() * (max - min); // jen vizuál, ne herní los

  // Dvě „děla" ze spodních rohů + sprška shora.
  const particles = Array.from({ length: count }, (_, i) => {
    const source = i % 3;
    const fromLeft = source === 0;
    const fromTop = source === 2;
    const angle = fromTop ? rand(0, Math.PI) : (fromLeft ? rand(-1.35, -0.9) : rand(-2.25, -1.8));
    const speed = fromTop ? rand(1, 3) : rand(11, 17);
    return {
      x: fromTop ? rand(0, w) : (fromLeft ? -10 : w + 10),
      y: fromTop ? rand(-h * 0.3, -10) : h * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(6, 11),
      ratio: rand(0.35, 0.7),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.25, 0.25),
      wobble: rand(0, Math.PI * 2),
      color: palette[i % palette.length],
      round: i % 5 === 0,
    };
  });

  const start = performance.now();
  let last = start;

  function frame(now) {
    const t = now - start;
    const step = Math.min(2, (now - last) / 16.67); // normalizace na 60 fps
    last = now;
    ctx.clearRect(0, 0, w, h);
    const fade = t > duration - 800 ? Math.max(0, (duration - t) / 800) : 1;
    ctx.globalAlpha = fade;

    for (const p of particles) {
      p.vx *= 0.985 ** step;
      p.vy = p.vy * 0.985 ** step + 0.28 * step;
      p.wobble += 0.1 * step;
      p.x += (p.vx + Math.sin(p.wobble) * 0.6) * step;
      p.y += p.vy * step;
      p.rot += p.vr * step;
      if (p.y > h + 20) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Zploštění podle kosinu simuluje otáčení papírku v prostoru.
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillRect(-p.size / 2, -p.size * p.ratio / 2, p.size, p.size * p.ratio);
      }
      ctx.restore();
    }

    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function tokenColors() {
  const css = getComputedStyle(document.body);
  return ['--impostor', '--impostor-glow', '--accent', '--accent-glow', '--words', '--questions']
    .map((name) => css.getPropertyValue(name).trim())
    .filter(Boolean);
}
