// Judge Dean LLC — 2004 US LC100 baseline; sources and assumptions in README.md.
export const LC100=Object.freeze({
 engine:'2UZ-FE',powerW:235*745.699872,torqueNm:320*1.355817948,
 powerRpm:4800,torqueRpm:3400,curbMassKg:5390*.45359237,
 ratios:Object.freeze([3.520,2.042,1.400,1.000,.716]),reverseRatio:3.224,
 finalDrive:4.10,lowRange:2.488,wheelbase:2.85,
});
// Owner confirmed BFG KM3 LT275/70R18. BFG data book: 33.2-inch diameter,
// 11-inch section width, 627 rev/mile at 45 mph. Rolling radius is distinct
// from the unloaded outer radius; pressure/load variation is not simulated.
export const FITTED_TYRE=Object.freeze({name:'BFGoodrich Mud-Terrain T/A KM3',size:'LT275/70R18',diameter:33.2*.0254,width:11*.0254,revsPerMile:627});
export const VEHICLE_SETUP=Object.freeze({massKg:2450,wheelRadius:FITTED_TYRE.diameter/2,rollingRadius:1609.344/(FITTED_TYRE.revsPerMile*2*Math.PI),wheelWidth:FITTED_TYRE.width});
