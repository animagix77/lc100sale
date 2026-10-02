# The not-so-new 2004

A humorous, full-bleed sales site for a 2004 Toyota Land Cruiser 100, with a scroll-driven orbit, honest condition notes, maintenance history and a gallery of owner photos.

Private owner preview: https://the-all-new-2004-lc100.binhthere.chatgpt.site/

## Local preview

Serve this folder with any static web server. For example, run `python3 -m http.server 8765` and open http://localhost:8765.

## Build

Run `node build.mjs` to create `dist/`. No package installation is required. Check JavaScript with `node --check app.js` and `node --check gallery.js`.

## Photos and orbit

- `assets/gallery/` contains presentation edits and corresponding source-photo JPEGs; the gallery offers a source comparison. Full original HEIC files remain in the owner's Photos Library and iCloud project folder.
- Photo edits improve presentation and remove loose clutter. Generative retouching can reinterpret fine details; the source photos are the condition reference. The cargo edit reconstructs previously covered areas.
- `assets/orbit/` contains the illustrated orbit keyframes used by the scroll tour. The V4 front angles reflect the current TOYOTA grille. These are visualization references, not exact condition photos.
- `production/` contains the V4 animation prompt, sequence and production notes. Full-resolution keyframes and their ZIP are in the iCloud project folder.
- `video-prompts.json` and `storyboard.html` describe later video production.

## Publishing

Hosting remains on the existing private Sites project identified by `.openai/hosting.json`. This GitHub repository is a source copy; pushing here does not automatically deploy the site. No credentials are stored here.

## Listing status

Price, title status, location, contact details and supporting inspection/service records still need owner confirmation. Mileage, faults and service history are owner-reported. The normal horn control is not working; an added dashboard push button is the owner's workaround.
