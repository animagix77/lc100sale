# Terrain materials

Integration and optimized texture packing: Judge Dean LLC.

Photographed texture sources from Poly Haven, released under [CC0](https://polyhaven.com/license):

- [Forest Floor](https://polyhaven.com/a/forest_floor) — eye-candy.xyz.
- [Rocky Gravel](https://polyhaven.com/a/rocky_gravel) — photography by Dimitrios Savva; processing by Dario Barresi.
- [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) — photography by Dimitrios Savva; processing by Rico Cilliers.

Color images use sRGB. Packed surface images contain linear height (R), roughness (G), and ambient occlusion (B). 1024px textures serve desktop; 512px variants serve the touch/mobile rendering tier. The maps add shading detail without changing terrain elevation, water level, sand deformation or route geometry. `sources.json` records original download URLs and asset metadata.

Riverbank canopy: generated with the built-in image-generation tool for Judge Dean LLC, then resized and encoded to WebP with its original alpha preserved. Assets: `riparian-canopy-v1.webp` (1024px) and `riparian-canopy-v1-512.webp` (512px). Exact generation prompt: [foliage-prompt.txt](foliage-prompt.txt). Cards are static geometry; existing instancing, distance fades and tree colliders are preserved.
