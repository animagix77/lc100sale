# The not-so-new 2004 Land Cruiser

A humorous sales site for a 2004 Toyota Land Cruiser 100, with a continuous scroll-driven vehicle orbit, transparent condition notes, ownership history, camping photos, and a buyer transaction guide.

Live website: https://the-all-new-2004-lc100.binhthere.chatgpt.site/

This repository contains the current LC100 listing source. The root directory is ready for GitHub Pages branch publishing. Sites hosting remains separate; pushing here does not deploy the Sites website.

## Local preview and build

Serve this folder with a static web server, for example `python3 -m http.server 8765`, then open http://localhost:8765.

Run `node build.mjs` to prepare `dist/`. No package installation is required. JavaScript files can be checked with `node --check`.

## Photos and vehicle tour

- `assets/gallery/` contains presentation edits and corresponding source photos, including camping images and unretouched mechanic photos. Original-photo comparisons are available in the gallery. Source photos remain the reference for condition; camping accessories in historical photos are excluded unless explicitly listed.
- `assets/video/orbit-scrub.mp4` drives the continuous vehicle orbit from the first scroll. Earlier primary views and interpolated frames remain in `assets/orbit/` as production references. Orbit artwork is a visualization rather than condition photography.
- `assets/history/` contains the owner-history icons, illustrated Land Cruiser, regional map and geographic provenance. The dotted Maryland → Long Island → Leonia journey represents regional stops rather than an exact road route.
- `production/`, `video-prompts.json`, and `storyboard.html` retain production notes and prompts.

## Motion and layout

The ownership story scrolls through three chapters, with the map following the truck between regional stops. Desktop places the story on the left and the map on the right; small screens use a stacked layout. The vehicle orbit remains continuous. Text uses masked reveals, headlines use cream and orange, and numeric stats roll into view. Reduced-motion preferences and keyboard chapter controls are supported.

## Listing

Asking $11,000, sold as is, privately in North Jersey. Viewing is by arrangement. Maintenance and vehicle history are owner-reported; service receipts are unavailable. Known faults, EVAP codes, mechanic photos and the suspected cause are disclosed, including the body-shop/welder recommendation. The suspected cause is not presented as a confirmed diagnosis.

Contact: 917-981-5816 or animagix@mac.com.

The buyer guide covers payment verification, identification, insurance, title and bill of sale, and legal transportation. The seller keeps the New Jersey plates.

## Publishing

GitHub Pages can publish the root of the main branch; `.nojekyll` preserves the static assets. Separate Sites hosting uses the project identified by `.openai/hosting.json`. No credentials are stored in this repository.
