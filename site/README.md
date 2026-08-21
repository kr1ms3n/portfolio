# Mohanverse — personal portfolio

An Astro-based portfolio for Mohan Kumar: design, software and digital products.

## Requirements

- Node.js `22.19` or newer (see `.nvmrc`)
- npm

Install dependencies from this directory:

```sh
npm ci
```

## Development

Start Astro in background mode, as required by this project’s [AGENTS.md](./AGENTS.md):

```sh
npm run dev -- --background
```

The site is available at `http://localhost:4321/`.

Manage the background server with the Astro CLI:

```sh
astro dev status
astro dev logs
astro dev stop
```

If the server is not running in background mode, stop it before starting another instance to avoid a stale or conflicting port.

## Production commands

```sh
npm run build      # generates the static site in dist/
npm run preview    # serves the generated dist/ locally
```

The project uses Astro’s static output. Deploy the `dist/` directory to a static host such as Cloudflare Pages, or connect the repository to a host that runs `npm run build` and publishes `dist/`.

## Validation

Run these checks before committing:

```sh
node --check src/scripts/site.js
npm run build
```

There is no automated test suite yet. Visual checks should be performed in both light and dark themes, at mobile and desktop widths, with reduced motion enabled where relevant.

## Documentation

For framework details, see the [Astro documentation](https://docs.astro.build/). Project-specific development conventions are in [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md).
