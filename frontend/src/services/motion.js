/**
 * Decorative motion helpers (anime.js). Never carry data or state.
 * All animations are skipped when the user prefers reduced motion,
 * and every call is wrapped so a failure can never break the UI.
 */
import { animate, stagger } from 'animejs';

export function motionOK() {
  try {
    return typeof window !== 'undefined'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function play(targets, params) {
  if (!motionOK()) return;
  try {
    if (typeof targets === 'string' && document.querySelectorAll(targets).length === 0) return;
    animate(targets, params);
  } catch { /* decorative only */ }
}

/** Cascade-in for groups (KPI cards). Fires only when there is data to show. */
export function cascadeIn(selector, hasData) {
  if (!hasData) return;
  play(selector, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 500,
    ease: 'outQuad',
    delay: stagger(80),
  });
}

/** Ripple for filterable rows on every filter/search change. */
export function rippleIn(selector, hasData) {
  if (!hasData) return;
  play(selector, {
    opacity: [0, 1],
    translateX: [-8, 0],
    duration: 350,
    ease: 'outQuad',
    delay: stagger(40),
  });
}

/** One-shot success pulse on a single element by id. */
export function pulseOnce(id) {
  play(`#${id}`, { scale: [1, 1.6, 1], duration: 600, ease: 'outQuad' });
}
