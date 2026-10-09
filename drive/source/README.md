# LC100 / Endless sunset drive

Developer: Judge Dean LLC.

This is a cumulative development log. Later entries supersede earlier implementation descriptions. Current controls use WASD to drive, arrow keys to orbit, C to recenter, and an analog touch joystick with a separate e-brake. Default weather is Expedition; the full-throttle 4HI target is 50 mph. Older entries about touch buttons, local-clock defaults and a 25 mph target are historical.

The main site starts a silent autonomous preview when its beach section enters view. It pauses offscreen, unloads after leaving the surrounding area, and respects reduced motion. Taking the wheel unloads the preview and opens `../index.html` with full controls. Closing the dialog unloads the game and restores the inline preview when visible. Rendering and physics dependencies are bundled locally. There is no saved-game persistence. Optional nearby weather sends rounded coordinates to Open-Meteo; the main website's poll uses a separate vote service.

## Recovery board placement with gravel enabled — October 9, 2026

Recovery placement now ignores the gravel system's kinematic tire push shapes, dynamic debris and sensors while retaining terrain and fixed-rock support. Previously, the downward placement rays could hit the truck's own tire shapes, positioning boards roughly 77 cm above flat ground. The truck's suspension already excluded those shapes; recovery placement now follows the same exclusion.

`test-recovery-gravel.mjs` runs recovery with the actual `LoosePebbles` system enabled in desktop and mobile configurations. It verifies ground height, all four tire supports, no chassis jump, repeated deployment, driving clear/automatic packing, loose-debris/sensor rejection, fixed-rock support and world-origin shifts. The regression failed before the fix and passes afterward; seven related recovery, gravel and camera checks also pass. Vehicle assets are unchanged.

## Drag to look around — October 9, 2026

Drag the scenery horizontally to orbit the truck and vertically to raise/lower the camera. A six-pixel threshold keeps taps from moving the view. Releasing a drag holds that angle for five seconds, then smoothly returns to the chase camera; dragging again restarts the delay. Holding the camera finger prevents automatic return. Keyboard arrows retain their existing persistent orbit and C recenters. The intro, touch reference and accessible driving instructions describe the gesture.

`touch-camera.mjs` listens only on the driving canvas and captures one pointer, including a non-primary finger while the first is on the joystick. Driving, e-brake and HUD pointers remain independent. Pause, map opening, HUD menu opening, reset, blur, resizing and teardown release the gesture. Existing pitch limits and terrain clearance apply. The new gesture regression is registered in the suite; nine focused control/camera/intro/recovery checks pass. Vehicle assets and physics are unchanged.

## Volcanic embers and landing feedback — October 9, 2026

The volcanic pass now carries 144 desktop / 88 mobile ember slots and 22 / 14 taller, fuller smoke plumes. Small bright ember cores remain visible against lava. Ambient smoke thins near the camera and trail center to preserve the driving line. Actual falling-rock ground contacts create expanding ash puffs in fixed pools of 30 desktop / 16 mobile billboards; they drift and expire after roughly three seconds. Rock spawn counts, trajectories and physical colliders are unchanged.

Ground-impact events carry radius, velocity and distance. A separate generated bass-thud voice adds a gritty tail, with larger stones sounding heavier and distance darkening the sound. It respects Sound, pause and audio teardown. Large nearby landings also add a short, size- and distance-scaled camera jolt that fades without altering steering, physics or field of view. The camera's base pose is restored before following the truck or shifting the world origin. Pause/reset clear shake; reduced motion disables shake and falling rocks while retaining a smaller ambient effect budget.

The 69-entry regression suite passed, including the full 24-gate expedition. Hazard checks cover physical landings, ash expiry, bounded pools, world-origin shifts and disposal. Sound checks cover the new waveforms, routing and lifecycle; camera checks cover filtering, bounded displacement, decay, frame-rate independence and restoring the base pose. A local WebGPU review confirmed natural landings driving both ash and shake; a portrait viewport check is not a physical mobile-device performance test. Vehicle assets remain unchanged.

## Pebbles resting in sand — October 9, 2026

Beach and dune pebbles begin embedded and asleep, including on slopes. Actual contact with a moving tire or chassis releases them into Rapier motion. Ground contact then absorbs rolling and spinning energy until they embed at their displaced pose. Airborne stones continue falling before settling. This is a bounded game approximation of sand resistance.

Terrain collider replacement and floating-origin shifts cannot release an untouched stone. Embedded stones follow vertical changes in the sand beneath them without sliding downhill; streaming retains their displaced pose and whether they were still airborne. Other dirt surfaces retain the existing loose-gravel physics. `test-pebble-sand.mjs` covers inclined beach/dune rest, tire contact, ground changes, rebasing, revisits and airborne settling alongside the existing gravel checks.

## Pronounced sand ruts and removal of flying birds — October 9, 2026

Coastal beach tire contacts within 35 m of the shoreline (`shoreDistance < 35`) now form stronger, direction-aligned grooves with raised shoulders of displaced sand. Inland dunes retain their existing digging behavior. The rendered terrain and collision surface share the same deformation, so tires encounter the altered ground on later passes. Ordinary tested beach passes produce roughly 13–15 cm grooves and 3–5 cm berms; sustained slip can still deepen them. Compressed grain shading is quieter inside the tracks, helping the troughs and displaced edges remain legible against the surrounding sand.

All grass takeoff birds and offshore gull visuals are removed, including their meshes, flight updates and spawning pools. Fireflies, offshore haze and inland mist retain their existing habitats, motion and visibility behavior. The bird and gull counters remain zero for integration compatibility. Earlier bird descriptions below are historical and superseded by this entry. Vehicle model assets are unchanged.

