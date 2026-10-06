export function createClockUI(onChange){
 const $=id=>document.getElementById(id),panel=$('weather-panel'),button=$('weather');let sunset=false;
 const emit=()=>{const date=new Date(),altitude=sunset?8:Math.sin(((date.getHours()+date.getMinutes()/60)-6)*Math.PI/12)*65;onChange({altitude,cloud:.2,wind:8,rain:0,snow:0,fog:false});$('weather-status').textContent=sunset?'Endless golden hour. The forecast has been overruled.':'Your local time: '+date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' · clear skies';$('weather-clock').setAttribute('aria-pressed',String(!sunset));$('weather-sunset').setAttribute('aria-pressed',String(sunset));};
 const events=[],listen=(node,type,fn)=>{node.addEventListener(type,fn);events.push(()=>node.removeEventListener(type,fn))};const open=value=>{panel.hidden=!value;button.setAttribute('aria-expanded',String(value));if(!value)$('view').focus({preventScroll:true})};
 listen(button,'click',()=>open(panel.hidden));listen($('weather-close'),'click',()=>open(false));listen($('weather-clock'),'click',()=>{sunset=false;emit()});listen($('weather-sunset'),'click',()=>{sunset=true;emit()});listen(panel,'keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopPropagation();open(false)}});
 emit();const timer=setInterval(emit,60000);return {dispose(){clearInterval(timer);events.forEach(fn=>fn())}};
}
