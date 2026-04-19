# Faraway Atlas

Faraway Atlas is a premium browser tribute built in React and TypeScript for fast local testing and easy static deployment. It recreates the core rhythm of Faraway-style play with a polished presentation, AI rivals, reverse scoring, sanctuary drafting, and multiple variants.

## What is included

- Classic expedition mode with eight-round reverse scoring
- Advanced opening variant with a five-card keep-three opener
- Starfall variant with meteor regions and digit-echo scoring
- 1 to 3 AI rivals with three difficulty levels
- Deterministic seeds for daily or shareable runs
- Responsive in-browser UI with built-in rules, match log, and final breakdowns

## Tech stack

- React 19
- TypeScript
- Vite
- ESLint

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run lint
npm run preview
```

## Render deployment

This repo includes a `render.yaml` Blueprint for a Render static site. After the repository is pushed to GitHub:

1. Open the Render Blueprint flow for the repo.
2. Confirm the static site settings.
3. Deploy the site.

The Blueprint publishes `dist/` and rewrites all routes to `index.html`, so the SPA works correctly.

## Notes

- This project uses original UI, text, and generated card content inspired by the structure of Faraway.
- It is an unofficial fan tribute and is not affiliated with the original publisher or designers.
