# The not-so-new 2004

A humorous, full-bleed sales site for a 2004 Toyota Land Cruiser 100, with a scroll-driven orbit, honest condition notes, maintenance history and a gallery of owner photos.

Private owner preview: https://the-all-new-2004-lc100.binhthere.chatgpt.site/

## Local preview

Serve this folder with any static web server. For example, run `python3 -m http.server 8765` and open http://localhost:8765.

## Build

Run `node build.mjs` to create `dist/`. No package installation is required. Check JavaScript with `node --check app.js` and `node --check gallery.js` and `node --check motion.js`.

## Photos and orbit

- `assets/gallery/` contains presentation edits and corresponding source-photo JPEGs; the gallery offers a source comparison. Full original HEIC files remain in the owner's Photos Library and iCloud project folder.
- Photo edits improve presentation and remove loose clutter. Generative retouching can reinterpret fine details; the source photos are the condition reference. The cargo edit reconstructs previously covered areas.
- `assets/orbit/` contains the illustrated orbit keyframes used by the scroll tour. The V6 angles place a smaller truck on the right and leave the left side open for copy. Real photos guide the transverse Malone bars, compact mounts and slight rear-high stance; fine details remain approximate. These are visualization references, not exact condition photos.
- `production/` contains the V6 animation prompt, sequence and production notes. Full-resolution keyframes and their ZIP are in the iCloud project folder.
- `video-prompts.json` and `storyboard.html` describe later video production.

## Motion

Scroll-driven orbit keyframes use brief transitions. Headings, cards and service entries reveal on entry; buttons and gallery controls have subtle motion. Decorative animation respects reduced-motion preferences. Original photo comparison remains available.

## Publishing

Hosting remains on the existing private Sites project identified by `.openai/hosting.json`. This GitHub repository is a source copy; pushing here does not automatically deploy the site. No credentials are stored here.

## Listing status

The private preview uses a proposed $11,000 asking price and prominent as-is positioning for mechanics, handy buyers and enthusiasts. Title status, location and contact details still need owner confirmation. There are no service receipts; care and maintenance are presented as the owner’s account. Mileage, faults and service history are owner-reported. The normal horn control is not working; an added dashboard push button is the owner's workaround.
