# The not-so-new 2004 Land Cruiser

A humorous, full-bleed sales site for a 2004 Toyota Land Cruiser 100, with a scroll-driven orbit, honest condition notes, maintenance history and owner-photo gallery.

Published site: https://the-all-new-2004-lc100.binhthere.chatgpt.site/

This source matches the published Sites checkout at commit `046ba2b98cfba5ec3e9f975dba4a3881a244005f`.

## Local preview and build

Serve this folder with a static web server, for example `python3 -m http.server 8765`, then open http://localhost:8765.

Run `node build.mjs` to create `dist/`. No package installation is required. JavaScript syntax checks: `node --check app.js`, `node --check sequence-player.js`, `node --check gallery.js`, and `node --check motion.js`.

## Photos and orbit

- `assets/gallery/` contains presentation edits and corresponding source JPEGs. The gallery offers original-photo comparisons and includes camping images and unretouched mechanic photos. Blemishes remain visible; source photos are the reference for actual condition. Full original HEICs remain outside this repository.
- `assets/orbit/primary-frames-v7.json` records the approved primary views, guided by real photos for the Malone crossbars and slight rear-high stance. Orbit artwork is a visualization, not exact condition photography.
- `assets/orbit/sequence-v1/` contains 88 PNGs at 960 × 540: eight primary views plus 80 RIFE motion-interpolated in-betweens. The timeline has 89 entries, including a repeat of the opening frame to close the orbit. Provenance and feature-alignment notes are included. Interpolation can visibly morph tires, bars and occlusion boundaries, so the scroll tour settles on primary views.
- `production/` preserves earlier animation prompts and production notes. `video-prompts.json` and `storyboard.html` describe later video production.

## Motion and presentation

The tour uses firm snapping between primary views, with in-betweens during movement. Headlines use white and orange accents, masked line reveals and restrained body-copy transitions. Keyboard chapter navigation and reduced-motion preferences are supported. Detail bubbles use real photos; the tire magnifier sits above the vehicle and points to the rear wheel.

## Listing

The asking price is $11,000, sold as is, aimed at mechanics, handy buyers and enthusiasts. Maintenance is owner-reported and service receipts are unavailable. Known faults, EVAP codes and the mechanic's suspected cause are disclosed, including the body-shop/welder recommendation. A suspected cause is not represented as a confirmed diagnosis. Two functional rear jump seats and Malone crossbars are included; the rooftop tent is excluded. Title status and sale location still need confirmation.

Contact: 917-981-5816 or animagix@mac.com.

## Publishing

Hosting uses the existing Sites project identified by `.openai/hosting.json`. GitHub is a source mirror; pushing here does not automatically deploy the website. No credentials are stored in this repository.
