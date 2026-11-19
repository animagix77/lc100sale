// Judge Dean LLC. Batch rigid coachwork in the vehicle's local frame.
import {Mesh, Matrix4} from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeRigid(group) {
  group.updateWorldMatrix(true, true);
  const toGroup = group.matrixWorld.clone().invert();
  const matrix = new Matrix4();
  const batches = new Map();

  group.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = part.receiveShadow = true;
    const {material, geometry} = part;
    // Glass needs per-pane depth sorting. Keep the separate red, reverse and
    // indicator lenses addressable even where two lenses share a reflector.
    if (material.transparent || material.transmission > 0 ||
        /^Rear[ _]lamps[ _/]/i.test(part.name) || Array.isArray(material) || part.children.length) return;
    const layout = Object.keys(geometry.attributes).sort().join(',');
    const key = [material.uuid, !!geometry.index, layout].join('|');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(part);
  });

  for (const parts of batches.values()) {
    const geometries = parts.map(part => {
      // Keep every UV channel, including the one used only by the tire normal map.
      matrix.multiplyMatrices(toGroup, part.matrixWorld);
      return part.geometry.clone().applyMatrix4(matrix);
    });
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    if (!geometry) continue;
    const first = parts[0];
    const mesh = new Mesh(geometry, first.material);
    mesh.name = parts.length === 1 ? first.name : first.material.name;
    mesh.castShadow = mesh.receiveShadow = true;
    for (const part of parts) part.removeFromParent();
    group.add(mesh);
  }
}
