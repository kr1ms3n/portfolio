import { mountDemo } from '@/scripts/demo-runtime.js';

mountDemo(() => {
  const dialog = document.querySelector('#run-register');
  if (!(dialog instanceof HTMLDialogElement)) return;

  const form = dialog.querySelector('form');
  const formView = dialog.querySelector('[data-run-form-view]');
  const success = dialog.querySelector('[data-run-success]');
  const controller = new AbortController();
  const { signal } = controller;
  const editPass = () => {
    formView.hidden = false;
    success.hidden = true;
    dialog.setAttribute('aria-labelledby', 'run-register-title');
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    dialog.querySelector('[data-run-runner]').textContent = `See you at the starting line, ${data.get('runner').trim()}.`;
    dialog.querySelector('[data-run-distance]').textContent = data.get('distance');
    formView.hidden = true;
    success.hidden = false;
    dialog.setAttribute('aria-labelledby', 'run-pass-title');
    dialog.querySelector('[data-run-success-title]').focus();
  }, { signal });

  dialog.querySelector('[data-run-edit]').addEventListener('click', () => {
    editPass();
    form.querySelector('input[name="runner"]').focus();
  }, { signal });
  dialog.addEventListener('close', () => { form.reset(); editPass(); }, { signal });

  const captions = {
    5: '5K community run · One park loop, at your own pace.',
    10: '10K timed run · Through the park and along the river.',
    21: 'Half marathon · The full riverside circuit.',
  };
  const route = document.querySelector('#run-route');
  route.querySelectorAll('[data-run-route]').forEach(button => {
    button.addEventListener('click', () => {
      const distance = button.dataset.runRoute;
      route.querySelectorAll('[data-run-route]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      route.querySelectorAll('[data-run-course]').forEach(path => { path.toggleAttribute('hidden', path.dataset.runCourse !== distance); });
      route.querySelector('[data-run-route-caption]').textContent = captions[distance];
    }, { signal });
  });

  return () => controller.abort();
});