## Loose dirt and gravel — October 9, 2026
`loose-pebbles.mjs` adds real Rapier convex rigid bodies with gravity, friction, angular motion, continuous collision detection and sleeping. Four kinematic rounded tire shapes follow the suspension, steering and wheel rotation; contact resolution pushes stones aside. The suspension continues to query terrain and larger obstacles, excluding these tire shapes and dynamic gravel so small stones do not destabilize the truck. The pool has 120 desktop / 72 mobile stones in three physical sizes, matching the rendered geometry. Spawning excludes the truck footprint, water, heavy mud, snow and volcanic surfaces. Terrain sampling is cached by cell and activations are bounded. Nearby stones retain their displaced positions; a bounded 1,024-entry world history preserves revisited stones until evicted. This is a local gravel simulation, not a particle simulation of every sand grain.

Terrain shading adds world-anchored soil aggregates, fine grain, roughness variation and small normal relief, with distance fades. Existing sand/snow/mud deformation still changes terrain height and colliders; the new surface detail follows those ruts. Meadow trails receive a little exposed-earth tint. No vehicle GLB changes.

`test-loose-pebbles.mjs` checks actual tire–stone contact manifolds, lateral displacement, rotation, settling, high-speed/reverse stability, self-collision exclusion, reset, origin shifts, retained displacement, allocation limits and disposal. The complete expedition test also runs with loose stones and tire contact shapes enabled.

## Dramatic atmosphere — October 9, 2026
Distance fog now starts closer and reaches full coverage at roughly 160 m in dry dusk, 184 m in clear daylight, and 76 m in fog. Wet weather blends visibility continuously. Ground mist is taller, denser and feathered, with clear space around the truck. The two depth-occluded headlight volumes extend 26 m with stronger scattering; their fixed 8/12 sample budgets remain unchanged. Mist and emissive glows avoid a second layer of material fog.

Fireflies retain their world-space habitats and fixed 32/64 pools, with brighter small cores, wider soft halos and longer visible pulses. Daylight, weather, camera clearance, terrain occlusion and reduced-motion behavior remain active. Historical bird behavior, superseded by the removal above: grass encounters allowed exactly one modeled bird at a time, with a roughly metre-wide flapping silhouette, rising/banking takeoff and a 4.3–5 second flight. Ground contact, travel distance, weather and patch cooldowns gate takeoff; parking and wheelspin do not launch birds. Vehicle model assets are unchanged.

## Portrait HUD
On phones in portrait, `portrait-hud.css` replaces the large navigation card with a 108px translucent circular overview of the entire expedition. The route fits inside the circular boundary, and off-route player markers keep their bearing at the rim. Tap it for the existing detailed numbered map. A single destination/distance display replaces the repeated route card; secondary toolbar actions live under Menu. Range, center lock and boards share one row above the 136px joystick and 88px e-brake. Desktop and landscape keep the local map. `hud-menu.mjs` closes on selection, outside tap, Escape, pause and orientation change; opening it releases held inputs and cruise. The HUD preview in the sibling model-review folder is a local layout fixture, not a game build or model revision.

## Vehicle
`lc100.blend` is the editable adapted Meshy LC100, exported as `../lc100.glb`. The owner-supplied Coastal Cruiser body is reduced to 60,000 triangles, with its baked-in wheels and running boards removed. Independent wide mud-terrain wheels share geometry and retain Body, Susp_*, Steer_* and Roll_* pivots. The 2.85 m wheelbase matches the physics rig; wheels retain 32 mm extra spacer offset per side. The full truck has 93,700 triangles and a 4.73 MB GLB. The original asset is untouched.

Regenerate using Blender: `blender -b --python adapt_meshy.py -- /path/to/Meshy_AI_Coastal_Cruiser_1005181224_texture.glb lc100.blend /tmp/lc100-meshy-adapted`. The existing blend supplies the independent wheel rig. The owner-supplied source GLB is separate from the site repository. Review front/rear/side renders before replacing assets. `build_lc100.py` retains the earlier procedural model generator.

The body uses its original 2K albedo, with the previous enamel paint response (metallic 0.3, roughness 0.38) and the noisy normal/specular maps disconnected. Geometry batching preserves texture UVs. This is a stylized adaptation, not a scan or dimensionally certified replica.

## Driving and terrain
Three.js WebGPURenderer uses WebGPU with WebGL2 fallback. Rapier supplies rigid-body gravity, chassis collisions, four raycast suspension units, damping, steering, tyre contact, braking and traction. Engine force goes to all four wheels; sand reduces grip and increases resistance. This is a physical driving model tuned for a relaxed experience, not validated LC100 engineering data or a full tyre/soil simulation.

4HI cruise targets ~8 mph, with a 50 mph full-throttle target on firm level ground. 4LO targets ~3 mph, tops out near ~7 mph and delivers more low-speed torque. Release the accelerator and turn off cruise to shift with the range buttons or L key; coasting is allowed. Grip still limits climbing. Reverse is slower. Hold W to accelerate, S to brake and reverse, and A/D to steer. Arrow keys orbit the camera: left/right look around the truck, up/down raise or lower the view; C returns to the chase view. Driving keys also work from focused HUD buttons; text entry, browser shortcuts and Space activation of buttons remain available. Space brakes, R places recovery boards ahead of all four tyres while stopped, Escape pauses. Touch uses a circular analog joystick at bottom-left: up for proportional throttle, down to brake/reverse, sideways to steer. A radial dead zone prevents accidental inputs; releasing the stick coasts. The independent bottom-right hold e-brake cuts drive and brakes the rear wheels. Both controls support simultaneous pointers and reset on release, cancellation, resize, pause, blur and map opening. Sound defaults on and starts on the first in-game pointer or keyboard interaction. Blur/hidden tabs pause automatically.

