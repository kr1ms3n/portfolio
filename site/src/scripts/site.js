const SELECTOR = Object.freeze({
  aboutTrigger: '.about-trigger', aboutContent: '.about-content', portrait: '.about-portrait',
  menuButton: '.floating-menu', menuSurface: '.floating-menu__surface', menuBlob: '#menu-blob-path',
  menuOverlay: '.menu-overlay', menuClose: '.menu-overlay__close', menuLink: '[data-menu-link]',
  themeToggle: '[data-theme-toggle]', regions: 'main, footer',
});
const trigger = document.querySelector(SELECTOR.aboutTrigger);
const content = document.querySelector(SELECTOR.aboutContent);
const portrait = document.querySelector(SELECTOR.portrait);
const menuButton = document.querySelector(SELECTOR.menuButton);
const menuSurface = document.querySelector(SELECTOR.menuSurface);
const menuBlobPath = document.querySelector(SELECTOR.menuBlob);
const menuOverlay = document.querySelector(SELECTOR.menuOverlay);
const menuClose = document.querySelector(SELECTOR.menuClose);
const menuLinks = document.querySelectorAll(SELECTOR.menuLink);
const themeSwitches = document.querySelectorAll(SELECTOR.themeToggle);
const pageRegions = document.querySelectorAll(SELECTOR.regions);
const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const themeStorageKey = 'mohanverse-theme';
const listen = (target, event, handler, options) => target?.addEventListener(event, handler, options);

const cssMilliseconds = (token, fallback) => {
  const value = getComputedStyle(root).getPropertyValue(token).trim();
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return fallback;
  return value.endsWith('ms') ? amount : value.endsWith('s') ? amount * 1000 : fallback;
};

const motionDuration = {
  ui: cssMilliseconds('--duration-ui', 240),
  layout: cssMilliseconds('--duration-layout', 360),
};

