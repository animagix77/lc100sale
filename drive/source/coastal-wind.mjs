// Shared gust rhythm keeps the grass and loose sand in the same weather.
export function coastalWind(time,speed=8){
 const wind=Math.max(0,Math.min(80,Number.isFinite(speed)?speed:8));
 const gust=.68+.20*Math.sin(time*.53)+.12*Math.sin(time*.19+1.8);
 return (.22+wind/25)*gust;
}