Stronger dune crests and crosswise swales produce hills and dips along the driving strip, fading out toward the waterline. Sand uses a darker amber palette with shaded dune faces. Dunes are deterministic in world coordinates and continue in both directions. Twenty-five near tiles use half-metre spacing with streamed terrain colliders; a lower-resolution outer mesh supplies distant ridges. A floating origin recentres coordinates during long drives. There are no map-end clamps. Water gradually adds resistance instead of an invisible boundary.

Tyre angular speed is simulated independently of chassis speed. Excess slip throws bounded ballistic sand particles and excavates the shared height field, with raised berms and deeper ruts in soft sand (up to roughly 0.88 m). Deep holes reduce grip and add soil resistance, so sustained throttle can bog the truck. Ease off, reverse, or stop and deploy the recovery boards. Deformation is integrated at the fixed physics step. Updated collision meshes match the visible deformations. Compressed troughs darken as they deepen; displaced edges catch more light. Cached base heights and colors keep rut updates inexpensive. Recent ruts persist as tiles recycle; storage is capped and the oldest distant tracks eventually disappear. The ocean uses GPU-displaced swells, fine procedural surface normals, shallow-to-deep color, view-dependent sky and sun reflection, broken crest foam and a translucent shore wash. Reflection is an analytic sunset approximation, not a full scene reflection or fluid simulation. Wave phase stays fixed in world coordinates through streaming/rebasing. Wave uniforms update each frame; the ocean reuses its position buffer as the coastal window moves. Mobile uses a smaller ocean mesh.

## Build / verify
Run `npm ci`, `npm test`, then `npm run build` here. `../drive.css` and `../index.html` are authored directly.

The automated checks cover suspension settling, forward drive, steering, braking, range shifting, low-range climbing, stationary wheelspin, bogging, recovery, frame-rate-independent rut depth, rut shading and collision continuity across tile boundaries, ocean streaming and rebase continuity, bounded tile count, and a continuous coastal drive plus distant terrain probes across floating-origin recenters. Browser checks cover WebGPU rendering, desktop/mobile controls and clean iframe teardown.

Licenses: `../THREE-LICENSE.txt`, `../RAPIER-LICENSE.txt` and `../drive.js.LEGAL.txt`.

## Soundtrack
Music is a separate opt-in toggle from the engine/surf sound. “No Particular Hurry” is an original 3:37, 108 BPM instrumental with an intro, two builds, melodic variations, breakdowns and an outro, composed for this drive. The AAC file loads only after Music is pressed, loops, fades, pauses with the game, and releases its audio context when the iframe closes. `compose-soundtrack.py` preserves the NumPy composition source; `soundtrack-info.json` contains its details.

## Tire surface effects
Ordinary rolling on dry sand emits grains and a soft billboard dust trail; wheelspin increases the spray even when the truck is stationary. Physics contact marks carry wheel identity, so splash direction follows the left/right tire and forward/reverse travel. Shallow-water contact is compared with a CPU sample of the same displaced ocean surface. Wet tires create displaced water and a short, broken foam wake, plus small translucent ballistic droplets thrown backward from the trailing tread edge of each tire in a narrow fan, with no dry dust. Wakes follow the wave height. Fixed particle pools have smaller mobile budgets, expire naturally, retain world coordinates across floating-origin shifts, clear on Reset truck, and release GPU resources on exit. `test-surface-effects.mjs` verifies idle suppression, ordinary driving, wheelspin, wet/dry separation, reverse spray, pool bounds, expiry and cleanup.

## Suspension and recovery boards
The suspension has 0.46 m rest length, 0.30 m travel and softer compression/rebound tuning. The chassis sits about 7 cm higher than the preceding tune. Each visible wheel follows its own physical suspension length; chassis pitch and roll arise from terrain contact and inertia. Ordinary rolling compacts roughly 0.06–0.22 m tracks; sustained wheelspin can still dig to about 0.88 m. Burial resistance is reduced and reverse retains 95% of the selected range’s torque, allowing a deliberate backward escape.

`traction-board.blend` and `model-boards.py` preserve the original Blender prop. It uses MAXTRAX MKII dimensions (1.15 × 0.33 m) and orange cleats/handles as a visual reference, without a copied logo: https://maxtraxus.com/products/maxtrax-mkii-signature-orange . Regenerate with `blender -b --python model-boards.py -- /tmp/board-export`, then copy its GLB to `../traction-board.glb`. Two boards are mounted on the roof rack.

Press R or Boards while stopped and upright: a brief deployment places four boards below/in front of the four tyres, one per wheel. The two visible roof-mounted boards stay unchanged when stowed; the extra pair splits from those mounts during deployment and merges back during stowing. Static collision surfaces support the wheels, and grip improves only inside each board’s footprint at its height. Terrain stamping is suppressed only on the boards. Ease forward in 4LO; once the truck moves 5 m clear, the supports are removed and the boards animate back onto the roof. The camera briefly frames recovery from the side (except with reduced motion). Pause → Reset truck is still available for rollovers. The boards and camera are game conveniences, not real-world recovery instruction. `test-recovery.mjs` covers actual deformed-rut reverse escape, board-assisted escape without teleporting, local grip bounds, deployment guards, automatic pickup, floating-origin stability, reset cleanup, and ordinary soft-sand travel.

## Beach life
`beach-life.mjs` builds original lightweight fishing boats, forked driftwood, tide-line wrack/pebbles and dune-grass clumps with native geometry. Five offshore boats recycle by coastline sector, with wheelhouses, masts, outriggers, working decks and buoy details. They bob against the same CPU ocean-height sample used by tire splashes. Their world positions remain stable through floating-origin changes.

