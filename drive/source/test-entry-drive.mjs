// Judge Dean LLC — new drivers can reach flag 02 in the default drivetrain.
import {LoosePebbles} from './loose-pebbles.mjs';
import assert from 'node:assert/strict';
import {MountainDetails} from './mountain-details.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {BeachLife} from './beach-life.mjs';
import {BeachObstacles} from './obstacles.mjs';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';import {SandField,clamp} from './terrain.mjs';import {TerrainView} from './terrain-view.mjs';import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';import {LANDMARKS} from './expedition.mjs';
const f=new SandField(),p=await DrivePhysics.create(f),view=new TerrainView(new THREE.Scene(),p,f),r=new WaypointRoute();
const life=new BeachLife(view.scene),mountain=new MountainDetails(view.scene),crossing=new LavaCrossingView(view.scene),obstacles=new BeachObstacles(p);const gravel=new LoosePebbles(view.scene,p,f);life.ridgeRocks=mountain.rocks;life.lavaRocks=crossing.rocks;
const geometry=view.geometry.bind(view);view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
view.update(-14,0);p.reset(-14,0,f.height(-14,0));for(let i=0;i<240;i++)p.step(1/120,{brake:true});let lastPass=0;
for(let i=0;i<160000&&r.passed<2;i++){
 const a=p.position(),t=r.target(),fwd=p.forward(),heading=Math.atan2(-fwd.x,-fwd.z),desired=Math.atan2(-(t.x-a.x),-(t.z-a.z)),error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
 view.update(a.x,a.z);life.refresh(a,p.origin);mountain.refresh(a,p.origin);crossing.update(i/120,p.origin);obstacles.refresh(life);if(i%4===0)gravel.stream(a);if(i%16===0)view.refresh();p.step(1/120,{gas:p.speed<3.5,turn:clamp(error*3,-1,1),brake:Math.abs(error)>1&&Math.abs(p.speed)>1.5});p.marks.length=0;p.soundEvents.length=0;
 if(r.update(p.position(),{groundHeight:f.height(t.x,t.z)})){console.log('PASS',r.passed,t.name,'seconds',(i/120).toFixed(1));lastPass=i;}
 if(i-lastPass>18000){console.log('STALL',r.passed,p.position(),p.speed,'target',t,'ruts',f.deepest);process.exitCode=1;break;}
}
console.log('Loop result',r.passed,'/',WAYPOINT_COUNT,p.position(), 'ruts',f.deepest);if(r.passed!==2)process.exitCode=1;assert.equal(r.passed,2,'Reach the dune saddle in unlocked 4HI without boards or resetting');gravel.dispose();obstacles.dispose();crossing.dispose();mountain.dispose();life.dispose();view.dispose();p.dispose();
