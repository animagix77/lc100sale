# LC100 / Endless sunset drive

The main site opens `../index.html` on demand. Closing its dialog unloads the game. All runtime dependencies are local. No player data is sent or saved.

## Vehicle
`lc100.blend` is the editable Blender source, exported as `../lc100.glb`. `build_lc100.py` regenerates it using shaped body sections, a raked greenhouse, projected glazing, open wheel arches, wider mud-terrain tyres with staggered tread blocks, five-spoke wheels and 32 mm of extra wheel offset per side, trim, lamps and badges. It is a stylized LC100 made against the owner's photographs, not a scan or dimensionally certified replica. Named Body, Susp_*, Steer_* and Roll_* pivots support the physics rig.

Run Blender in background mode with `--python build_lc100.py`. Output goes to `/tmp/lc100-beach-rig.blend` and `/tmp/lc100-beach-rig.glb`; inspect the front/rear renders in `/tmp` before replacing assets.

## Driving and terrain
Three.js WebGPURenderer uses WebGPU with WebGL2 fallback. Rapier supplies rigid-body gravity, chassis collisions, four raycast suspension units, damping, steering, tyre contact, braking and traction. Engine force goes to all four wheels; sand reduces grip and increases resistance. This is a physical driving model tuned for a relaxed experience, not validated LC100 engineering data or a full tyre/soil simulation.

4HI cruise targets ~8 mph, with throttle easing near ~18 mph. 4LO targets ~3 mph, tops out near ~7 mph and delivers more low-speed torque. Stop before shifting with the range buttons or L key. Grip still limits climbing. Reverse is slower. WASD/arrows drive, Space brakes, R recovers at the current stretch of coastline, Escape pauses. Touch buttons support multiple pointers. Sound is opt-in. Blur/hidden tabs pause automatically.

Dunes are deterministic in world coordinates and continue in both directions. Twenty-five near tiles use half-metre spacing with streamed terrain colliders; a lower-resolution outer mesh supplies distant ridges. A floating origin recentres coordinates during long drives. There are no map-end clamps. Water gradually adds resistance instead of an invisible boundary.

Tyre angular speed is simulated independently of chassis speed. Excess slip throws bounded ballistic sand particles and excavates the shared height field, with shallow berms and deeper ruts in soft sand (up to roughly 0.66 m). Deep holes reduce grip and add soil resistance, so sustained throttle can bog the truck. Ease off, reverse, or use Recover. Deformation is integrated at the fixed physics step. Updated collision meshes match the visible deformations. Recent ruts persist as tiles recycle; storage is capped and the oldest distant tracks eventually disappear. The illustrated surf uses animated geometry and foam, not a fluid simulation.

## Build / verify
Run `npm ci`, `npm test`, then `npm run build` here. `../drive.css` and `../index.html` are authored directly.

The automated checks cover suspension settling, forward drive, steering, braking, range shifting, low-range climbing, stationary wheelspin, bogging, recovery, frame-rate-independent rut depth, bounded tile count, and a continuous coastal drive plus distant terrain probes across floating-origin recenters. Browser checks cover WebGPU rendering, desktop/mobile controls and clean iframe teardown.

Licenses: `../THREE-LICENSE.txt`, `../RAPIER-LICENSE.txt` and `../drive.js.LEGAL.txt`.

## Soundtrack
Music is a separate opt-in toggle from the engine/surf sound. “No Particular Hurry” is an original 75-second, 108 BPM instrumental, composed for this drive. The AAC file loads only after Music is pressed, loops, fades, pauses with the game, and releases its audio context when the iframe closes. `compose-soundtrack.py` preserves the NumPy composition source; `soundtrack-info.json` contains its details.
