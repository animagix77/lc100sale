// Judge Dean LLC. Batch rigid coachwork in the vehicle's local frame.
import {Mesh, Matrix4} from 'three/webgpu';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const closedBatches = new WeakMap();

function bucket(batches, part) {
  if (!part.isMesh) return;
  const {material, geometry} = part;
  // Glass needs per-pane depth sorting. The lamp meshes identify the separate
  // red, reversing and indicator circuits, even where they share a material.
  if (material.transparent || material.transmission > 0 ||
      /^Rear[ _]lamps[ _/]/i.test(part.name) || Array.isArray(material) || part.children.length) return;
  const layout = Object.keys(geometry.attributes).sort().join(',');
  const key = [material.uuid, !!geometry.index, layout].join('|');
  if (!batches.has(key)) batches.set(key, []);
  batches.get(key).push(part);
}

function prepareClosedBatches(body) {
  const byMaterial = new Map();
  for (const child of body.children) {
    if (child.userData.damage_panel) {
      for (const part of child.children) bucket(byMaterial,part);
    } else bucket(byMaterial,child);
  }
  const combined = [], separate = [];
  for (const parts of byMaterial.values()) {
    if (parts.length<2) continue;
    // The per-panel batches below already bake their mesh transforms. Every
    // hinge group has the identity transform in the truck's undamaged pose.
    const geometry = mergeGeometries(parts.map(part=>part.geometry));
    if (!geometry) continue;
    const mesh = new Mesh(geometry,parts[0].material);
    mesh.name = 'Intact body / '+mesh.material.name;
    mesh.castShadow = mesh.receiveShadow = true;
    body.add(mesh);
    combined.push(mesh);
    separate.push(...parts);
  }
  closedBatches.set(body,{combined,separate,articulated:true});
  setBodyArticulated(body,false);
}

export function setBodyArticulated(body, articulated) {
  const batch = closedBatches.get(body);
  if (!batch || batch.articulated===articulated) return;
  batch.articulated = articulated;
  for (const mesh of batch.combined) mesh.visible = !articulated;
  for (const mesh of batch.separate) mesh.visible = articulated;
}

export function disposeClosedBatches(body) {
  const batch = closedBatches.get(body);
  if (!batch) return;
  setBodyArticulated(body,true);
  for (const mesh of batch.combined) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  closedBatches.delete(body);
}

export function mergeRigid(group) {
  group.updateWorldMatrix(true, true);
  const toGroup = group.matrixWorld.clone().invert();
  const matrix = new Matrix4();
  const batches = new Map();

  let hasPanels = false;
  function collect(part) {
    // Door paint and glass have to follow the same hinge after a collision.
    // Batch their rigid children together within the panel's local frame.
    if (part !== group && part.userData.damage_panel) {
      hasPanels = true;
      mergeRigid(part);
      return;
    }
    if (part.isMesh) part.castShadow = part.receiveShadow = true;
    bucket(batches,part);
    for (const child of part.children) collect(child);
  }
  collect(group);

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
  if (hasPanels) prepareClosedBatches(group);
}
