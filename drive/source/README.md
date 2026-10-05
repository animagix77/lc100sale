# LC100 sunset drive — first playable

The standalone game is `../index.html`; the main site opens it in an iframe only when Start is selected. Closing the dialog unloads the frame and releases the game. No player data is transmitted or saved.

- Renderer: Three.js 0.186.1 WebGPURenderer, with automatic WebGL2 fallback.
- Vehicle: editable `lc100.blend`, exported as `../lc100.glb`. This is a stylized, proportion-based LC100 prototype, not a scanned or production-quality model. Named Body, Susp_*, Steer_*, Roll_* pivots support rigid steering, wheel rotation and suspension motion.
- Controls: WASD/arrows, Space brake, R reset, Escape pause; touch buttons; optional gentle cruise. Sound starts only after an explicit click. Tab/window blur pauses the drive.
- Terrain: deformable height field with bounded rut depth, persistent visual tyre stamps and speed-dependent soft-sand drag. State lasts for the current drive only.
- Sea: procedural waves, shoreline foam and glints. These are visual effects, not a fluid simulation.
- Play area: bounded beach with three discoveries. The virtual handling does not establish this vehicle's real-world capability.

Build the JS bundle: `npm ci` then `npm run build` from this directory. The runtime has no CDN dependency. `../drive.css` and `../index.html` are authored directly.

Regenerate the model: run Blender in background mode with `--python build_lc100.py`. It saves `/tmp/lc100-beach-rig.blend` and `/tmp/lc100-beach-rig.glb`; copy them over the two vehicle files above after inspection. The Python script is the model source recipe.

Three.js license is in `../THREE-LICENSE.txt`; compiled dependency notices are in `../drive.js.LEGAL.txt`.
