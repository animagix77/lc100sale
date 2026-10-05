# LC100 / Endless sunset drive

The main site opens `../index.html` on demand. Closing its dialog unloads the game. All runtime dependencies are local. No player data is sent or saved.

## Vehicle
`lc100.blend` is the editable Blender source, exported as `../lc100.glb`. `build_lc100.py` regenerates it using shaped body sections, a raked greenhouse, projected glazing, open wheel arches, five-spoke wheels, trim, lamps and badges. It is a stylized LC100 made against the owner's photographs, not a scan or dimensionally certified replica. Named Body, Susp_*, Steer_* and Roll_* pivots support the physics rig.

Run Blender in background mode with `--python build_lc100.py`. Output goes to `/tmp/lc100-beach-rig.blend` and `/tmp/lc100-beach-rig.glb`; inspect the front/rear renders in `/tmp` before replacing assets.

## Driving and terrain
Three.js WebGPURenderer uses WebGPU with WebGL2 fallback. Rapier supplies rigid-body gravity, chassis collisions, four raycast suspension units, damping, steering, tyre contact, braking and traction. Engine force goes to all four wheels; sand reduces grip and increases resistance. This is a physical driving model tuned for a relaxed experience, not validated LC100 engineering data or a full tyre/soil simulation.

Cruise targets ~8 mph; throttle eases near ~18 mph; reverse is slower. WASD/arrows drive, Space brakes, R recovers at the current stretch of coastline, Escape pauses. Touch buttons support multiple pointers. Sound is opt-in. Blur/hidden tabs pause automatically.

Dunes are deterministic in world coordinates and continue in both directions. Twenty-five near tiles use half-metre spacing with streamed terrain colliders; a lower-resolution outer mesh supplies distant ridges. A floating origin recentres coordinates during long drives. There are no map-end clamps. Water gradually adds resistance instead of an invisible boundary.

Tyre contacts compact a shared height field with shallow berms. Updated collision meshes match the visible deformations. Recent ruts persist as tiles recycle; storage is capped and the oldest distant tracks eventually disappear. The illustrated surf uses animated geometry and foam, not a fluid simulation.

## Build / verify
Run `npm ci`, `npm test`, then `npm run build` here. `../drive.css` and `../index.html` are authored directly.

The automated checks cover suspension settling, forward drive, steering, braking, rut depth, bounded tile count, and driving beyond the original map limit across a floating-origin recenter. Browser checks cover WebGPU rendering, desktop/mobile controls and clean iframe teardown.

Licenses: `../THREE-LICENSE.txt`, `../RAPIER-LICENSE.txt` and `../drive.js.LEGAL.txt`.
