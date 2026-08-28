import { mountDemo } from '@/scripts/demo-runtime.js';

const setupReservation = () => {
  const dialog = document.querySelector('#reserve-dialog');
  const form = document.querySelector('[data-reserve-form]');
  const success = document.querySelector('[data-reserve-success]');
  const email = document.querySelector('#reserve-email');
  if (!(dialog instanceof HTMLDialogElement)
    || !(form instanceof HTMLFormElement)
    || !(success instanceof HTMLElement)) return;

  const controller = new AbortController();
  const { signal } = controller;
  let returnFocus = null;
  const close = () => {
    if (dialog.open) dialog.close();
    returnFocus?.focus();
  };

  const resetView = () => {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    if (dialog.open) close();
  };

  document.querySelectorAll('[data-open-reserve]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      returnFocus = trigger instanceof HTMLElement ? trigger : null;
      success.hidden = true;
      form.hidden = false;
      dialog.showModal();
      requestAnimationFrame(() => email instanceof HTMLElement && email.focus());
    }, { signal });
  });

  document.querySelectorAll('[data-close-reserve]').forEach((trigger) => {
    trigger.addEventListener('click', close, { signal });
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  }, { signal });
  dialog.addEventListener('close', () => returnFocus?.focus(), { signal });
  window.addEventListener('demo:reset', resetView, { signal });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    form.hidden = true;
    success.hidden = false;
    success.querySelector('h2')?.focus();
  }, { signal });

  return () => controller.abort();
};

mountDemo(setupReservation);
