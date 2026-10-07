import {createLocalWeather} from './local-weather.mjs';
export function createWeatherUI(onChange){
 let expedition=true;
 const $=id=>document.getElementById(id),button=$('weather'),panel=$('weather-panel'),status=$('weather-status'),controller=createLocalWeather({onChange:s=>{if(!expedition)onChange(s);$('weather-expedition').setAttribute('aria-pressed',String(expedition));$('weather-clock').setAttribute('aria-pressed',String(!expedition&&s.mode==='clock'));$('weather-sunset').setAttribute('aria-pressed',String(!expedition&&s.mode==='sunset'));$('weather-local').setAttribute('aria-pressed',String(!expedition&&s.mode==='live'));button.textContent=expedition?'Expedition':s.mode==='sunset'?'Sunset':s.live?s.label:'Weather';},onStatus:text=>status.textContent=text});
 const events=[];const listen=(el,event,fn)=>{el.addEventListener(event,fn);events.push(()=>el.removeEventListener(event,fn))};
 const open=value=>{panel.hidden=!value;button.setAttribute('aria-expanded',String(value));if(value)$('weather-close').focus();else $('view').focus({preventScroll:true})};
 listen(button,'click',()=>open(panel.hidden));listen($('weather-close'),'click',()=>open(false));listen($('weather-expedition'),'click',()=>{expedition=true;controller.setMode('sunset');status.textContent='Beach → forest → river → switchbacks → snow → volcano → beach. Weather follows the expedition.'});listen($('weather-local'),'click',()=>{expedition=false;controller.local()});listen($('weather-clock'),'click',()=>{expedition=false;controller.setMode('clock')});listen($('weather-sunset'),'click',()=>{expedition=false;controller.setMode('sunset')});
 listen(panel,'keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();open(false)}});
 status.textContent='Weather follows the expedition. You can switch to your own forecast here.';
 return {get expedition(){return expedition},dispose(){events.forEach(fn=>fn());controller.dispose()}};
}
