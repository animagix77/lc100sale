// Small, permanent rain-filled basins on the muddy route. Coordinates and levels
// are surveyed against the terrain; water stays level and its rim stays dry.
// Keep this module independent of terrain so physical and visible ground share
// exactly the same bounded depressions, without a circular dependency.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export const MUD_PUDDLES=Object.freeze([
 {x:443.304,z:-297.712,radius:1.95,level:23.8036},
 {x:337.862,z:-143.845,radius:2.10,level:12.7960},
 {x:310.172,z:-116.369,radius:1.65,level:11.3654},
 {x:352.419,z:-164.797,radius:1.90,level:13.3146},
 {x:550.993,z:-425.497,radius:1.80,level:57.7457},
 {x:363.251,z:-487.824,radius:1.90,level:51.8142},
 {x:409.665,z:-243.120,radius:1.80,level:20.5271},
 {x:284.317,z:-476.121,radius:1.80,level:38.8708}
].map((p,index)=>Object.freeze({...p,index,cut:.24})));
const cells=new Map();
for(const p of MUD_PUDDLES)for(let z=Math.floor((p.z-p.radius)/16);z<=Math.floor((p.z+p.radius)/16);z++)for(let x=Math.floor((p.x-p.radius)/16);x<=Math.floor((p.x+p.radius)/16);x++){
 const key=x+z*64;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);
}
export function puddleAt(x,z){
 // Fast rejection keeps this out of the millions of unrelated terrain samples.
 if(x<282||x>553||z< -491||z> -114)return null;
 const near=cells.get(Math.floor(x/16)+Math.floor(z/16)*64);if(!near)return null;
 for(const p of near)if((x-p.x)**2+(z-p.z)**2<p.radius*p.radius)return p;
 return null;
}
export function puddleCut(x,z){const p=puddleAt(x,z);return p?p.cut*(1-smooth(.40,1,Math.hypot(x-p.x,z-p.z)/p.radius)):0;}
export function puddleDampness(x,z){const p=puddleAt(x,z);return p?1-smooth(.50,1,Math.hypot(x-p.x,z-p.z)/p.radius):0;}
// Caller supplies the current (possibly rutted) terrain height. Never report
// water above a dry bank, elsewhere on the route, or outside a finite basin.
export function puddleHeight(x,z,ground){const p=puddleAt(x,z);return p&&Number.isFinite(ground)&&ground<p.level-.001?p.level:-Infinity;}
