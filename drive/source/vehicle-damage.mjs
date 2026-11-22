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

export class VehicleDamage {
  constructor() { this.wear = new Map(); }

  get hasDamage() { return this.wear.size > 0; }
  stage(panel) { return latchStage(this.wear.get(panel) || 0); }
  reset() { this.wear.clear(); }

  // Physics emits one event per distinct body impact with severity in [0, 1].
  // A hard hit can loosen a latch; even the largest hit cannot pop a fresh one.
  hit(event) {
    if (!Number.isFinite(event?.severity) || event.severity < minimumSeverity) return null;
    const panel = panelAtContact(event.point, event.normal);
    if (!panel) return null;
    const previous = this.wear.get(panel) || 0;
    if (previous === unlatchedAt) return null;
    const gain = Math.round(5 + (Math.min(1, event.severity) - minimumSeverity) * 72);
    const wear = Math.min(unlatchedAt, previous + gain);
    this.wear.set(panel, wear);
    const stage = latchStage(wear);
    return {panel, stage, changedStage: stage !== latchStage(previous)};
  }

  snapshot() { return Object.fromEntries(this.wear); }

  restore(saved) {
    this.reset();
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
    for (const panel of DAMAGE_PANELS) {
      if (!Object.hasOwn(saved, panel) || !Number.isFinite(saved[panel])) continue;
      const wear = Math.min(unlatchedAt, Math.round(saved[panel]));
      if (wear > 0) this.wear.set(panel, wear);
    }
  }
}
