// Judge Dean LLC — persistent gates and startup-cached labels avoid checkpoint uploads.
import * as THREE from 'three/webgpu';
import {texture,uniform,uv,vec2} from 'three/tsl';
import {GATE_HALF_WIDTH,WAYPOINT_COUNT} from './waypoints.mjs';

function makeLabelAtlas(){
 const columns=8,rows=Math.ceil((WAYPOINT_COUNT*2+1)/columns),canvas=document.createElement('canvas');
 canvas.width=columns*256;canvas.height=rows*96;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#233437';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='bold 44px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
 for(let cell=0;cell<=WAYPOINT_COUNT*2;cell++){
  const active=cell>=WAYPOINT_COUNT&&cell<WAYPOINT_COUNT*2;
  ctx.fillStyle=active?'#ffc381':'#eee9d9';
  ctx.fillText(cell===WAYPOINT_COUNT*2?'✓':String(cell%WAYPOINT_COUNT+1).padStart(2,'0'),(cell%columns)*256+128,Math.floor(cell/columns)*96+48);
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 return {map,columns,rows};
}

export class WaypointView{
 constructor(scene,route,field){
  this.scene=scene;this.route=route;this.field=field;this.key='';this.groups=[];
  this.materials=[new THREE.MeshStandardMaterial({color:'#f4a367',roughness:.7,emissive:'#bb5727',emissiveIntensity:.22,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#d7c8a5',roughness:1,side:THREE.DoubleSide}),new THREE.MeshStandardMaterial({color:'#83ae95',roughness:1,side:THREE.DoubleSide})];
  this.postGeometry=new THREE.CylinderGeometry(.045,.07,3.2,6);this.flagGeometry=new THREE.BufferGeometry();this.flagGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.95,-.24,0,0,-.48,0],3));this.flagGeometry.computeVertexNormals();this.dashGeometry=new THREE.BoxGeometry(.55,.018,.10);
  this.labelAtlas=makeLabelAtlas();
  // Keep all four slots attached while hidden: scene warmup compiles every
  // label material and renders the shared atlas before the first drive.
  this.pool=Array.from({length:4},(_,slot)=>{
   const g=new THREE.Group(),mat=this.materials[[0,1,1,2][slot]],posts=[],flags=[],dashes=[];
   for(let i=0;i<2;i++){const post=new THREE.Mesh(this.postGeometry,mat),flag=new THREE.Mesh(this.flagGeometry,mat);if(i===1)flag.rotation.y=Math.PI;posts.push(post);flags.push(flag);g.add(post,flag)}
   for(let x=-GATE_HALF_WIDTH+.5;x<GATE_HALF_WIDTH;x+=1.2){const dash=new THREE.Mesh(this.dashGeometry,mat);dashes.push(dash);g.add(dash)}
   const {map,columns,rows}=this.labelAtlas,offset=uniform(new THREE.Vector2()),labelMaterial=new THREE.SpriteNodeMaterial({map,depthWrite:false});
   labelMaterial.colorNode=texture(map,uv().mul(vec2(1/columns,1/rows)).add(offset));
   const label=new THREE.Sprite(labelMaterial);g.add(label);Object.assign(g.userData,{posts,flags,dashes,label,labelOffset:offset,target:null});g.visible=false;scene.add(g);return g;
  });
 }
 clear(){for(const g of this.pool)g.visible=false;this.groups.length=0;this.key='';}
 refresh(origin){
  const key=`${this.route.revision},${this.route.next},${origin.x},${origin.z}`;if(key===this.key)return;this.key=key;this.groups.length=0;
  const points=this.route.nearby();
  for(let slot=0;slot<this.pool.length;slot++){
   const g=this.pool[slot],point=points[slot];g.visible=!!point;if(!point)continue;
   const bridge=point.name==='Canyon bridge'||point.name==='The far bank',t=bridge?{...point,dx:0,dz:1}:point,halfWidth=bridge?2.3:GATE_HALF_WIDTH;
   const active=t.index===this.route.next,passed=t.index<this.route.next,mat=this.materials[passed?2:active?0:1],{posts,flags,dashes,label,labelOffset}=g.userData;
   g.position.set(t.x-origin.x,0,t.z-origin.z);
   for(let i=0;i<2;i++){
    const side=i===0?-1:1,x=t.x-side*t.dz*halfWidth,z=t.z+side*t.dx*halfWidth,h=this.field.height(x,z);
    posts[i].material=flags[i].material=mat;posts[i].position.set(x-t.x,h+1.6,z-t.z);flags[i].position.set(x-t.x,h+3.1,z-t.z);
   }
   let dashCount=0;
   for(let x=-halfWidth+.5;x<halfWidth;x+=1.2){const dash=dashes[dashCount++];dash.visible=true;dash.material=mat;dash.position.set(-t.dz*x,this.field.height(t.x-t.dz*x,t.z+t.dx*x)+.027,t.dx*x);dash.rotation.y=Math.atan2(-t.dx,-t.dz);}
   for(let i=dashCount;i<dashes.length;i++)dashes[i].visible=false;
   const cell=passed?WAYPOINT_COUNT*2:t.leg-1+(active?WAYPOINT_COUNT:0),{columns,rows}=this.labelAtlas;
   labelOffset.value.set((cell%columns)/columns,1-(Math.floor(cell/columns)+1)/rows);
   label.scale.set(active?4.0:2.1,active?1.5:.79,1);label.position.set(0,Math.max(this.field.height(t.x-halfWidth,t.z),this.field.height(t.x+halfWidth,t.z))+3.7,0);
   g.userData.target=t;this.groups.push(g);
  }
 }
 dispose(){
  this.clear();for(const g of this.pool){g.removeFromParent();g.userData.label.material.dispose()}this.pool.length=0;
  this.labelAtlas.map.dispose();for(const m of this.materials)m.dispose();for(const g of [this.postGeometry,this.flagGeometry,this.dashGeometry])g.dispose();
 }
}
