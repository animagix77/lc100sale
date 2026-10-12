# The not-so-new 2004 Land Cruiser

A humorous sales site for a 2004 Toyota Land Cruiser 100, with a continuous scroll-driven vehicle orbit, transparent condition notes, ownership history, camping photos, and a buyer transaction guide.

Developer: Judge Dean LLC.

Live website: https://animagix77.github.io/lc100sale/

The historical Sites website is a separate deployment.

This repository contains the current LC100 listing source. The root directory is ready for GitHub Pages branch publishing. Sites hosting remains separate; pushing here does not deploy the Sites website.

## Local preview and build

Serve this folder with `python3 -m http.server 8766 --bind 127.0.0.1`, then open http://127.0.0.1:8766. The direct game is http://127.0.0.1:8766/drive/.

The static website needs no package installation. For game development, run `npm ci`, `npm test`, and `npm run build` from `drive/source/`. Edit that source directory and rebuild the generated `drive/drive.js` bundle. Dependencies install locally and do not require another workstation's paths.

**Do not publish the legacy `build.mjs` output.** Its `dist/` export omits current website files and the game. GitHub Pages serves this repository's root. JavaScript files can be checked with `node --check`.

The local poll expects its separate backend at `127.0.0.1:8767`; it is not included in this checkout. Reserve that port for the backend and use port 8768 for the sibling model comparison viewer. Use the `127.0.0.1` preview URL: the current frontend selects the production poll on `localhost`.

## Interface design

Follow [the LC100 design system](drive/DESIGN-SYSTEM.md) for shared colors, control states, spacing, motion and accessibility. The game and sale page use the authored `drive/ui-icons.svg` family; do not use emoji, system icons, icon fonts or Unicode pictograms as controls. Prefer clear labels, and keep “Skip intro” text only.

The driving HUD reserves space for advice, checkpoint messages and recovery/water notices. The mobile camera fits a stable CSS clearance box, so text wrapping, automatic tip compaction and dismissal cannot shift the scene or controls. Long messages scroll with touch or keyboard; new instructions start at the top, while unchanged text preserves reading position. Message duration remains 30–45 seconds.

## Trail markers

Planted timber and metal checkpoint posts, stitched numbered banners and named plaques replace floating labels and dotted gate lines. Orange marks the next stop; cream marks upcoming stops; passed markers retain their number and use a quiet teal treatment with a custom check. Both faces read correctly, camp entrance signs remain outside the tent clearing, and reduced motion stops cloth movement. The signs share the interface palette and are prepared in a single startup atlas with four retained groups. Visual shoulder spacing does not change route acceptance, physics or saved progress.

## Expedition routes

The game starts with two itineraries. **Mountain expedition** keeps the rocky fords, snow, volcano and suspension bridge, then returns to Sunset camp. **Coastal islands** follows ten beach checkpoints through three palm islands, exposed low-tide sandbars and a grounded salvage barge, finishing at Island sunset camp. Its crossings remain open while exploring; there is no tide countdown.

Coastal driving lanes are graded and compacted, with pre-existing paired tyre ruts and softer shoulders. The local natural-shore pass adds asymmetric, varying-width sandbars, gently wandering tyre lines and broad dune transitions; these final shoreline refinements are not published yet. Three bogged vehicles, irregular reef clusters, driftwood and tide-line vegetation add roadside detail. Low amber sunlight and cool shadows carry the islands into sunset.

Island scenery and bathymetry are prepared during loading. Rendered and physical ground share the same height field; water reads the same shallow shelves through a static bathymetry texture, independently of distant water mesh detail. Palms, rocks, driftwood and the barge feed the budgeted collision streamer. This remains a game simulation with raycast tyres and terrain deformation, not a calibrated vehicle or tidal model.

Existing saved Coastal shelf detours keep their original mainland itinerary. The persistence key and version-1 canyon migration are unchanged; new island saves use the separate `islands` route choice. Map bounds, progress, recovery checkpoints, shelter placement, fire and camp camera follow the selected itinerary. The owner is building the LC100 in Blender; the existing truck asset remains unchanged.

`npm test` includes a complete real-physics coastal drive in 4HI with the center differential unlocked, alongside the existing mountain drive in 4LO. The local `.review-dirt/` tools are isolated from player saves and excluded from publishing.

## Photos and vehicle tour

- `assets/gallery/` contains presentation edits and corresponding source photos, including camping images and unretouched mechanic photos. The current lightbox shows an image, title and caption; it has no original-versus-edited comparison toggle. Source photos remain the reference for condition; camping accessories in historical photos are excluded unless explicitly listed.
- Desktop uses `assets/video/orbit-scrub.mp4` for the continuous scroll orbit. Phones and coarse-pointer devices use 96 optimized 768 × 432 PNG frames in `assets/orbit/mobile/`, without fetching the video. `orbit-sequence.js` prioritizes the current frame and nearby frames, retains at most 24 decoded images, limits concurrent loads to three, and suspends loading outside the hero. The matching `assets/video/orbit-poster.jpg` remains the loading/error fallback. Reduced-motion users retain manual chapter/slider controls. Earlier primary views remain in `assets/orbit/` for the production storyboard. Orbit artwork is a visualization rather than condition photography.
- `assets/history/` contains the owner-history icons, illustrated Land Cruiser, regional map and geographic provenance. The dotted Maryland → Long Island → Leonia journey represents regional stops rather than an exact road route.
- `production/`, `video-prompts.json`, and `storyboard.html` retain production notes and prompts.

## Motion and layout

The ownership story scrolls through three chapters, with the map following the truck between regional stops. Desktop places the story on the left and the map on the right; small screens use a stacked layout. The vehicle orbit remains continuous. Text uses masked reveals, headlines use cream and orange, and numeric stats roll into view. Reduced-motion preferences and keyboard chapter controls are supported.

## Listing

Considering a sale; price $TBD, located in Leonia, NJ. If sold, condition will be disclosed and the truck sold as is. Maintenance and vehicle history are owner-reported; service receipts are unavailable. Owner update received October 12, 2026: the mechanic repaired the EVAP system, and the owner reports the check-engine light is off. The owner also repaired the rear weatherstrip and reports the rear leak has stopped. Specific EVAP parts replaced and emissions readiness/inspection status are unconfirmed. The prior clamp/line feature and its two displayed gallery photos have been retired, with source photos retained. Historical production notes and storyboards predate this update; current condition copy is maintained in index.html, app.js, rusty.js and the gallery captions. Publication status is recorded in PROJECT-HANDOFF.md in the parent workspace.

Contact: animagix@mac.com.

The buyer guide covers payment verification, identification, insurance, title and bill of sale, and legal transportation. The seller keeps the New Jersey plates.

## Publishing

GitHub Pages can publish the root of the main branch; `.nojekyll` preserves the static assets. Separate Sites hosting uses the project identified by `.openai/hosting.json`. No credentials are stored in this repository.
