/**
 * Mount a standalone demo once on first load and again after Astro swaps.
 * Each demo supplies only its own page-specific setup function.
 */
export const mountDemo = (setup) => {
  let dispose = () => {};

  const mount = () => {
    dispose();
    dispose = setup() ?? (() => {});
  };

  document.addEventListener('astro:before-swap', () => dispose());
  document.addEventListener('astro:page-load', mount);
  mount();
};