const savedTheme = () => {
  try {
    const value = window.localStorage.getItem(themeStorageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

const saveTheme = (theme) => {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The current session still honours the selected theme if storage is unavailable.
  }
};

const storedTheme = savedTheme();
if (storedTheme) root.dataset.theme = storedTheme;

const activeTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

const syncThemeControls = () => {
  const isDark = activeTheme() === 'dark';
  themeSwitches.forEach((themeSwitch) => {
    themeSwitch.setAttribute('aria-pressed', String(isDark));
    themeSwitch.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  });
};

const setTheme = (theme) => {
  root.dataset.theme = theme;
  saveTheme(theme);
  syncThemeControls();
};

syncThemeControls();
listen(systemDark, 'change', () => {
  if (!root.dataset.theme) syncThemeControls();
});

listen(trigger, 'click', () => {
  const expanded = trigger.getAttribute('aria-expanded') === 'true';
  trigger.setAttribute('aria-expanded', String(!expanded));
  trigger.querySelector('em')?.replaceChildren(document.createTextNode(expanded ? 'EXPAND +' : 'CLOSE −'));
  content.hidden = expanded;
  trigger.closest('.about').classList.toggle('is-expanded', !expanded);
  if (!expanded) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

if (portrait) {
  const movePortraitSpotlight = (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = portrait.getBoundingClientRect();
    portrait.style.setProperty('--spotlight-x', `${((event.clientX - bounds.left) / bounds.width * 100).toFixed(2)}%`);
    portrait.style.setProperty('--spotlight-y', `${((event.clientY - bounds.top) / bounds.height * 100).toFixed(2)}%`);
  };

  listen(portrait, 'pointerenter', movePortraitSpotlight);
  listen(portrait, 'pointermove', movePortraitSpotlight);
}

let dragStart = null;
let suppressMenuClick = false;
let menuCorner = 'bottom-right';
let snapTimer = null;
let blobFrame = null;
let blobRelaxTimer = null;
const blobForce = { x: 0, y: 0 };
const blobTarget = { x: 0, y: 0 };
const blobMomentum = { x: 0, y: 0 };
let blobAmount = 0;
let blobTargetAmount = 0;
let blobAutonomous = false;
let focusBeforeMenu = null;
const reduceBlobMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const blobMotion = { amount: 0.72, duration: 2400, ease: 0.2 };
const blobBaseRadii = [40, 49, 41, 47, 50, 40, 48, 39, 47, 50, 41, 49];
const blobRestRadius = 44;

const smoothClosedPath = (points) => {
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = midpoint(points.at(-1), points[0]);
  const commands = [`M${start.x.toFixed(2)} ${start.y.toFixed(2)}`];

  points.forEach((point, index) => {
    const end = midpoint(point, points[(index + 1) % points.length]);
    commands.push(`Q${point.x.toFixed(2)} ${point.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
  });

  return `${commands.join(' ')} Z`;
};

const staticCirclePath = smoothClosedPath(Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * blobRestRadius,
    y: 50 + Math.sin(angle) * blobRestRadius,
  };
}));

const blobPathFromForce = (forceX, forceY, amount = Math.min(1, Math.hypot(forceX, forceY)), phase = 0) => {
  const rawMagnitude = Math.hypot(forceX, forceY);
  const magnitude = Math.min(1, rawMagnitude);
  if (magnitude < 0.005 && amount < 0.005) return staticCirclePath;

  const directionX = rawMagnitude ? forceX / rawMagnitude : 1;
  const directionY = rawMagnitude ? forceY / rawMagnitude : 0;
  const normalX = -directionY;
  const normalY = directionX;
  const stretch = 1 + magnitude * 0.18;
  const squash = 1 - magnitude * 0.1;

  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
    const pulse = (
      Math.sin(phase + index * 1.7) * 2.2
      + Math.sin(phase * 0.63 - index * 0.9) * 1.1
    ) * amount;
    const radius = blobRestRadius + (blobBaseRadii[index] - blobRestRadius) * amount + pulse;
    const vectorX = Math.cos(angle) * radius;
    const vectorY = Math.sin(angle) * radius;
    const parallel = vectorX * directionX + vectorY * directionY;
    const normal = vectorX * normalX + vectorY * normalY;
    const facing = Math.max(0, Math.cos(angle) * directionX + Math.sin(angle) * directionY);
    const leadingBulge = facing * facing * magnitude * 3.2;

    return {
      x: 50 + directionX * (parallel * stretch + leadingBulge) + normalX * normal * squash,
      y: 50 + directionY * (parallel * stretch + leadingBulge) + normalY * normal * squash,
    };
  });

  return smoothClosedPath(points);
};

const animateBlobForce = (timestamp = performance.now()) => {
  blobMomentum.x = (blobMomentum.x + (blobTarget.x - blobForce.x) * 0.18) * 0.76;
  blobMomentum.y = (blobMomentum.y + (blobTarget.y - blobForce.y) * 0.18) * 0.76;
  blobForce.x += blobMomentum.x;
  blobForce.y += blobMomentum.y;
  blobAmount += (blobTargetAmount - blobAmount) * blobMotion.ease;
  const phase = blobAutonomous ? (timestamp % blobMotion.duration) / blobMotion.duration * Math.PI * 2 : 0;
  const renderX = blobForce.x + (blobAutonomous ? Math.cos(phase) * 0.18 : 0);
  const renderY = blobForce.y + (blobAutonomous ? Math.sin(phase) * 0.14 : 0);
  const renderAmount = blobAmount * (blobAutonomous ? 0.9 + Math.sin(phase * 2) * 0.1 : 1);
  menuBlobPath.setAttribute('d', blobPathFromForce(renderX, renderY, renderAmount, phase));

  const unsettled = Math.hypot(blobTarget.x - blobForce.x, blobTarget.y - blobForce.y) > 0.005;
  const active = Math.hypot(blobForce.x, blobForce.y) > 0.005;
  const coasting = Math.hypot(blobMomentum.x, blobMomentum.y) > 0.002;
  const shapeUnsettled = Math.abs(blobTargetAmount - blobAmount) > 0.005;
  if (unsettled || active || coasting || shapeUnsettled || blobAutonomous) blobFrame = requestAnimationFrame(animateBlobForce);
  else {
    if (blobTargetAmount < 0.005) {
      blobForce.x = 0;
      blobForce.y = 0;
      blobMomentum.x = 0;
      blobMomentum.y = 0;
      blobAmount = 0;
      menuBlobPath.setAttribute('d', staticCirclePath);
    }
    blobFrame = null;
  }
};

const setBlobForce = (
  deltaX,
  deltaY,
  intensity = Math.min(1, Math.hypot(deltaX, deltaY) / 9),
  amount = intensity > 0 ? Math.max(blobMotion.amount, intensity) : 0
) => {
  if (reduceBlobMotion.matches) {
    blobForce.x = 0;
    blobForce.y = 0;
    blobTarget.x = 0;
    blobTarget.y = 0;
    blobMomentum.x = 0;
    blobMomentum.y = 0;
    blobAmount = amount;
    blobTargetAmount = amount;
    menuBlobPath.setAttribute('d', blobPathFromForce(0, 0, amount));
    return;
  }

  const length = Math.hypot(deltaX, deltaY) || 1;
  blobTarget.x = (deltaX / length) * intensity;
  blobTarget.y = (deltaY / length) * intensity;
  blobTargetAmount = amount;
  if (!blobFrame) blobFrame = requestAnimationFrame(animateBlobForce);
};

const relaxMenuBlob = (delay = 70, stayBlobbed = Boolean(dragStart)) => {
  clearTimeout(blobRelaxTimer);
  blobRelaxTimer = window.setTimeout(() => setBlobForce(0, 0, 0, stayBlobbed ? blobMotion.amount : 0), delay);
};

const setBlobMotion = (active) => {
  clearTimeout(blobRelaxTimer);
  blobAutonomous = active;
  setBlobForce(0, 0, 0, active ? blobMotion.amount : 0);
};

const breatheMenu = (active) => {
  if (dragStart?.moved || (active && (!menuOverlay.hidden || reduceBlobMotion.matches))) return;
  setBlobMotion(active);
};

menuBlobPath.setAttribute('d', blobPathFromForce(0, 0, 0));

const stopMenuBlob = () => {
  blobAutonomous = false;
  clearTimeout(blobRelaxTimer);
  if (blobFrame) cancelAnimationFrame(blobFrame);
  blobFrame = null;
  blobForce.x = 0;
  blobForce.y = 0;
  blobTarget.x = 0;
  blobTarget.y = 0;
  blobMomentum.x = 0;
  blobMomentum.y = 0;
  blobAmount = 0;
  blobTargetAmount = 0;
  menuBlobPath.setAttribute('d', staticCirclePath);
};

const whompMenu = () => {
  menuButton.classList.remove('is-whomp');
  menuSurface.getBoundingClientRect();
  menuButton.classList.add('is-whomp');
  window.setTimeout(() => menuButton.classList.remove('is-whomp'), motionDuration.ui);
};

const applyMenuOpenState = (isOpen) => {
  if (isOpen) {
    stopMenuBlob();
    focusBeforeMenu = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : menuButton;
  }

  menuOverlay.hidden = !isOpen;
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.inert = isOpen;
  pageRegions.forEach((region) => { region.inert = isOpen; });
  document.body.classList.toggle('menu-open', isOpen);

  if (isOpen) {
    menuClose.focus();
    return;
  }

  const focusTarget = focusBeforeMenu?.isConnected ? focusBeforeMenu : menuButton;
  focusBeforeMenu = null;
  focusTarget.focus();
};

const trapMenuFocus = (event) => {
  if (event.key !== 'Tab' || menuOverlay.hidden) return;

  const focusable = [...menuOverlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  const outsideMenu = !menuOverlay.contains(document.activeElement);
  const leavingStart = event.shiftKey && document.activeElement === first;
  const leavingEnd = !event.shiftKey && document.activeElement === last;

  if (outsideMenu || leavingStart || leavingEnd) {
    event.preventDefault();
    (leavingStart ? last : first).focus();
  }
};

const setMenuOpen = (isOpen) => {
  if (typeof document.startViewTransition !== 'function' || reduceBlobMotion.matches) {
    applyMenuOpenState(isOpen);
    return;
  }

  document.startViewTransition(() => applyMenuOpenState(isOpen));
};

const setMenuPosition = (corner = menuCorner) => {
  const [vertical, horizontal] = corner.split('-');
  menuCorner = corner;

  menuButton.style.top = vertical === 'top' ? '0' : 'auto';
  menuButton.style.right = horizontal === 'right' ? '0' : 'auto';
  menuButton.style.bottom = vertical === 'bottom' ? '0' : 'auto';
  menuButton.style.left = horizontal === 'left' ? '0' : 'auto';
  menuButton.style.transform = `translate(${horizontal === 'left' ? '-25%' : '25%'}, ${vertical === 'top' ? '-25%' : '25%'})`;
};

const snapMenuToCorner = () => {
  const rect = menuButton.getBoundingClientRect();
  const horizontal = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
  const vertical = rect.top + rect.height / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
  const corner = `${vertical}-${horizontal}`;
  const edge = rect.width * 0.25;
  const targetLeft = horizontal === 'left' ? -edge : window.innerWidth - rect.width + edge;
  const targetTop = vertical === 'top' ? -edge : window.innerHeight - rect.height + edge;

  clearTimeout(snapTimer);
  clearTimeout(blobRelaxTimer);
  setBlobMotion(false);
  menuButton.classList.add('is-snapping');
  menuButton.getBoundingClientRect();
  menuButton.style.left = `${targetLeft}px`;
  menuButton.style.top = `${targetTop}px`;

  snapTimer = window.setTimeout(() => {
    menuButton.classList.remove('is-snapping');
    stopMenuBlob();
    setMenuPosition(corner);
    whompMenu();
    snapTimer = null;
  }, motionDuration.layout);
};

listen(menuButton, 'pointerenter', (event) => {
  if (event.pointerType !== 'touch') breatheMenu(true);
});

listen(menuButton, 'pointerleave', (event) => {
  if (event.pointerType !== 'touch') breatheMenu(false);
});

listen(menuButton, 'pointerdown', (event) => {
  dragStart = {
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    threshold: event.pointerType === 'touch' ? 16 : 6,
    pointerType: event.pointerType,
    moved: false,
  };
  menuButton.setPointerCapture(event.pointerId);
  menuButton.classList.add('is-held');
});

listen(menuButton, 'pointermove', (event) => {
  if (!dragStart) return;
  const distance = Math.hypot(event.clientX - dragStart.startX, event.clientY - dragStart.startY);
  if (distance <= dragStart.threshold) return;
  if (!dragStart.moved) {
    dragStart.moved = true;

    clearTimeout(snapTimer);
    snapTimer = null;
    menuButton.classList.remove('is-snapping');

    const rect = menuButton.getBoundingClientRect();
    dragStart.offsetX = dragStart.startX - rect.left;
    dragStart.offsetY = dragStart.startY - rect.top;
    dragStart.size = rect.width;
    menuButton.style.top = `${rect.top}px`;
    menuButton.style.right = 'auto';
    menuButton.style.bottom = 'auto';
    menuButton.style.left = `${rect.left}px`;
    menuButton.style.transform = 'none';
    menuButton.classList.add('is-dragging');
    setBlobMotion(true);
  }

  const edge = dragStart.size * 0.25;
  const left = Math.min(window.innerWidth - dragStart.size + edge, Math.max(-edge, event.clientX - dragStart.offsetX));
  const top = Math.min(window.innerHeight - dragStart.size + edge, Math.max(-edge, event.clientY - dragStart.offsetY));
  menuButton.style.left = `${left}px`;
  menuButton.style.top = `${top}px`;
  setBlobForce(event.clientX - dragStart.lastX, event.clientY - dragStart.lastY);
  dragStart.lastX = event.clientX;
  dragStart.lastY = event.clientY;
  relaxMenuBlob();
});

listen(menuButton, 'pointerup', () => {
  if (!dragStart) return;
  suppressMenuClick = dragStart.moved;
  menuButton.classList.remove('is-held', 'is-dragging');
  if (dragStart.moved) snapMenuToCorner();
  dragStart = null;
});

listen(menuButton, 'pointercancel', () => {
  if (!dragStart) return;
  const wasTap = dragStart.pointerType === 'touch' && !dragStart.moved;
  menuButton.classList.remove('is-held', 'is-dragging');
  if (dragStart.moved) snapMenuToCorner();
  dragStart = null;
  if (wasTap) setMenuOpen(true);
});

listen(menuButton, 'click', (event) => {
  if (suppressMenuClick) {
    event.preventDefault();
    suppressMenuClick = false;
    return;
  }
  setMenuOpen(true);
});

listen(menuClose, 'click', () => setMenuOpen(false));
themeSwitches.forEach((themeSwitch) => {
  listen(themeSwitch, 'click', () => {
    setTheme(activeTheme() === 'dark' ? 'light' : 'dark');
  });
});
menuLinks.forEach((link) => listen(link, 'click', () => setMenuOpen(false)));
listen(menuOverlay, 'click', (event) => {
  if (event.target instanceof Element && !event.target.closest('a, button')) setMenuOpen(false);
});
listen(document, 'keydown', (event) => {
  if (event.key === 'Escape' && !menuOverlay.hidden) setMenuOpen(false);
  trapMenuFocus(event);
});

listen(window, 'resize', () => {
  if (!dragStart) setMenuPosition();
});

const scatterItems = document.querySelectorAll('.chaos-piece');
const randomBetween = (min, max) => Math.random() * (max - min) + min;

document.querySelectorAll('.constellation-word').forEach((word) => {
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

const observeMotion = (target, className, { delay = 0, threshold = 0.35, rootMargin = '0px' } = {}) => {
  if (!target || reduceBlobMotion.matches || typeof IntersectionObserver === 'undefined') return;

  let timer = null;
  const observer = new IntersectionObserver(([entry]) => {
    const inFocus = entry.isIntersecting && entry.intersectionRatio >= threshold;
    if (inFocus) {
      if (!timer && !target.classList.contains(className)) {
        timer = window.setTimeout(() => {
          target.classList.add(className);
          timer = null;
        }, delay);
      }
      return;
    }

    window.clearTimeout(timer);
    timer = null;
    target.classList.remove(className);
  }, { threshold: threshold ? [0, threshold] : [0], rootMargin });

  observer.observe(target);
};

observeMotion(document.querySelector('.practice'), 'is-practice-active', {
  delay: 3000,
  threshold: 0,
  rootMargin: '-28% 0px -28% 0px',
});
observeMotion(document.querySelector('.lab'), 'is-lab-active', { threshold: 0.28 });

const constellation = document.querySelector('.about-constellation');
if (constellation) {
  const context = constellation.getContext('2d');
  const palette = ['--color-teal', '--color-lime', '--color-coral']
    .map((token) => getComputedStyle(root).getPropertyValue(token).trim());
  let stars = [];
  let constellationFrame = null;

  const makeStars = (width, height) => [
    [0.16, 0.18, 0.25, 0.16, 5],
    [0.83, 0.16, 0.22, 0.16, 4],
    [0.16, 0.82, 0.26, 0.16, 4],
    [0.82, 0.8, 0.28, 0.19, 5],
  ].map(([x, y, spreadX, spreadY, count]) => Array.from({ length: count }, () => ({
    x: randomBetween(x - spreadX / 2, x + spreadX / 2) * width,
    y: randomBetween(y - spreadY / 2, y + spreadY / 2) * height,
    radius: randomBetween(2.2, 4.6),
    colour: palette[Math.floor(randomBetween(0, palette.length))],
    phase: randomBetween(0, Math.PI * 2),
    speed: randomBetween(0.0015, 0.0034),
  })).sort((a, b) => a.x - b.x));

  const resizeConstellation = () => {
    const { width, height } = constellation.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio ?? 1, 2);
    if (!width || !height) return;
    constellation.width = Math.round(width * ratio);
    constellation.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    stars = makeStars(width, height);
    if (!constellationFrame) constellationFrame = requestAnimationFrame(drawConstellation);
  };

  const drawConstellation = (time = 0) => {
    const { width, height } = constellation.getBoundingClientRect();
    if (!width || !height || !stars.length) {
      constellationFrame = null;
      return;
    }
    context.clearRect(0, 0, width, height);
    context.strokeStyle = palette[0];
    stars.forEach((cluster) => {
      context.beginPath();
      cluster.forEach(({ x, y }, index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.setLineDash([1, 7]);
      context.lineWidth = 3.2;
      context.globalAlpha = 0.16;
      context.stroke();
      context.beginPath();
      cluster.forEach(({ x, y }, index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.setLineDash([2, 5]);
      context.lineWidth = 1.15;
      context.globalAlpha = 0.58;
      context.stroke();
    });
    context.setLineDash([]);

    stars.flat().forEach((star) => {
      const pulse = reduceBlobMotion.matches ? 0.65 : 0.38 + (Math.sin(time * star.speed + star.phase) + 1) * 0.3;
      context.globalAlpha = pulse;
      context.fillStyle = star.colour;
      context.beginPath();
      context.arc(star.x, star.y, star.radius * (0.75 + pulse * 0.55), 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
    constellationFrame = reduceBlobMotion.matches ? null : requestAnimationFrame(drawConstellation);
  };

  new ResizeObserver(resizeConstellation).observe(constellation);
  resizeConstellation();
}

scatterItems.forEach((item) => {
  ['enter', 'exit'].forEach((edge) => {
    item.style.setProperty(`--chaos-${edge}-x`, `${randomBetween(-2.25, 2.25).toFixed(2)}rem`);
    item.style.setProperty(`--chaos-${edge}-y`, `${randomBetween(-1.5, 1.5).toFixed(2)}rem`);
    item.style.setProperty(`--chaos-${edge}-r`, `${randomBetween(-4, 4).toFixed(2)}deg`);
  });
});

setMenuPosition();
menuButton.classList.add('is-ready');
