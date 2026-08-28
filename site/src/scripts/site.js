import {
  applyTheme,
  readStoredTheme,
  writeStoredTheme,
} from '@/scripts/theme.js';

const SELECTOR = Object.freeze({
  menuButton: '.floating-menu', menuSurface: '.floating-menu__surface', menuBlob: '#menu-blob-path',
  menuOverlay: '.menu-overlay', menuClose: '.menu-overlay__close', menuLink: '[data-menu-link]',
  menuPanel: '[data-menu-panel]', panelTarget: '[data-menu-panel-target]', panelBack: '[data-menu-panel-back]',
  themeToggle: '[data-theme-toggle]', regions: 'main, footer',
});
const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const listen = (target, event, handler, options) => target?.addEventListener(event, handler, options);

const cssMilliseconds = (token, fallback) => {
  const value = getComputedStyle(root).getPropertyValue(token).trim();
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return fallback;
  return value.endsWith('ms') ? amount : value.endsWith('s') ? amount * 1000 : fallback;
};

const motionDuration = {
  base: cssMilliseconds('--motion-base', 240),
  slow: cssMilliseconds('--motion-slow', 360),
};

const storedTheme = root.dataset.theme === 'light' || root.dataset.theme === 'dark'
  ? root.dataset.theme
  : null;
let themeOverride = storedTheme;

const activeTheme = () => themeOverride || (systemDark.matches ? 'dark' : 'light');

const syncThemeControls = () => {
  const isDark = activeTheme() === 'dark';
  document.querySelectorAll(SELECTOR.themeToggle).forEach((themeSwitch) => {
    themeSwitch.setAttribute('aria-pressed', String(isDark));
    themeSwitch.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  });
};

const applyStoredTheme = (targetDocument = document) => {
  const stored = readStoredTheme();
  const theme = stored || themeOverride;
  return applyTheme(targetDocument, theme);
};

const syncPersistedTheme = () => {
  const theme = applyStoredTheme();
  themeOverride = theme;
  syncThemeControls();
};

const setTheme = (theme) => {
  themeOverride = theme;
  applyTheme(document, theme);
  writeStoredTheme(theme);
  syncThemeControls();
};

syncThemeControls();
listen(systemDark, 'change', () => {
  if (!themeOverride) syncThemeControls();
});
listen(document, 'astro:before-swap', (event) => {
  applyStoredTheme(event.newDocument);
});
listen(document, 'astro:after-swap', syncPersistedTheme);
listen(document, 'astro:page-load', syncPersistedTheme);

const initMenu = () => {
  const menuButton = document.querySelector(SELECTOR.menuButton);
  const menuSurface = document.querySelector(SELECTOR.menuSurface);
  const menuBlobPath = document.querySelector(SELECTOR.menuBlob);
  const menuOverlay = document.querySelector(SELECTOR.menuOverlay);
  const menuClose = document.querySelector(SELECTOR.menuClose);
  const menuLinks = document.querySelectorAll(SELECTOR.menuLink);
  const menuPanels = [...document.querySelectorAll(SELECTOR.menuPanel)];
  const panelTargets = document.querySelectorAll(SELECTOR.panelTarget);
  const panelBacks = document.querySelectorAll(SELECTOR.panelBack);

  if (!(menuButton && menuSurface && menuBlobPath && menuOverlay && menuClose)) return;
  if (menuButton.dataset.menuReady === 'true') return;

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
  window.setTimeout(() => menuButton.classList.remove('is-whomp'), motionDuration.base);
};

const panelMap = new Map(menuPanels.map((panel) => [panel.dataset.menuPanel, panel]));
let panelStack = ['root'];

const syncPanelState = () => {
  const activeId = panelStack.at(-1);
  const activeIndex = panelStack.length - 1;

  menuPanels.forEach((panel) => {
    const panelIndex = panelStack.indexOf(panel.dataset.menuPanel);
    const state = panel.dataset.menuPanel === activeId
      ? 'is-active'
      : panelIndex >= 0 && panelIndex < activeIndex
        ? 'is-before'
        : 'is-after';
    const isActive = state === 'is-active';
    panel.classList.remove('is-before', 'is-active', 'is-after');
    panel.classList.add(state);
    panel.inert = !isActive;
    panel.setAttribute('aria-hidden', String(!isActive));
  });

  panelTargets.forEach((target) => {
    target.setAttribute('aria-expanded', String(target.dataset.menuPanelTarget === activeId));
  });
};

const resetPanelNavigation = () => {
  panelStack = ['root'];
  syncPanelState();
};

const setActivePanel = (panelId, direction = 'forward', focus = true) => {
  if (!panelMap.has(panelId) || panelStack.at(-1) === panelId) return;

  const previousPanelId = panelStack.at(-1);
  const existingIndex = panelStack.indexOf(panelId);
  if (direction === 'back') {
    if (existingIndex < 0) return;
    panelStack = panelStack.slice(0, existingIndex + 1);
  } else if (existingIndex >= 0) {
    panelStack = panelStack.slice(0, existingIndex + 1);
  } else panelStack = [...panelStack, panelId];
  syncPanelState();
  if (!focus) return;

  const focusTarget = direction === 'back'
    ? [...panelTargets].find((target) => target.dataset.menuPanelTarget === previousPanelId)
    : panelMap.get(panelId)?.querySelector(SELECTOR.panelBack);
  focusTarget?.focus({ preventScroll: true });
};

resetPanelNavigation();

const applyMenuOpenState = (isOpen) => {
  if (isOpen) {
    stopMenuBlob();
    resetPanelNavigation();
    focusBeforeMenu = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : menuButton;
  }

  menuOverlay.hidden = !isOpen;
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.inert = isOpen;
  document.querySelectorAll(SELECTOR.regions).forEach((region) => { region.inert = isOpen; });
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

  const focusable = [...menuOverlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.closest('[inert]'));
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
  }, motionDuration.slow);
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
panelTargets.forEach((target) => {
  listen(target, 'click', () => setActivePanel(target.dataset.menuPanelTarget));
});
panelBacks.forEach((back) => {
  listen(back, 'click', () => setActivePanel(back.dataset.menuPanelBack, 'back'));
});
listen(document, 'click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(SELECTOR.themeToggle)) {
    setTheme(activeTheme() === 'dark' ? 'light' : 'dark');
  }
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
  if (!dragStart) {
    setMenuPosition();
  }
});

setMenuPosition();
menuButton.dataset.menuReady = 'true';
menuButton.classList.add('is-ready');
};

document.addEventListener('astro:page-load', initMenu);
initMenu();
