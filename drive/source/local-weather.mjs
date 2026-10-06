const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function solarAltitude(date,location){
 if(!location)return Math.sin(((date.getHours()+date.getMinutes()/60)-6)*Math.PI/12)*65;
 const day=(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-Date.UTC(date.getUTCFullYear(),0,0))/86400000;
 const g=2*Math.PI/365*(day-1+(date.getUTCHours()-12)/24);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const hour=((date.getUTCHours()*60+date.getUTCMinutes()+eq+4*location.longitude)/4-180)*Math.PI/180,lat=location.latitude*Math.PI/180;
 return Math.asin(clamp(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(hour),-1,1))*180/Math.PI;
}
export function parseWeather(data,now=Date.now()){
 const c=data?.current;if(!c||!['temperature_2m','cloud_cover','precipitation','wind_speed_10m','weather_code','time'].every(k=>Number.isFinite(c[k])))throw Error('Invalid conditions');
 if(Math.abs(now-c.time*1000)>7200000)throw Error('Stale conditions');
 const code=c.weather_code,snow=[71,73,75,77,85,86].includes(code),storm=code>=95,fog=[45,48].includes(code),rain=storm||[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code);
 return {temperature:c.temperature_2m,cloud:clamp(c.cloud_cover/100,0,1),wind:clamp(c.wind_speed_10m,0,100),rain:rain?clamp(.18+c.precipitation/5,.18,1):0,snow:snow?clamp(.25+c.precipitation/3,.25,1):0,fog,storm,label:snow?'Snow':storm?'Stormy':fog?'Fog':rain?'Rain':c.cloud_cover>75?'Overcast':c.cloud_cover>25?'Partly cloudy':'Clear',time:c.time*1000,timezone:data.timezone};
}
export function weatherURL(location){
 const p=new URLSearchParams({latitude:(Math.round(location.latitude*10)/10).toFixed(1),longitude:(Math.round(location.longitude*10)/10).toFixed(1),current:'temperature_2m,cloud_cover,precipitation,wind_speed_10m,weather_code',timezone:'auto',timeformat:'unixtime',forecast_days:'1'});
 return 'https://api.open-meteo.com/v1/forecast?'+p;
}
export const CLEAR={cloud:.2,wind:8,rain:0,snow:0,fog:false,storm:false,label:'Clear'};
export function createLocalWeather({onChange=()=>{},onStatus=()=>{},geo=globalThis.navigator?.geolocation,fetcher=globalThis.fetch,now=()=>new Date(),timers=globalThis,hidden=()=>globalThis.document?.hidden}={}){
 let mode='clock',location=null,conditions=null,disposed=false,request=0,controller,lastFetch=0;
 const emit=()=>{if(!disposed)onChange({...conditions??CLEAR,altitude:mode==='sunset'?8:solarAltitude(now(),location),mode,live:!!conditions})};
 async function refresh(){
  if(disposed||mode!=='live'||!location)return;
  const id=++request;controller?.abort();controller=new AbortController();const pending=controller,timeout=timers.setTimeout(()=>pending.abort(),9000);lastFetch=now().getTime();
  try{const r=await fetcher(weatherURL(location),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Weather unavailable');const next=parseWeather(await r.json(),now().getTime());if(disposed||id!==request)return;conditions=next;emit();onStatus(`${next.label} · ${Math.round(next.temperature*9/5+32)}°F · nearby conditions`);}
  catch{if(disposed||id!==request)return;conditions=null;emit();onStatus('Weather unavailable. Using your local clock and clear skies. Try again.');}
  finally{timers.clearTimeout(timeout)}
 }
 function local(){
  if(disposed)return;mode='live';conditions=null;location=null;controller?.abort();const id=++request;onStatus('Waiting for location permission…');
  if(!geo){mode='clock';emit();onStatus('Location is unavailable. Using your local clock and clear skies.');return;}
  geo.getCurrentPosition(p=>{if(disposed||id!==request)return;const {latitude,longitude}=p.coords;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){mode='clock';emit();onStatus('Location unavailable. Using local time.');return;}location={latitude:Math.round(latitude*10)/10,longitude:Math.round(longitude*10)/10};onStatus('Checking nearby weather…');void refresh();},()=>{if(disposed||id!==request)return;mode='clock';emit();onStatus('Location was not available. Local time and clear skies are still on.');},{enableHighAccuracy:false,timeout:12000,maximumAge:900000});
 }
 function setMode(value){if(disposed)return;request++;controller?.abort();mode=value==='sunset'?'sunset':'clock';conditions=null;location=null;emit();onStatus(mode==='sunset'?'Endless golden hour. The forecast has been overruled.':'Local clock · clear skies. Add nearby weather below.');}
 const timer=timers.setInterval(()=>{if(disposed||hidden())return;if(mode==='live'&&location&&now().getTime()-lastFetch>=900000)void refresh();else emit()},60000);
 setMode('clock');return {local,setMode,refresh,dispose(){disposed=true;request++;controller?.abort();timers.clearInterval(timer)}};
}
