# EARTH REALITY

A photorealistic interactive 3D Earth explorer built with TypeScript, Vite, and Three.js.

## Quick start

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Build

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

## GitHub Pages deployment

1. Update the repository name if needed.
2. Run `npm run build`.
3. Publish the `dist` directory via GitHub Pages.
4. Confirm the Vite base path is set to `./` in `vite.config.ts` for project-site compatibility.

## Notes

This project uses a procedural Earth texture and approximate astronomical rendering for a fast, self-contained, no-key experience. It is designed to be usable immediately without external APIs.

## Feature summary

- 3D Earth with procedural continents, Ocean, atmosphere, clouds, and city lights
- Drag, wheel, and touch navigation
- Search and focus for global locations
- Layer toggles and Earth information panel
- Time-based daylight simulation and automatic rotation
- Responsive interface suitable for desktop and mobile

## License

MIT
