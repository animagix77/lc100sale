// Judge Dean LLC. Persistent latch wear from separate impacts on the coachwork.
export const DAMAGE_PANELS = Object.freeze([
  'hood', 'tailgate', 'leftFrontDoor', 'rightFrontDoor', 'leftRearDoor', 'rightRearDoor',
]);

const looseAt = 40;
const unlatchedAt = 100;
const minimumSeverity = .30;

function latchStage(wear) {
  if (wear >= unlatchedAt) return 'unlatched';
  if (wear >= looseAt) return 'loose';
  return 'secure';
}

function panelAtContact(point, normal) {
  if (!point || !normal ||
      !Number.isFinite(point.x) || !Number.isFinite(point.z) ||
      !Number.isFinite(normal.x) || !Number.isFinite(normal.y) || !Number.isFinite(normal.z)) return null;
  const side = Math.abs(normal.x);
  const end = Math.abs(normal.z);
  if (Math.max(side, end) < .5 || Math.abs(normal.y) > Math.max(side, end)) return null;

  // A squared-up end strike can register at either corner of the chassis box.
  // Use its contact normal as well as its position to distinguish a fender graze.
  if (Math.abs(point.z) > 1.4 && end >= .75 * side && point.z * normal.z > 0)
    return point.z < 0 ? 'hood' : 'tailgate';

  // These bounds follow the outer door skins on the exported truck, in metres.
  // Contacts ahead of the front door or aft of the rear door hit fixed bodywork.
  if (point.x * normal.x <= 0 || Math.abs(point.x) < .5 || side < end ||
      point.z < -.75 || point.z > 1.30) return null;
  if (point.z < .34) return point.x < 0 ? 'leftFrontDoor' : 'rightFrontDoor';
  return point.x < 0 ? 'leftRearDoor' : 'rightRearDoor';
}

const crushZones = ['frontLeft','frontRight','rearLeft','rearRight','leftSide','rightSide','roof'];

function crushContact(event) {
  const {point,normal,closing,impulse} = event;
  if (!(closing >= 7 && impulse >= 5500 && event.severity >= .68) ||
      ![closing,impulse,point?.x,point?.z,normal?.x,normal?.y,normal?.z].every(Number.isFinite)) return null;
  const side = point.x < 0 ? 'Left' : 'Right';
  if (normal.y > .7) return {zone:'roof', door:point.x < 0 ? 'leftFrontDoor' : 'rightFrontDoor'};
  if (Math.abs(normal.z) >= Math.abs(normal.x) && normal.z*point.z > 0) {
    const front = point.z < 0;
    return {zone:(front?'front':'rear')+side, door:side.toLowerCase()+(front?'FrontDoor':'RearDoor')};
  }
  if (normal.x*point.x > 0) return {zone:side.toLowerCase()+'Side',door:side.toLowerCase()+(point.z<.34?'FrontDoor':'RearDoor')};
  return null;
}

export class VehicleDamage {
  constructor() { this.wear = new Map(); this.crush = {}; this.revision = 0; this.peakCrush = 0; }

  get hasDamage() { return this.wear.size > 0 || this.peakCrush > 0; }
  stage(panel) { return latchStage(this.wear.get(panel) || 0); }
  reset() { this.wear.clear(); this.crush = {}; this.peakCrush = 0; this.revision++; }

  // Physics emits one event per distinct body impact with severity in [0, 1].
  // Crushing requires both closing speed and impulse. Resting against a rock cannot fold a panel.
  hit(event) {
    if (!Number.isFinite(event?.severity) || event.severity < minimumSeverity) return null;
    const panel = panelAtContact(event.point, event.normal);
    const impact = crushContact(event);
    if (impact) {
      const prior = this.crush[impact.zone] || 0;
      const gain = Math.round(Math.min(100,32+(event.closing-7)*5+Math.min(30,event.impulse/1000)));
      const depth = Math.min(100,prior+gain);
      const popped = depth >= 65;
      const primary = panel || impact.door;
      if (prior===depth && this.stage(primary)==='unlatched' && this.stage(impact.door)==='unlatched') return null;
      this.crush[impact.zone] = depth;
      this.peakCrush = Math.max(this.peakCrush,depth);
      this.revision++;
      for (const id of [primary,impact.door]) this.wear.set(id,Math.max(this.wear.get(id)||0,popped?100:55));
      return {panel:primary,stage:this.stage(primary),changedStage:true,crushed:true};
    }
    if (!panel) return null;
    const previous = this.wear.get(panel) || 0;
    if (previous === unlatchedAt) return null;
    const gain = Math.round(5 + (Math.min(1, event.severity) - minimumSeverity) * 72);
    const wear = Math.min(unlatchedAt, previous + gain);
    this.wear.set(panel, wear);
    const stage = latchStage(wear);
    return {panel, stage, changedStage: stage !== latchStage(previous)};
  }

  snapshot() {
    const saved = Object.fromEntries(this.wear);
    if (this.peakCrush) saved.crush = {...this.crush};
    return saved;
  }

  restore(saved) {
    this.reset();
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
    for (const zone of crushZones) {
      const value = saved.crush?.[zone];
      if (!Number.isFinite(value) || value < 1) continue;
      this.crush[zone] = Math.min(100,Math.round(value));
      this.peakCrush = Math.max(this.peakCrush,this.crush[zone]);
    }
    for (const panel of DAMAGE_PANELS) {
      if (!Object.hasOwn(saved, panel) || !Number.isFinite(saved[panel])) continue;
      const wear = Math.min(unlatchedAt, Math.round(saved[panel]));
      if (wear > 0) this.wear.set(panel, wear);
    }
  }
}
