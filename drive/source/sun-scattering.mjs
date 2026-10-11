// Judge Dean LLC — shadow-tested daylight scattering within a bounded GPU budget.
import * as THREE from 'three/webgpu';
import {uniform,vec2} from 'three/tsl';
import {godrays} from 'three/addons/tsl/display/GodraysNode.js';
import {bilateralBlur} from 'three/addons/tsl/display/BilateralBlurNode.js';
import {depthAwareBlend} from 'three/addons/tsl/display/depthAwareBlend.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function sunScatteringStrength(weather={}){
 const altitude=Number.isFinite(weather.altitude)?weather.altitude:8;
 const cloud=clamp(weather.cloud??.2,0,1),wet=clamp(Math.max(weather.rain||0,weather.snow||0),0,1);
 const sun=smooth(-2,8,altitude),clear=1-smooth(.28,.88,cloud);
 // The low sun carries more visible suspended moisture. Heavy cloud/night and
 // the volcano's own emissive haze suppress direct solar beams continuously.
 return sun*clear*(1-wet*.80)*(1-clamp(weather.volcanic||0,0,1)*.85)*(.68+.32*(1-smooth(12,45,altitude)));
}
export function createSunScattering(scenePass,camera,light,{enabled=false}={}){
 const source=scenePass.getTextureNode('output');
 if(!enabled)return {output:source,enabled:false,update(){},dispose(){}};
 const depth=scenePass.getTextureNode('depth'),rays=godrays(depth,camera,light);
 rays.resolutionScale=.35;rays.raymarchSteps.value=24;rays.density.value=.18;rays.maxDensity.value=.08;rays.distanceAttenuation.value=1.25;
 const filtered=bilateralBlur(rays.getTextureNode(),vec2(1),2,.075),tint=uniform(new THREE.Color('#f6dfb7'));
 const output=depthAwareBlend(source,filtered.getTextureNode(),depth,camera,{blendColor:tint,edgeRadius:2,edgeStrength:1});
 let strength=0,disposed=false;
 return {output,enabled:true,rays,filtered,tint,
  update(weather,dt=.016){
   if(disposed)return;
   strength+=(sunScatteringStrength(weather)-strength)*(1-Math.exp(-Math.max(0,Math.min(dt,10))*1.3));
   rays.density.value=.18*strength;rays.maxDensity.value=.08*strength;
   tint.value.copy(light.color).multiplyScalar(1.1);
  },
  dispose(){if(disposed)return;disposed=true;filtered.dispose();rays.dispose();}
 };
}
