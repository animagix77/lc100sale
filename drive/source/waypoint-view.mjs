import * as THREE from 'three/webgpu';
import {GATE_HALF_WIDTH} from './waypoints.mjs';
export class WaypointView{
 constructor(scene,route,field){this.scene=scene;this.route=route;this.field=field;this.key='';this.groups=[];this.materials=[new THREE.MeshStandardMaterial({color:'#f4a367',roughness:.7,emissive:'#bb5727',emissiveIntensity:.22,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#d7c8a5',roughness:1,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#83ae95',roughness:1,side:THREE.DoubleSide})];this.postGeometry=new THREE.CylinderGeometry(.045,.07,3.2,6);this.flagGeometry=new THREE.BufferGeometry();this.flagGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.95,-.24,0,0,-.48,0],3));this.flagGeometry.computeVertexNormals();this.dashGeometry=new THREE.BoxGeometry(.55,.018,.10)}
 clear(){for(const g of this.groups){this.scene.remove(g);g.userData.label.material.map.dispose();g.userData.label.material.dispose()}this.groups=[]}
 refresh(origin){const key=`${this.route.revision},${this.route.next},${origin.x},${origin.z}`;if(key===this.key)return;this.key=key;this.clear();
  for(const point of this.route.nearby()){
   const bridge=point.name==='Canyon bridge'||point.name==='The far bank',t=bridge?{...point,dx:0,dz:1}:point,halfWidth=bridge?2.3:GATE_HALF_WIDTH;
   const active=t.index===this.route.next,passed=t.index<this.route.next,mat=this.materials[passed?2:active?0:1],g=new THREE.Group();g.position.set(t.x-origin.x,0,t.z-origin.z);
   for(const side of [-1,1]){const x=t.x-side*t.dz*halfWidth,z=t.z+side*t.dx*halfWidth,h=this.field.height(x,z);const post=new THREE.Mesh(this.postGeometry,mat);post.position.set(x-t.x,h+1.6,z-t.z);const flag=new THREE.Mesh(this.flagGeometry,mat);flag.position.set(x-t.x,h+3.1,z-t.z);if(side>0)flag.rotation.y=Math.PI;g.add(post,flag)}
   for(let x=-halfWidth+.5;x<halfWidth;x+=1.2){const dash=new THREE.Mesh(this.dashGeometry,mat);dash.position.set(-t.dz*x,this.field.height(t.x-t.dz*x,t.z+t.dx*x)+.027,t.dx*x);dash.rotation.y=Math.atan2(-t.dx,-t.dz);g.add(dash)}
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#233437';ctx.fillRect(0,0,256,96);ctx.fillStyle=active?'#ffc381':'#eee9d9';ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(passed?'✓':String(t.leg).padStart(2,'0'),128,48);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));label.scale.set(active?4.0:2.1,active?1.5:.79,1);label.position.set(0,Math.max(this.field.height(t.x-halfWidth,t.z),this.field.height(t.x+halfWidth,t.z))+3.7,0);g.add(label);g.userData.label=label;g.userData.target=t;this.groups.push(g);this.scene.add(g);
  }
 }
 dispose(){this.clear();for(const m of this.materials)m.dispose();for(const g of [this.postGeometry,this.flagGeometry,this.dashGeometry])g.dispose()}
}
