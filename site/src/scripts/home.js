/**
 * Homepage-only behavior. This entry is loaded by pages/index.astro and
 * releases observers/listeners before an Astro ClientRouter swap.
 */
let disposePage = () => {};

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const setupPage = () => {
  disposePage();
  if (!document.querySelector('[data-page="home"]')) return;

  const controller = new AbortController();
  const { signal } = controller;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observers = [];
  let constellationFrame = null;

  const trigger = document.querySelector('.about-trigger');
  const content = document.querySelector('.about-content');
  if (trigger instanceof HTMLButtonElement && content instanceof HTMLElement) {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      trigger.querySelector('em')?.replaceChildren(document.createTextNode(expanded ? 'EXPAND +' : 'CLOSE −'));
      content.hidden = expanded;
      trigger.closest('.about')?.classList.toggle('is-expanded', !expanded);
      if (!expanded) content.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }, { signal });
  }

  const portrait = document.querySelector('.about-portrait');
  if (portrait instanceof HTMLElement) {
    const moveSpotlight = (event) => {
      if (event.pointerType === 'touch') return;
      const bounds = portrait.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      portrait.style.setProperty('--spotlight-x', `${((event.clientX - bounds.left) / bounds.width * 100).toFixed(2)}%`);
      portrait.style.setProperty('--spotlight-y', `${((event.clientY - bounds.top) / bounds.height * 100).toFixed(2)}%`);
    };
    portrait.addEventListener('pointerenter', moveSpotlight, { signal });
    portrait.addEventListener('pointermove', moveSpotlight, { signal });
  }

  const words = document.querySelectorAll('.constellation-word');
  words.forEach((word) => {
    if (word.children.length) return;
    const label = word.textContent.trim();
    word.setAttribute('aria-label', label);
    word.textContent = '';
    [...label].forEach((character, index) => {
      const letter = document.createElement('span');
      letter.setAttribute('aria-hidden', 'true');
      letter.style.setProperty('--letter-index', index);
      letter.textContent = character;
      word.append(letter);
    });
  });

  const observeMotion = (target, className, options = {}) => {
    if (!(target instanceof HTMLElement) || reduceMotion.matches || typeof IntersectionObserver === 'undefined') return;
    const { delay = 0, threshold = 0.35, rootMargin = '0px' } = options;
    let timer = null;
    const observer = new IntersectionObserver(([entry]) => {
      const inFocus = entry.isIntersecting && entry.intersectionRatio >= threshold;
      if (inFocus) {
        if (timer === null && !target.classList.contains(className)) {
          timer = window.setTimeout(() => {
            target.classList.add(className);
            timer = null;
          }, delay);
        }
      } else {
        window.clearTimeout(timer);
        timer = null;
        target.classList.remove(className);
      }
    }, { threshold: threshold ? [0, threshold] : [0], rootMargin });
    observer.observe(target);
    observers.push(() => {
      observer.disconnect();
      window.clearTimeout(timer);
    });
  };

  observeMotion(document.querySelector('.practice'), 'is-practice-active', {
    delay: 3000,
    threshold: 0,
    rootMargin: '-28% 0px -28% 0px',
  });
  observeMotion(document.querySelector('.lab'), 'is-lab-active', { threshold: 0.28 });

  document.querySelectorAll('.chaos-piece').forEach((item) => {
    ['enter', 'exit'].forEach((edge) => {
      item.style.setProperty(`--chaos-${edge}-x`, `${randomBetween(-2.25, 2.25).toFixed(2)}rem`);
      item.style.setProperty(`--chaos-${edge}-y`, `${randomBetween(-1.5, 1.5).toFixed(2)}rem`);
      item.style.setProperty(`--chaos-${edge}-r`, `${randomBetween(-4, 4).toFixed(2)}deg`);
    });
  });

  const constellation = document.querySelector('.about-constellation');
  if (constellation instanceof HTMLCanvasElement) {
    const context = constellation.getContext('2d');
    if (context && typeof ResizeObserver !== 'undefined') {
      const root = document.documentElement;
      const palette = ['--color-teal', '--color-lime', '--color-coral']
        .map((token) => getComputedStyle(root).getPropertyValue(token).trim());
      let stars = [];
      const makeStars = (width, height) => [
        [0.16, 0.18, 0.25, 0.16, 5], [0.83, 0.16, 0.22, 0.16, 4],
        [0.16, 0.82, 0.26, 0.16, 4], [0.82, 0.8, 0.28, 0.19, 5],
      ].map(([x, y, spreadX, spreadY, count]) => Array.from({ length: count }, () => ({
        x: randomBetween(x - spreadX / 2, x + spreadX / 2) * width,
        y: randomBetween(y - spreadY / 2, y + spreadY / 2) * height,
        radius: randomBetween(2.2, 4.6),
        colour: palette[Math.floor(randomBetween(0, palette.length))],
        phase: randomBetween(0, Math.PI * 2),
        speed: randomBetween(0.0015, 0.0034),
      })).sort((a, b) => a.x - b.x));
      const draw = (time = 0) => {
        const { width, height } = constellation.getBoundingClientRect();
        if (!width || !height || !stars.length) {
          constellationFrame = null;
          return;
        }
        context.clearRect(0, 0, width, height);
        context.strokeStyle = palette[0];
        stars.forEach((cluster) => {
          context.beginPath();
          cluster.forEach(({ x, y }, index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
          context.setLineDash([1, 7]);
          context.lineWidth = 3.2;
          context.globalAlpha = 0.16;
          context.stroke();
          context.beginPath();
          cluster.forEach(({ x, y }, index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
          context.setLineDash([2, 5]);
          context.lineWidth = 1.15;
          context.globalAlpha = 0.58;
          context.stroke();
        });
        context.setLineDash([]);
        stars.flat().forEach((star) => {
          const pulse = reduceMotion.matches ? 0.65 : 0.38 + (Math.sin(time * star.speed + star.phase) + 1) * 0.3;
          context.globalAlpha = pulse;
          context.fillStyle = star.colour;
          context.beginPath();
          context.arc(star.x, star.y, star.radius * (0.75 + pulse * 0.55), 0, Math.PI * 2);
          context.fill();
        });
        context.globalAlpha = 1;
        constellationFrame = reduceMotion.matches ? null : requestAnimationFrame(draw);
      };
      const resize = () => {
        const { width, height } = constellation.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio ?? 1, 2);
        if (!width || !height) return;
        constellation.width = Math.round(width * ratio);
        constellation.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        stars = makeStars(width, height);
        if (!constellationFrame) constellationFrame = requestAnimationFrame(draw);
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(constellation);
      resize();
      observers.push(() => {
        resizeObserver.disconnect();
        if (constellationFrame !== null) cancelAnimationFrame(constellationFrame);
      });
    }
  }

  disposePage = () => {
    controller.abort();
    observers.splice(0).forEach((dispose) => dispose());
    if (constellationFrame !== null) cancelAnimationFrame(constellationFrame);
  };
};

document.addEventListener('astro:before-swap', () => disposePage());
document.addEventListener('astro:page-load', setupPage);

// Run once for the initial document; page-load handles forward/back transitions.
setupPage();


