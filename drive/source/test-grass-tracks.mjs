import assert from 'node:assert/strict';
import {GrassTracks} from './grass-tracks.mjs';
const tracks=new GrassTracks();tracks.update({x:0,z:0},0,0);tracks.update({x:0,z:-5},.1,0);
for(let z=-1;z>=-5;z-=.5){const trail=tracks.sample(0,z,.1);assert(trail.amount>.95,'The body leaves a deeply flattened continuous lane');assert(trail.dz<-.8,'Blades lie in the direction of travel');}
for(const side of [-1,1]){
 assert(tracks.sample(side*1.3,-3,.1).amount>.95,'Tire and underbody swaths join into one pressed lane');
 assert(tracks.sample(side*1.7,-3,.1).amount>.45,'Body shoulders visibly brush aside wider grass');
 assert(tracks.sample(side*2.25,-3,.1).amount<.15,'Shoulders feather back into standing grass');
 assert.equal(tracks.sample(side*2.6,-3,.1).amount,0,'The trail does not become a broad mown strip');
}
assert(tracks.sample(0,-3,60).amount>.95,'Path stays deeply crushed for a full minute');
assert(tracks.sample(0,-3,100).amount>.5,'Path remains visible after driving away');
assert(tracks.sample(0,-3,180).amount>.15,'Recovery stays gradual over several minutes');
assert(tracks.sample(0,-3,360).amount<.025,'Old path eventually recovers');
tracks.update({x:0,z:-2},1,0);const reverse=tracks.sample(0,-2,1);assert(reverse.dz>.8,'Reversing lays grass in the reverse direction');
const stationarySize=tracks.cells.size;for(let i=0;i<30;i++)tracks.update({x:0,z:-2},1.1+i*.1,0);
assert(tracks.sample(0,-2,4).dz>.8,'Stopping after reversing preserves the reverse lay');assert.equal(tracks.cells.size,stationarySize,'Stationary stamping stays within its existing footprint');
tracks.update({x:80,z:0},5,0);assert.equal(tracks.sample(40,0,5).amount,0,'Reset teleport does not flatten a line across the world');assert(tracks.sample(80,0,5).dz<-.8,'Teleport starts a fresh local footprint');
tracks.update({x:0,z:-3},100,0);assert(tracks.sample(0,-3,100).amount>.95,'Revisiting an old trail presses it flat again');assert.equal(tracks.sample(40,-1.5,100).amount,0,'Revisiting via teleport does not connect distant tracks');

// Rotated footprints retain the body width without widening world-axis bounds.
for(const heading of [Math.PI/4,Math.PI/2]){
 const rotated=new GrassTracks(),fx=-Math.sin(heading),fz=-Math.cos(heading),rx=Math.cos(heading),rz=-Math.sin(heading);
 rotated.update({x:2500,z:-3200},0,heading);rotated.update({x:2500+fx*5,z:-3200+fz*5},.1,heading);
 const at=(along,side)=>rotated.sample(2500+fx*along+rx*side,-3200+fz*along+rz*side,.1);
 assert(at(3,0).amount>.95,'A rotated swath keeps the underbody fully crushed');
 assert(at(3,1.6).amount>.4,'A rotated swath retains a visible outer shoulder');
 assert.equal(at(3,3).amount,0,'Rotation does not leave an oversized rectangular trail');
 assert(at(3,0).dx*fx+at(3,0).dz*fz>.8,'World-space travel direction survives arbitrary headings and distant origins');
}
for(let i=0;i<2500;i++)tracks.update({x:80,z:-i*.8},101+i*.1,0);assert(tracks.cells.size<=tracks.maxCells,'Trail memory is bounded on long drives');
assert(tracks.sample(80,-2499*.8,351).amount>.95,'The newest trail survives memory eviction');
tracks.clear();assert.equal(tracks.cells.size,0);assert.equal(tracks.sample(80,-2000,400).amount,0);
tracks.update({x:0,z:0},0,Math.PI/2);assert(tracks.sample(0,0,0).dx<-.8,'Clearing resets stationary direction and time throttling');
console.log('Grass tracks: wide continuous swath, directional reverse and stationary lay, rotated footprint, retained recovery, revisit, teleport safety and bounded memory passed');
