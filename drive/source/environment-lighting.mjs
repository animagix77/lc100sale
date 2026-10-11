// Judge Dean LLC — startup-baked HDR sky lighting with a fixed runtime budget.
import * as THREE from 'three/webgpu';
import {mix,pmremTexture,uniform} from 'three/tsl';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
// The same westward azimuth as WeatherView. A broad circumsolar lobe tolerates
// the expedition's changing solar altitude without moving the earth horizon.
const SUN=new THREE.Vector3(-430,280,-650).normalize();
const CLOUD=new THREE.Vector3(310,650,-170).normalize();
const GROUND=[.105,.088,.066],HORIZON=[1.02,1.07,1.11],TOP=[.28,.52,.92];
const SOLAR=[1,.91,.76],CLOUD_WHITE=[.94,.99,1.04];
const DAYLIGHT=[1,1,1],DUSK=[1.08,.85,.68],MOON=[.32,.45,.74];

/** Linear radiance, not display RGB. No sharp sun disc: the directional light
 * already supplies direct sunlight and the PMREM should not introduce fireflies.
 * The irregular low horizon represents distant terrain, never local geometry. */
export function skyRadiance(x,y,z,overcast=0,out=[0,0,0]){
 const cloud=clamp(overcast),azimuth=Math.atan2(z,x);
 const ridge=.020+.026*Math.sin(azimuth*3+.8)+.018*Math.sin(azimuth*7-1.2);
 const above=smooth(ridge-.05,ridge+.065,y),zenith=Math.sqrt(Math.max(0,y));
 const towardSun=Math.max(0,x*SUN.x+y*SUN.y+z*SUN.z);
 const towardCloud=Math.max(0,x*CLOUD.x+y*CLOUD.y+z*CLOUD.z);
 const circumsolar=3.6*Math.pow(towardSun,22)+.48*Math.pow(towardSun,3);
 const brightCloud=.52*Math.pow(towardCloud,7);
 const groundLight=.72+.28*Math.max(0,x*SUN.x+z*SUN.z);
 for(let c=0;c<3;c++){
  const clear=HORIZON[c]+(TOP[c]-HORIZON[c])*zenith+circumsolar*SOLAR[c]+brightCloud*CLOUD_WHITE[c];
  // Cloud cover spreads light over the upper hemisphere and removes the hot
  // solar reflection, instead of just multiplying a sunny probe darker.
  const covered=(.60+.33*zenith+.12*Math.pow(towardCloud,3))*CLOUD_WHITE[c];
  const sky=clear+(covered-clear)*cloud;
  out[c]=GROUND[c]*groundLight*(1-above)+sky*above;
 }
 return out;
}

/** Half-float equirectangular input. The map is convolved once and then freed. */
export function createSkyRadianceTexture({width=512,overcast=0}={}){
 const height=width/2,data=new Uint16Array(width*height*4),color=[0,0,0];
 for(let py=0;py<height;py++){
  // DataTexture.flipY=false: v=0 is the lower hemisphere in equirectUV().
  const phi=((py+.5)/height-.5)*Math.PI,y=Math.sin(phi),r=Math.cos(phi);
  for(let px=0;px<width;px++){
   const theta=((px+.5)/width-.5)*Math.PI*2,index=(py*width+px)*4;
   skyRadiance(r*Math.cos(theta),y,r*Math.sin(theta),overcast,color);
   for(let c=0;c<3;c++)data[index+c]=THREE.DataUtils.toHalfFloat(color[c]);
   data[index+3]=THREE.DataUtils.toHalfFloat(1);
  }
 }
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);
 texture.name=`Expedition HDR sky ${overcast?'overcast':'clear'}`;
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=THREE.RepeatWrapping;
 texture.needsUpdate=true;
 return texture;
}

/** Pure weather envelope, shared by both quality tiers. WeatherView continues
 * to own exposure and scene.environmentIntensity so all biome transitions remain. */
export function environmentWeather(weather={},out={tint:[1,1,1]}){
 const altitude=finite(weather.altitude,8),cloud=clamp(finite(weather.cloud,.2));
 const wet=clamp(Math.max(finite(weather.rain,0),finite(weather.snow,0)));
 const night=1-smooth(-9,-3,altitude),day=smooth(10,26,altitude);
 const fog=weather.fog===true?1:clamp(finite(weather.fog,0));
 out.blend=clamp(cloud*.9+wet*.42+fog*.35+night*.72);
 for(let c=0;c<3;c++){
  const warm=DUSK[c]+(DAYLIGHT[c]-DUSK[c])*day;
  out.tint[c]=warm+(MOON[c]-warm)*night;
 }
 return out;
}

/** Call once, after renderer.init() and before material/pipeline warmup.
 * pmremGenerator is injectable for allocation/lifecycle tests without a GPU. */
export function createEnvironmentLighting(renderer,scene,{highQuality=false,pmremGenerator=null}={}){
 const dual=highQuality&&renderer.backend?.isWebGPUBackend===true;
 const generator=pmremGenerator??new THREE.PMREMGenerator(renderer),targets=[],nodes=[];
 const previousEnvironment=scene.environment,previousNode=scene.environmentNode;
 const blend=uniform(0),tint=uniform(new THREE.Color(1,1,1));
 let output=null,disposed=false;
 try{
  for(const overcast of dual?[0,1]:[.34]){
   const source=createSkyRadianceTexture({width:dual?512:256,overcast});
   try{targets.push(generator.fromEquirectangular(source));}finally{source.dispose();}
  }
  for(const target of targets)nodes.push(pmremTexture(target.texture));
  output=(dual?mix(nodes[0],nodes[1],blend):nodes[0]).mul(tint);
  // Keep a standard environment texture for tooling/material compatibility;
  // WebGPURenderer's stable node carries the weather-dependent sky radiance.
  scene.environment=targets[0].texture;scene.environmentNode=output;
 }catch(error){
  for(const node of nodes)node.dispose();
  for(const target of targets)target.dispose();
  throw error;
 }finally{generator.dispose();}
 const targetWeather={tint:[1,1,1]},targetTint=new THREE.Color();
 const api={
  probeCount:targets.length,output,
  update(weather,dt=1/60){
   if(disposed)return;
   environmentWeather(weather,targetWeather);
   const k=1-Math.exp(-Math.max(0,finite(dt,0))*.6);
   blend.value+=(targetWeather.blend-blend.value)*k;
   targetTint.setRGB(targetWeather.tint[0],targetWeather.tint[1],targetWeather.tint[2]);tint.value.lerp(targetTint,k);
  },
  dispose(){
   if(disposed)return;disposed=true;
   if(scene.environmentNode===output)scene.environmentNode=previousNode;
   if(scene.environment===targets[0].texture)scene.environment=previousEnvironment;
   for(const node of nodes)node.dispose();
   for(const target of targets)target.dispose();
  }
 };
 api.update({},100);
 return api;
}
