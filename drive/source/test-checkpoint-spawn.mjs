import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';
import {SandField} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {BeachLife} from './beach-life.mjs';
import {MountainDetails} from './mountain-details.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
import {checkpointPose} from './rollover.mjs';
const scene=new THREE.Scene(),field=new SandField(),p=await DrivePhysics.create(field),view=new TerrainView(scene,p,field),life=new BeachLife(scene),mountain=new MountainDetails(scene),crossing=new LavaCrossingView(scene),obstacles=new BeachObstacles(p),route=new WaypointRoute();life.ridgeRocks=mountain.rocks;life.lavaRocks=crossing.rocks;
const geometry=view.geometry.bind(view);view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
for(let i=0;i<WAYPOINT_COUNT;i++){
 route.next=route.passed=i;const pose=checkpointPose(route,(x,z)=>field.height(x,z));
 view.prepareSpawn(pose.x,pose.z);life.refresh(pose,p.origin);mountain.refresh(pose,p.origin);crossing.update(0,p.origin);obstacles.refresh(life);
 p.reset(pose.x,pose.z,pose.height);p.rb.setRotation({x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)},true);
 for(let j=0;j<240;j++)p.step(1/120,{brake:true});
 const pos=p.position(),q=p.rb.rotation(),up=1-2*(q.x*q.x+q.z*q.z),distance=Math.hypot(pos.x-pose.x,pos.z-pose.z),contacts=p.tyres.filter(t=>t.contact).length;
 console.log(i,pose.name,'up',up.toFixed(2),'drift',distance.toFixed(2),'contacts',contacts);
 assert(up>.55,pose.name+' settles upright');assert(distance<4,pose.name+' stays close to its checkpoint');assert(pos.y>field.height(pos.x,pos.z),pose.name+' is above its terrain');
}
const last=checkpointPose(route,(x,z)=>field.height(x,z)),resident=view.tiles.get(`${Math.floor(last.x/32)},${Math.floor(last.z/32)}`);assert(resident);view.prepareSpawn(last.x,last.z);assert([...view.tiles.values()].includes(resident),'Nearby checkpoint recovery reuses the ready terrain');
obstacles.dispose();crossing.dispose();mountain.dispose();life.dispose();view.dispose();p.dispose();console.log('All checkpoint terrain/obstacle spawn checks passed');