Grass grows in deterministic patches on the dune shoulders. Instanced blade geometry bends on the GPU using original blade height (not terrain elevation), so roots stay anchored. Wind phases remain tied to the plants; reduced motion freezes the wind. Driftwood and weathered rocks have fixed collision surfaces; grass and loose wrack remain decorative, with the main 16–29 m inland driving strip left clear. World-cell placement remains stable as scenery streams, and object/instance budgets are bounded. Mobile uses fewer grass instances.

Dust is now emitted on alternate rear-wheel marks, at lower opacity, smaller size and shorter lifetime. Ballistic grains are smaller and fewer during rolling; wheelspin still increases spray. Water splashes and wakes retain their prior tuning. `test-beach-life.mjs` covers plant/debris placement, clear driving strip, boat flotation, reduced motion, world anchoring through rebasing, bounded long-distance streaming and disposal. The surface-effects tests also enforce the reduced dust cadence/size/lifetime.

## Waypoint route
The former proximity-counted beach-stop flags are replaced by a sequential, endless route. Numbered 14 m-wide gates follow the coastal strip, with the first at 55 m and subsequent gates spaced 90 m along the beach. The next gate is orange, upcoming gates are muted, and the previous gate displays a check. The HUD shows the next number, distance and heading-relative arrow; the mini-map shows the route and an edge marker for an off-map target.

A grounded crossing between the flag posts completes a waypoint, in either direction. Merely driving near it, flying above it, resetting or teleporting cannot collect it. Missing a gate leaves it active so the driver can return. Reset truck preserves route progress but clears the crossing history. There are no timers, failure screens or penalties for exploring. The route stores only an integer progress count and four nearby gates. `test-waypoints.mjs` checks ordering, misses, reverse crossings, airborne and teleport guards, direction guidance and bounded state through 2,000 gates.

## Coastal physics pass
Driftwood and weathered rocks have fixed Rapier colliders generated from the same geometry and transforms as their visual instances. Grass and loose seaweed are non-solid. Solid wheel contacts do not dig sand or emit sand particles. Collider streaming follows scenery cells and floating-origin shifts. The shoreline has darker damp sand, lower roughness and a fresh-wash tint synchronized to the ocean phase. Low-poly layered cloud banks follow the distant sky with slow drift (static for reduced motion).

## Coastal audio
Sound defaults on, unlocks on the first in-game interaction, and is independently switchable from music. Muting remains in effect for the rest of the session until explicitly re-enabled. No effects download occurs before interaction. A synthesized harmonic V8 drone follows wheel speed, HI/LO and throttle. It replaces the puttering recorded idle/load loops entirely, using four phase-aligned partials with smooth pitch and gain and no periodic amplitude modulation. This is a stylized sound, not an authenticated 2UZ-FE recording. Ocean ambience changes with distance to the shoreline; real sand foley is granulated into a continuous tyre texture driven by motion and slip, with tire-contact-gated splash accents that grow louder and more frequent with vehicle speed and occasional stereo gull calls. Music ducks gently under engine load when both toggles are on. Preview stays silent; pause mutes effects and pauses music; iframe disposal aborts loading and closes both audio contexts. Sources, references and processing notes: `../audio/CREDITS.md`.


## Sand relief and geometric wakes
The driving strip combines broad swales with irregular 2–7 m hummocks and diagonal ribs, fading toward the wet foreshore. The same height field builds rendered sand and Rapier colliders. Spring/damper tuning allows more heave and independent wheel travel; there is no looping cosmetic bob. Camera aim follows vertical movement gently instead of cancelling every bump.

A bounded shallow-wave field receives wet tyre contact impulses, displacing the actual ocean vertices and supplying matching slopes and foam. It propagates ripples, damps them after passage, shifts its window without dragging old wakes, and clears on vehicle reset. Shoreline geometry uses 0.5 m desktop / 0.75 m mobile spacing along the coast; more distant water stays coarse. A half-float texture carries signed height, slopes and foam. Water effects sample the same wake height. This is a stylized height-field approximation, not a full fluid solver.

