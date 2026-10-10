// Judge Dean LLC — directional molten transport shared by the river and volcano.
import * as THREE from 'three/webgpu';
import {positionLocal,uv,vec3,float,mx_noise_float,smoothstep,mix,color,abs,sin} from 'three/tsl';
export function moltenMaterial(clock,{mode='stream'}={}){
 const mat=new THREE.MeshStandardNodeMaterial({side:THREE.DoubleSide,roughness:.8});
 const across=uv().x,along=mode==='crossing'?abs(uv().y.sub(.5)).mul(170):uv().y.mul(170);
 // Both sides of the high basalt crossing drain outwards. Flank UVs run downhill.
 const p=mode==='lake'?vec3(positionLocal.x.mul(.18).add(clock.mul(.035)),positionLocal.y.mul(.18).sub(clock.mul(.055)),float(7)):vec3(across.mul(6),along.mul(.32).sub(clock.mul(.28)),float(7));
 const warp=mx_noise_float(p.mul(.43)).mul(.7),advected=p.add(vec3(warp,0,0));
 const plates=mx_noise_float(advected).mul(.5).add(.5),detail=mx_noise_float(advected.mul(3.1)).mul(.5).add(.5);
 const crust=smoothstep(.40,.57,plates),seams=float(1).sub(smoothstep(.025,.10,abs(plates.sub(.5))));
 const edge=mode==='lake'?float(1):smoothstep(0,.12,across).mul(float(1).sub(smoothstep(.88,1,across)));
 const heat=float(1).sub(crust.mul(.98)).mul(detail.mul(.3).add(.7)).add(seams.mul(.05)).clamp(0,1).mul(edge);
 const orange=mix(color('#fa2804'),color('#ffb527'),smoothstep(.24,.72,heat));
 const incandescent=mix(orange,color('#fff0b4'),smoothstep(.86,.99,heat));
 mat.colorNode=mix(color('#201b22'),color('#a33012'),heat);
 mat.emissiveNode=incandescent.mul(heat.pow(1.65)).mul(6.5);
 mat.roughnessNode=mix(float(.95),float(.32),heat);
 if(mode==='lake')mat.positionNode=positionLocal.add(vec3(0,0,sin(positionLocal.x.mul(.25).add(clock.mul(.7))).mul(sin(positionLocal.y.mul(.18).sub(clock.mul(.48)))).mul(.28)));
 mat.userData.flowMode=mode;
 return mat;
}
