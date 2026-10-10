// Judge Dean LLC — fit existing wheel meshes to the confirmed KM3 dimensions.
import {Matrix4,Vector3} from 'three';
import {VEHICLE_SETUP} from './vehicle-spec.mjs';
export function fitTyreVisual(roll){
 // Roll is an unscaled pivot at the axle. Measure geometry in that frame,
 // including child transforms; steering and suspension must not affect size.
 roll.scale.set(1,1,1);roll.updateWorldMatrix(true,true);
 const inverse=roll.matrixWorld.clone().invert(),matrix=new Matrix4(),v=new Vector3();let radius=0,minX=Infinity,maxX=-Infinity;
 roll.traverse(mesh=>{const positions=mesh.geometry?.attributes.position;if(!positions)return;matrix.multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(matrix);radius=Math.max(radius,Math.hypot(v.y,v.z));minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);}});
 if(radius>0&&maxX>minX)roll.scale.set(VEHICLE_SETUP.wheelWidth/(maxX-minX),VEHICLE_SETUP.wheelRadius/radius,VEHICLE_SETUP.wheelRadius/radius);
 return roll.scale;
}