References: [Isuzu sand-driving guide](https://www.isuzuute.com.au/events/4x4-tips/sand-driving), [AllOffRoad corrugations observations](https://alloffroad.com.au/blog/news/corrugations-speed-suspension-smooth-zone/), and [NVIDIA GPU Gems: geometric water displacement](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models).


## Impact and wake refinement
Progressive bump stops apply additional support at the wheel contact point during deep compression, transferring obstacle load into chassis heave, pitch and roll. 4HI uses a road-speed governor with drag compensation targeting 25 mph; 4LO and the 8 mph cruise setting remain unchanged. Dry sand foley is reduced roughly 77% and band-limited to reduce the shuffling character. Water contacts form directional raised bows and trailing troughs in the height field; the mobile shoreline mesh is denser so those crests survive vertex sampling.

Water spray uses bounded, short-lived 3D droplets: speed increases count, outward reach and height; droplets fall under gravity and disappear on hitting the water. Sand particles remain on dry ground. Water motion comes from the geometric bow/trough field and surface foam.

## LC FM radio
The Radio button opens a compact factory-head-unit-style panel. Power raises a three-stage chrome antenna on the right front fender. While parked, a roughly three-second front-quarter camera beat shows the mast extending, then automatically returns to the chase camera. The truck brakes during this stationary shot; any driving input cancels it immediately. Moving vehicles, recovery and reduced motion keep the normal camera. Radio off retracts the mast. Antenna geometry is parented directly to the truck root so chassis material batching preserves the moving stages.

Eight presets: the original No Particular Hurry on Sunset, plus seven owner-supplied four-minute station tracks (jazz, hip-hop, EDM, ’80s rock, ’90s rock, country and K-pop) added October 8, 2026. `stations.mjs` maps them to unchanged 192 kbps stereo MP3s in `audio/radio/`; `radio-library.json` records source filenames, hashes and loudness. Per-station playback gains bring the music toward −13 LUFS without re-encoding it. The preset names remain the LC FM station branding; source MP3s have no song-title or artist tags. The older synthesized `.m4a` arrangements, `compose-radio.py` and `radio-tracks.json` are retained as historical source material.

Only the selected track loads after power-on; switching stations preserves the tuning warble and fades. Music pauses with the game and releases media/context on exit. Engine ducking and volume remain independent of the Sound effects toggle. Failed playback leaves a retryable power state.

`model-antenna.py` imports the existing production GLB, adds the named mast rig and writes a new editable `lc100-radio.blend` and GLB. The existing `lc100.blend` remains intact. Reference: Toyota's [2005 Land Cruiser owner's manual, radio antenna](https://s3.amazonaws.com/otpc/manuals/2005-land-cruiser-manual.pdf). This is a stylized power-antenna gag, not a reproduction of factory radio controls.

## Center differential lock
K / CENTER LOCK switches a separate center lock in either transfer range, when forward/reverse accelerator input and cruise are released, regardless of gravity-driven speed or residual wheelspin. Default is unlocked; reset retains the selected range and lock. The amber pressed state indicates engagement. No front/rear axle lockers are represented.

The engine governor uses mean shaft speed and supplies equal drive torque to the open axle outputs. A bounded implicit center reaction couples front/rear *average* wheel angular speeds, transferring torque to the axle with grip while conserving input torque. Left/right wheels remain independent. Contact road speeds include rigid-body angular motion and front steering; the lock creates tire scrub as axle paths differ in a turn. Grip, engine power and rut strength do not get an artificial boost. Bounded brake-based wheelspin assistance keeps unloaded wheels from consuming the entire engine speed budget; it adds no ground force or grip. This is a game drivetrain approximation, not a reproduction of factory A-TRAC or a full transmission simulation. Deep-rut recovery tests now explicitly engage the center lock; ordinary unlocked soft-sand travel is still tested.

`test-differential.mjs` covers asymmetric traction, open-vs-locked progress, axle speed coupling, left/right differentiation, reverse, zero-grip limits, torque conservation, turn scrub and engagement guards. Existing range, terrain, obstacles and recovery tests remain part of the regression suite.

## Radio tuning
Station changes roll fixed-width frequency digits in tuning direction over 760 ms. Reduced motion settles the digits immediately. While powered, a synthesized bandpass-static sweep with soft distortion and a quiet whistle bridges the faded tracks; the new music fades in after the tuning beat and successful playback. Only one sweep plays at a time. Off-state preset selection remains silent and lazy. Volume, pause, failure, power-off and disposal cancel the sweep. Engine ducking cannot override the retuning fade. `test-radio-tuning.mjs` and `test-radio.mjs` cover these transitions and cleanup.

## Uphill sand wheelspin
Under manual forward throttle, loose sand on an incline has more tire shear as forward progress falls. Spin assistance allows additional slip, and the shaft governor leaves a small low-speed wheelspin margin. Actual wheel angular dynamics still drive the visible tires, engine RPM, sand particles and digging; this is not a cosmetic minimum rotation. The change fades with speed and does not raise the 25 mph road limit. Firm surfaces, cruise, reverse and normal flat-sand tuning retain their previous behavior. `test-climb-spin.mjs` checks sustained loaded spin, release/braking, grip limits, uphill contact marks and both range/center-lock settings.

Shift buttons read current keyboard/touch/cruise input directly, avoiding a stale physics-frame lockout just after pedal release. These are game controls, not real-vehicle shift instructions. Four-board recovery requires all four tires grounded; all four local colliders rebase, stow and clear together.

Station retunes use an uneven heterodyne carrier with 8–29 Hz pitch modulation, swept resonant static and soft distortion. A single short voice follows the frequency reel timing; rapid retunes replace it and power/pause/volume controls silence it.

Country (101.9, “All Hat, All Terrain”) and K-pop (96.7, “Bias Wrecker”) now use the four-minute owner-supplied MP3s. The historical synthesized versions can still be rendered with `compose-radio.py --tracks country kpop --output-dir <directory>`. Eight preset buttons use a four-column grid.

## Local clock and centered recovery boards
The full drive starts with lighting based on the visitor's device clock, using an approximate 6 am / 6 pm daylight cycle until a location is available. The Weather panel can hold the original sunset instead. Sky, directional and ambient light, sun/moon, cloud tint, fog and water reflections transition together, with readable night lighting. The silent landing-page preview retains sunset. “Use my weather” requests browser geolocation only after an explicit click. Coordinates are rounded to 0.1 degrees before a credential-free request to Open-Meteo; no location is stored beyond the session. Current conditions refresh every 15 minutes while visible, with stale-response validation, timeout, denial/offline fallback, cancellation and disposal. Clear/cloudy/fog/rain/snow/storm conditions adjust the stylized environment, with bounded precipitation and wind-driven swell. Once location is granted, solar elevation is calculated from date and approximate coordinates. Weather attribution and the data-sharing explanation appear beside the opt-in button. Reduced motion suppresses precipitation.

The two stowed recovery boards and their straps are centered at z=0.92 m between the roof rack crossbars. Four-board deployment and return still use those same mounts.

The full game opens with a native modal driver briefing while assets load. Start is enabled only once the beach is ready; physics input and audio stay gated until the explicit Start click. Native focus containment, an initial heading focus, a scrollable mobile layout and an exit link keep the briefing usable. The silent embedded preview skips it.

Vehicle lighting: `vehicle-lights.mjs` adds emission to the existing textured lamp lenses. Automatic lamps turn on below 12° solar altitude and off above 16° to prevent flicker. Two warm spotlights illuminate the path; desktop uses one 512px shadow map. Rear running lamps, high-mounted brake light, brake glow, and white reverse illumination follow the actual physics braking/reverse state, including keyboard, touch, cruise braking, and recovery braking. Sunset previews also show the lamps.

Historical coastal atmosphere setup (bird visuals superseded by the removal above): shared weather-driven gusts animate grass. Ambient sand streaks are removed; nearby spray comes from tyre contact. Two gulls on mobile and three on desktop glide slowly offshore, with proximity scaling preventing close camera fly-bys; gulls disappear at night or in heavy precipitation. Five feathered offshore haze banks add distance. Reduced-motion mode hides gulls and freezes foliage; mobile uses smaller pools. Headlights also scatter through short ray-marched cones (12 samples desktop / 8 mobile), with faint clear-air density and stronger fog/wet-weather density. These local volumes use depth testing and do not simulate full atmospheric multiple scattering.

Preloader: asset byte counts drive the download portion, while Three.js compileAsync progress callbacks advance the majority of the CTA fill (40–95%). Stage captions and completed scene-piece counts replace an apparent overall time percentage. Indeterminate setup/first-frame states show an activity sweep. Start unlocks after the first render has been submitted and the browser has had a paint opportunity; no artificial minimum load duration or timer-driven completion.


## Mountain ascent expedition
The default expedition follows 24 gates over a 2.14 km loop: coast, dunes, meadow, wooded rocky ford, muddy switchbacks, deep snow, a 116 m volcanic overlook, and a descent through another river crossing back to the beach. `expedition.mjs` defines the route, spatial weather and volcano dimensions. Mountain ridges are continuous with a broad cut trail; the marked muddy line compacts more firmly while off-trail ground can bog the truck. The chase camera opens its field of view and looks farther ahead at altitude.

Riverbanks have stationary instanced broadleaf crowns, physical trunks, low undergrowth along the driving line, and taller grass outside it. `volcano-view.mjs` adds a crater lake, four animated emissive lava streams draped on remote flanks, a faceted plume and bounded ballistic ejecta. The crater effects remain remote. A separate route-side lava crossing and nearby falling-rock system now bring the upper trail into the volcanic scene (see below). There is no damage/health system. Desktop/mobile pools are fixed, reduced motion freezes the eruption and foliage, and all world effects survive floating-origin shifts.

`test-expedition-drive.mjs` drives all 24 gates with real deforming terrain and scenery colliders in 4LO with center lock, including both fords and the descent, without resetting. `test-volcano.mjs` checks eruption separation, crater containment, geometry budgets, origin shifts and woodland clearance. The separate rut test uses untracked coastal dunes outside the expedition trail.


## Expedition detail pass
Mountain ground has world-anchored grain, broad color variation and restrained volcanic strata, with near-camera normal relief fading out at distance. `mountain-details.mjs` streams bounded fractured boulders and scree; boulders use their rendered geometry for collisions and stay outside the marked driving line. Desktop/mobile instance limits and cell caching keep the scene bounded through origin shifts.

Riverbank trees use stationary layered angular crowns and visible branches; wind-bent fern fronds replace the former shrub blobs. Lava has moving hot seams, cooling crust, darker flow edges and a gently displaced crater lake, bordered by jagged basalt. Irregular ash billows expand above it while ejecta brightens on ascent and cools on descent. Reduced motion freezes the time-driven effects; mobile uses lighter geometry and smaller pools.

Validation covers all 24 gates with mountain colliders, rock placement and collision alignment, fixed geometry budgets, scenery wind/reduced motion, rut behavior, origin shifts and disposal.


## Driving frame pacing and loose-surface wheelspin
Terrain generation now yields row-sized work under a per-frame budget. A prefetched ring keeps the same 0.5m near-ground detail, while the 4m far mesh remains visible until its replacement is ready. Origin changes translate existing meshes and colliders; they no longer regenerate the terrain. Terrain caches and pending jobs are bounded and disposed on exit. Scenery uses staged generation and an atomic swap, and grass recovery updates nearby buckets plus a rolling background sweep. Ocean geometry keeps the same buffers and topology between coastline cells.

Obstacle shapes are retained between cells and activated within a guaranteed 55m radius plus their full extent, refreshing on an 8m grid. The render geometry still supplies exact collisions. This reduces new shape construction while keeping all reachable objects solid before approach.

Manual throttle now allows compliant slip on loose or low-grip wet contacts on level ground as well as climbs, in forward and reverse. Submerged rocks and wet shore contacts reduce available grip; dry rock and recovery boards keep firm traction. Wheel angle, engine RPM, contact marks and particles use the resulting physical angular velocity. Lifting/braking removes the powered slip, and road-speed limits are unchanged.

Focused measurements on the development machine reduced terrain boundary CPU work from roughly 580–693ms to about 3.4ms at the 95th percentile, and river obstacle refresh from 19–21ms to 2–3ms. These are local CPU measurements, not an iPad performance guarantee. The full regression suite covers streaming transitions, rebase with in-flight jobs, nearby obstacle activation, the full 24-gate route, and loose/wet tyre response.

## River waterline and contact
The riverbed, mean shoreline, upstream spring, and mouth share one channel profile. Both banks reach mean water level at the visible edge and rise beyond it; the bed continues between the route crossings and the sea. Shallow ripples and tyre wakes lose height as depth approaches zero. Wake troughs are bounded above the bed, and the water shader uses the displaced geometry for reflection normals. Clear shallows expose the rock bed.

Physics, tire foam, spray, and wet traction sample the same animated surface as the renderer, including the live wake field. Exposed rocks keep dry contact; dry depressions receive no phantom buoyancy. Chassis water drag and buoyancy are bounded. This remains a shallow-water game approximation, without a full fluid or hydraulic flow solver. `test-river-channel`, `test-water-contact`, and `test-river` check matching banks, river-mouth continuity, dry boundaries, immersion, geometry budgets, and crossing physics; the full expedition traversal still covers all 24 gates.

## Driving controls and trail map
Touch controls use larger thumb targets: 104 × 112 px on tablets, responsive 60–88 px widths and 86–104 px heights on narrow phones, and 76 × 86 px in short landscape layouts. Gas has a distinct warm background; held controls share clear pressed feedback. Coarse input is detected with any-pointer so hybrid touch devices retain the controls.

The retained 12 Hz map follows the nearby trail, shows actual vehicle heading, north, a distance scale, and a numbered target with offscreen direction. The footer shows the next stop and distance. Expanding the map pauses and clears driving inputs, then presents the complete 24-gate route, region labels and current-lap progress. Escape or Close returns to driving unless the game was already paused or the page lost visibility/focus. Very wide overview layouts rotate the route, north indicator and vehicle heading together to use landscape space; the nearby map stays north-up. Canvas backing stores resize only when CSS size or pixel density changes. The map is hidden in the embedded autonomous preview.

River approaches use a shared route mask for brown alluvial mud, embedded physical gravel, and vegetation clearance. The bare corridor continues onto both dry banks at both fords; adjacent woodland stays green. The bed elevation and waterline are unchanged. `test-river-approach.mjs` checks both approaches, terrain colors, actual plant footprints, stone placement, mobile budgets, and rebasing.

## Grass, wildlife and the lava crossing

Grass compression follows a wider 4.1 m feathered footprint with a nearly flattened center. Pressed grass holds for 65 seconds and then recovers gradually. Reverse lay survives stopping; track storage remains capped at 10,000 cells, with nearby updates and a bounded background sweep.

Historical wildlife setup (bird visuals superseded by the removal above): `meadow-wildlife.mjs` flushed small 2–4 bird flocks when grounded movement disturbs actual grass. World-patch cooldowns prevent repeated flocks while circling. Sparse fireflies blink near grass and wooded riverbanks at dusk/night, with no glows on water, snow, beach or volcanic terrain. Mobile pools are smaller; reduced motion suppresses bird flights and holds fireflies steady. Both use pooled instancing and stable world coordinates.

`lava-crossing.mjs` shares a recessed molten channel footprint with the terrain. Between the black-rock ridge and overlook, a solid basalt causeway carries the marked route over the lava. `lava-crossing-view.mjs` gives the channel moving incandescent seams, dark banks and embedded crawl stones. Their rendered triangles are the tyre/chassis collision surfaces, using the existing bounded obstacle cache. The main line remains traversable in 4LO.

`volcano-hazards.mjs` pools nearby falling hot rocks in Rapier: they hit/bounce, settle into physical wheel obstacles, cool and retire. A small fixed pool of embers and feathered low smoke stays confined to the volcanic route. Impact sounds attenuate with distance. No per-frame collider allocation; disabled pooled rocks cost no active simulation away from the volcano. Reset, rebasing and disposal handle every pool. The loader precompiles these effect materials so entering a new biome does not first compile them during driving.

Tests cover habitat restrictions, dusk/day transitions, disturbance/cooldown guards, fixed budgets, grass retention, rebase alignment, physical rock impacts, lava-bank/causeway geometry and the full expedition route.


### Dramatic expedition pass

Small scenery uses depth-writing hashed distance fades. Trees keep a solid near pass and a shared-buffer transparent far pass for clean silhouettes in the haze. New small scenery entries dissolve in over 0.8 seconds; retained world instances preserve their visibility across buffer reorder and origin shifts. Dense grass refreshes on 32 m cells with 76 m coverage and fades out by 48 m, before its boundary. Woodland prioritizes nearby stable seeds. Bounded placement caches reuse static terrain samples; in-flight batches finish across nearby cell crossings so scenery can keep up at 50 mph. Live tire deformation and grass flattening stay uncached.

Historical atmosphere setup (bird visuals removed and fog revised by the October 9 entries above): expedition meadow and river regions default to warm dusk with cool sky fill, visible canopy-height fireflies, short flushed-bird flights and bounded ground mist. Local-time/weather choices remain available. Clear-weather fog reaches about 240 m and precipitation closes visibility smoothly toward 120 m. Wet mud throws dark clods; snow throws fragments and restrained powder using fixed pools and per-wheel emission limits.

The e-brake locks the rear tread, cuts propulsion and reduces rear lateral grip at speed. Steering while holding it produces a real sideways slide and yaw in the rigid-body simulation; releasing restores grip progressively. It is a game handling model, not a calibration of the real LC100.


### Fast river crossings and weather audio

Water effects sample the current physical wheel contact, independently of terrain tire marks. Submerged rocks still produce water effects; exposed rocks, wheels above water, and a film of 2.5 cm or less do not. Four reused contact records share depth and wet fraction with the audio mix. Effects use a consistent surface snapshot before wake impulses are applied.

The existing bounded wake grid now scales through 50 mph, with wider bow shoulders, deeper trailing troughs, and crests approaching one metre in the middle of the ford. CPU and river shader share crest and depth limits; wakes taper to zero at the bank and troughs cannot cross the bed. Per-wheel timing prevents repeated physics marks from multiplying wake energy. Curved, pooled water sheets and trailing droplets grow with speed and immersion; crawling and shallow puddles remain restrained. Mobile effects use fewer than 800 particles across all fixed pools.

Water audio combines a continuous wave wash and stereo spray with a stronger entry transient. Speed remains audible through 50 mph, and immersion changes volume. Stereo rain builds and fades with live rain intensity. Pause/mute and gesture unlock remain shared with the existing sound controls; no additional downloaded audio assets are needed.


### Driving through precipitation

Rain and snow now keep persistent world motion inside camera-centered, world-aligned volumes. Actual camera translation produces passing precipitation in forward/reverse travel and orbit parallax. Rain streaks use smoothed relative velocity and a bounded exposure; snow tumbles with incremental wind flutter. Near-lens fades prevent oversized streaks/flakes. Camera reset/cuts and floating-origin rebases explicitly preserve stable motion. The existing fixed mobile/desktop pools and reduced-motion behavior are retained.


### Rollover recovery

A body up-axis below 0.2 for 1.65 uninterrupted simulation seconds triggers an automatic return to the last reached waypoint. Short tips and ordinary banks do not qualify; pause time does not count. Respawning preserves waypoint/lap progress, faces the next unvisited stop, clears momentum and current input, and briefly brakes while suspension settles. Current terrain height across the wheel footprint provides clearance. Manual reset shares the checkpoint behavior. Camera, precipitation motion, recovery boards, wake, and rollover history are reset together.


### Ocean wake continuity

The ocean keeps its fixed vertex budget, but its detailed patch now follows the truck offshore. Integer fine-grid shifts preserve the local water triangles through streaming and origin rebases. This fixes the case where a simulated 69 cm crest moved the coarse visible offshore mesh by less than 1 mm. Raised bows and depressed trailing troughs now reach actual geometry near the tyres. Water contact also uses a current-pose geometric tyre intersection when suspension loses seabed contact, preserving wake/spray while bobbing through water; tyres above the surface remain dry, and grounded rock contact retains priority.

## Contextual unstuck recovery
`unstuck.mjs` offers a checkpoint reset after 4.5 seconds of attempted forward/reverse driving with under one metre of progress and low horizontal/vertical speed. It includes high-centred chassis contacts without requiring tyre contact. Parked trucks, braking, airborne motion, board placement and antenna cutaways do not accumulate stalled effort. The offer persists after releasing controls, hides on pause, clears after genuine escape, and can be snoozed for 12 seconds. Recovery reuses the rollover checkpoint reset, clearing held controls, momentum, boards and wakes while preserving waypoint progress.

## Roadside stories
Four original low-poly roadside vignettes accompany the ascent: a buried pickup, open-hood/open-door SUV with radiator steam and two posed passengers, a tipped short-wheelbase 4x4, and a snow-buried SUV. Vehicles and characters are modeled in `roadside-models.mjs`, with merged vertex-colored geometry (under 15,000 total triangles). The static poses, maximum 8/12 steam puffs, distance fading and preload compilation keep work bounded. Clearings exclude intersecting tall grass, trees and large stones. Props are decorative, outside the route corridor, and add no collision traps. World-space placement survives origin shifts; each scene has one proximity-triggered Rusty joke per session. Reduced motion freezes the steam.

## Reliable ground, ocean recovery and wet weather
Terrain streams the nearest tiles first with cached height samples, a bounded resident set, and matching temporary collision coverage when visual work falls behind. The coverage regression follows the full route at 50 mph / 20 FPS and exercises fully starved rendering in both grass corridors, rut updates and origin shifts.

Sustained deep immersion offshore returns the truck to nearby dry beach, avoiding the river mouth and preserving waypoint progress. Surf, shallow crossings and jumps do not trigger recovery. Rusty rotates rescue lines and observes bumps, rain, getting stuck, changing scenery and leaving water with per-topic and global cooldowns.

Crossings leave a localized wet coat below the windows; rain wets all bodywork. Wetness dries gradually and a capped droplet pool drains arches, rocker panels and gutters. Lamp emission, paint textures and snow accumulation remain intact.

Eight shallow puddles occupy small depressions in muddy trail stretches. Their clipped water surfaces share the terrain's half-metre grid, reflect the sky and receive rain ripples. The same water heights drive tyre splash audio, particles and vehicle wetness.


## Roadside proximity braking
The stranded drivers and vehicles share world-space protected areas with their rendered actor positions. Fixed-step physics checks speed-dependent approach distance, lateral slides and gravity rollback; cuts propulsion and cruise; applies service brakes and brake lamps; and retains directional reverse/forward escape. A swept keep-clear boundary catches high-speed or airborne crossings that tyre brakes alone cannot stop. It preserves vertical and tangential motion and uses world coordinates across origin shifts. The HUD explains auto braking, while recovery hints and the unstuck prompt are suppressed during intervention. `test-roadside-safety.mjs` checks actual mesh coverage, approaches and escape, throttle/cruise hold, airborne crossings and rebasing.

Grass wind is bounded in storms. Historical bird behavior, superseded by the October 9 removal above: occasional meadow birds used connected body/wing geometry and smaller flocks with a travel requirement and 12-second separation. Wet or dark conditions suppressed these flights; fireflies and weather/tire effects remain separate.


## Keyboard camera orbit
WASD drives; arrows are exclusively camera controls. Left/right orbit around the vehicle; up/down change camera elevation, bounded above the ground and below the overhead singularity. C smoothly restores the chase camera. The selected view follows the truck as it drives, while pause, dialogs, text inputs, preview mode and browser shortcuts retain their input guards. Resetting the truck restores the default camera; a manual camera key cancels the antenna camera cut. `camera-orbit.mjs` is frame-rate independent, and `drivingInput` keeps camera keys out of propulsion, steering and shift-lock checks. HUD, briefing, pause menu and screen-reader instructions share the new mapping.
