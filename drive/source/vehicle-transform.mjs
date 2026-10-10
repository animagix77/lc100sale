// Judge Dean LLC — shared visual/body transform for driving and cinematic entry.
export function syncVehicleTransform(truck,position,rotation){
 truck.position.set(position.x,position.y,position.z);
 truck.quaternion.set(rotation.x,rotation.y,rotation.z,rotation.w);
 truck.translateY(-.70);
}
