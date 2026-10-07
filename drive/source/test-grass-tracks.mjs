import assert from 'node:assert/strict';
import {GrassTracks} from './grass-tracks.mjs';
const tracks=new GrassTracks();tracks.update({x:0,z:0},0,0);tracks.update({x:0,z:-5},.1,0);
for(let z=-1;z>=-5;z-=.5){const trail=tracks.sample(0,z,.1);assert(trail.amount>.8,'Swept footprint has no gaps between frames');assert(trail.dz<-.5,'Blades lie in the direction of travel');}
assert.equal(tracks.sample(4,-3,1).amount,0,'Trail stays within the truck width');
assert(tracks.sample(0,-3,30).amount>.8,'Path remains visible after driving away');assert(tracks.sample(0,-3,100).amount>.15,'Recovery is gradual');assert(tracks.sample(0,-3,250).amount<.025,'Old path recovers');
tracks.update({x:0,z:-2},1,0);assert(tracks.sample(0,-2,1).dz>.5,'Reversing lays grass in the reverse direction');
tracks.update({x:80,z:0},2,0);assert.equal(tracks.sample(40,0,2).amount,0,'Reset teleport does not flatten a line across the world');
for(let i=0;i<2500;i++)tracks.update({x:80,z:-i*.8},3+i*.1,0);assert(tracks.cells.size<=tracks.maxCells,'Trail memory is bounded on long drives');tracks.clear();assert.equal(tracks.cells.size,0);assert.equal(tracks.sample(0,0,300).amount,0);
console.log('Grass tracks: continuous swath, direction, width, persistence, recovery, teleport safety and bounded memory passed');
