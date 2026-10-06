import {createLocalWeather} from './local-weather.mjs';
export function createWeatherUI(onChange){
 const $=id=>document.getElementById(id),button=$('weather'),panel=$('weather-panel'),status=$('weather-status'),controller=createLocalWeather({onChange:s=>{onChange(s);$('weather-clock').setAttribute('aria-pressed',String(s.mode==='clock'));$('weather-sunset').setAttribute('aria-pressed',String(s.mode==='sunset'));$('weather-local').setAttribute('aria-pressed',String(s.mode==='live'));button.textContent=s.mode==='sunset'?'Sunset':s.live?s.label:'Weather';},onStatus:text=>status.textContent=text});
 const events=[];const listen=(el,event,fn)=>{el.addEventListener(event,fn);events.push(()=>el.removeEventListener(event,fn))};
 const open=value=>{panel.hidden=!value;button.setAttribute('aria-expanded',String(value));if(value)$('weather-close').focus();else $('view').focus({preventScroll:true})};
 listen(button,'click',()=>open(panel.hidden));listen($('weather-close'),'click',()=>open(false));listen($('weather-local'),'click',()=>controller.local());listen($('weather-clock'),'click',()=>controller.setMode('clock'));listen($('weather-sunset'),'click',()=>controller.setMode('sunset'));
 listen(panel,'keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();open(false)}});
 return {dispose(){events.forEach(fn=>fn());controller.dispose()}};
}
