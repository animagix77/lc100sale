// Judge Dean LLC — mobile orbit loading and rapid-scroll regression coverage.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../orbit-sequence.js'),'utf8'),{window});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('rapid scrolling displays the latest target, bounds memory/requests, and suspends offscreen',async()=>{
 const jobs=[],drawn=[];let inflight=0,maxInflight=0;
 const sequence=window.createOrbitSequence({count:96,url:i=>i,onFrame:(_,i)=>drawn.push(i),
  loadImage:index=>new Promise(resolve=>{inflight++;maxInflight=Math.max(maxInflight,inflight);jobs.push(()=>{inflight--;resolve({index})})})});
 sequence.setActive(true);await settle();
 assert.equal(jobs.length,3);
 sequence.seek(1);sequence.seek(.5);
 for(let pass=0;pass<15;pass++){jobs.splice(0).forEach(done=>done());await settle()}
 assert.equal(sequence.state.target,48);assert.equal(sequence.state.displayed,48);
 assert.ok(maxInflight<=3);
 for(let frame=0;frame<96;frame+=4){
  sequence.seek(frame/95);
  for(let pass=0;pass<5;pass++){jobs.splice(0).forEach(done=>done());await settle()}
  assert.ok(sequence.state.cached<=24);
 }
 sequence.setActive(false);sequence.seek(.2);
 jobs.splice(0).forEach(done=>done());await settle();
 assert.equal(jobs.length,0);
 sequence.setActive(true);
 for(let pass=0;pass<5;pass++){jobs.splice(0).forEach(done=>done());await settle()}
 assert.equal(sequence.state.displayed,19);assert.ok(drawn.length>10);
});

test('missing PNGs do not erase a loaded frame or retry forever',async()=>{
 let requests=0;const drawn=[];
 const sequence=window.createOrbitSequence({count:96,url:i=>i,onFrame:(_,i)=>drawn.push(i),loadImage:async index=>{
  requests++;if(index===48)throw Error('missing frame');return {index};
 }});
 sequence.setActive(true);await settle();sequence.seek(.5);await settle();await settle();
 assert.equal(sequence.state.failed,1);assert.ok(Math.abs(sequence.state.displayed-48)<=1);
 const settled=requests;sequence.seek(.5);await settle();assert.equal(requests,settled);
 assert.ok(drawn.length>0);
});

test('the published mobile asset set is complete, optimized PNG data',()=>{
 const path=require('node:path'),dir=path.join(__dirname,'../assets/orbit/mobile');
 let bytes=0;
 for(let frame=1;frame<=96;frame++){
  const data=fs.readFileSync(path.join(dir,`frame-${String(frame).padStart(3,'0')}.png`));
  assert.equal(data.subarray(1,4).toString(),'PNG');
  assert.equal(data.readUInt32BE(16),768);assert.equal(data.readUInt32BE(20),432);bytes+=data.length;
 }
 assert.ok(bytes<14*1024*1024);
});
