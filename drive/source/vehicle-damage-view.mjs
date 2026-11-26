// Judge Dean LLC. A failed latch lets a body panel swing about its surviving hinge.
import {Matrix4, Quaternion, Vector3} from 'three/webgpu';
import {disposeClosedBatches, setBodyArticulated} from './vehicle-batching.mjs';

// Angles in radians. Loose latches catch on the striker; unlatched panels can travel farther.
const DOOR = {arm:.52, looseRest:.037, looseLimit:.105, openRest:.16, openLimit:.65};
const HOOD = {arm:.57, looseRest:.025, looseLimit:.075, openRest:.095, openLimit:.28};
const TAILGATE = {arm:.21, looseRest:.046, looseLimit:.11, openRest:.24, openLimit:.68};
const specifications = {
  leftFrontDoor:DOOR, rightFrontDoor:DOOR, leftRearDoor:DOOR, rightRearDoor:DOOR,
  hood:HOOD, tailgate:TAILGATE
};
const GRAVITY = 9.81;

const ramp = v => Math.min(1,Math.max(0,v));

// Evaluate in the original coachwork frame so a seam, lamp and glass edge bend together.
function fold(point, zones) {
  const {x,y,z} = point;
  for (const [zone,amount] of zones) {
    const depth = amount/100;
    if (zone==='roof') {
      point.y -= .42*depth*ramp((y-1.05)/.8)*(1-.25*ramp(Math.abs(z)/1.65));
    } else if (zone.endsWith('Side')) {
      const side = zone==='leftSide' ? -1 : 1;
      const weight = depth*ramp((side*x-.15)/.75)*ramp((2.15-Math.abs(z))/.9)*ramp((y-.35)/.45);
      point.x -= side*weight*(.35+.07*Math.cos(z*7+y*5));
      point.y -= .09*weight;
    } else {
      const front = zone.startsWith('front'), end = front ? -1 : 1;
      const side = zone.endsWith('Left') ? -1 : 1;
      const along = ramp((end*z-(front?.68:.85))/1.60);
      const weight = depth*along*(.40+.60*ramp((side*x+.75)/1.45));
      point.z -= end*.77*weight;
      point.y += weight*(.16+.18*Math.sin(along*9))*ramp((y-.40)/.55);
      point.x += side*.11*weight*Math.sin(along*Math.PI);
    }
  }
  return point;
}

export class VehicleDamageView {
  constructor(truck,{reduced=false}={}) {
    this.truck = truck;
    this.body = truck.getObjectByName('Body');
    this.reduced = reduced;
    this.panels = [];
    this.dentedMeshes = new Map();
    this.foldRevision = -1;
    this.velocity = new Vector3();
    this.acceleration = new Vector3();
    this.force = new Vector3();
    this.inverseRotation = new Quaternion();
    for (const group of this.body?.children || []) {
      const id = group.userData.damage_panel;
      const hinge = group.userData.damage_hinge;
      if (!specifications[id] || !Array.isArray(hinge) || hinge.length !== 3 || !hinge.every(Number.isFinite)) continue;
      const side = specifications[id] === DOOR ? (id.startsWith('left') ? -1 : 1) : 0;
      this.panels.push({
        group, hinge:new Vector3(...hinge), id, side, spec:specifications[id],
        axis:side ? new Vector3(0,side,0) : new Vector3(1,0,0)
      });
    }
    this.reset();
  }
  reset() {
    for (const [mesh,original] of this.dentedMeshes) {
      mesh.geometry.dispose();
      mesh.geometry = original;
    }
    this.dentedMeshes.clear();
    this.foldRevision = -1;
    this.sampled = false;
    this.wasHealthy = false;
    this.acceleration.set(0,0,0);
    setBodyArticulated(this.body,false);
    for (const panel of this.panels) {
      panel.stage = null;
      panel.bentHinge = null;
      panel.angle = panel.angularSpeed = 0;
      panel.group.position.set(0,0,0);
      panel.group.quaternion.identity();
    }
  }
  foldCoachwork(damage) {
    const zones = Object.entries(damage.crush);
    const point = new Vector3(), bind = new Vector3();
    const visit = (part,parentMatrix) => {
      if (part.name.startsWith('Intact body /')) return;
      part.updateMatrix();
      // The moving hinge is applied after the dent, never baked into the next strike.
      const matrix = part.userData.damage_panel ? parentMatrix : new Matrix4().multiplyMatrices(parentMatrix,part.matrix);
      if (part.isMesh) {
        const existing = this.dentedMeshes.get(part);
        const original = existing || part.geometry;
        const source = original.attributes.position, inverse = matrix.clone().invert();
        for (let i=0;i<source.count;i++) {
          bind.fromBufferAttribute(source,i).applyMatrix4(matrix);
          fold(point.copy(bind),zones);
          if (bind.distanceToSquared(point)<1e-12) {
            if (existing) part.geometry.attributes.position.setXYZ(i,source.getX(i),source.getY(i),source.getZ(i));
            continue;
          }
          if (!this.dentedMeshes.has(part)) {
            this.dentedMeshes.set(part,original);
            part.geometry=original.clone();
          }
          point.applyMatrix4(inverse);
          part.geometry.attributes.position.setXYZ(i,point.x,point.y,point.z);
        }
        if (this.dentedMeshes.has(part)) {
          part.geometry.attributes.position.needsUpdate=true;
          part.geometry.computeVertexNormals();
          part.geometry.computeBoundingBox();
          part.geometry.computeBoundingSphere();
        }
      }
      for (const child of part.children) visit(child,matrix);
    };
    const identity = new Matrix4();
    for (const child of this.body.children) visit(child,identity);
    for (const panel of this.panels) panel.bentHinge=fold(panel.hinge.clone(),zones);
    this.foldRevision=damage.revision;
  }
  update(dt,damage,velocity) {
    if (!(dt>0) || !Number.isFinite(dt)) return;
    if (!damage.hasDamage) {
      if (!this.wasHealthy) {
        this.reset();
        for (const panel of this.panels) panel.stage = 'secure';
        this.wasHealthy = true;
      }
      if (velocity) this.velocity.copy(velocity);
      this.sampled = !!velocity;
      return;
    }
    this.wasHealthy = false;
    // Velocities survive floating-origin shifts. Skip inertial kicks on startup
    // and after long gaps. A parked truck on flat ground settles completely.
    if (this.sampled && dt<=.12 && velocity) {
      this.force.copy(velocity).sub(this.velocity).multiplyScalar(1/dt).clampLength(0,22);
      this.acceleration.lerp(this.force,1-Math.exp(-16*dt));
    } else {
      this.acceleration.set(0,0,0);
    }
    if (velocity) this.velocity.copy(velocity);
    this.sampled = !!velocity;
    this.force.set(0,-GRAVITY,0).sub(this.acceleration);
    this.force.applyQuaternion(this.truck.getWorldQuaternion(this.inverseRotation).invert());
    if (damage.peakCrush && this.foldRevision!==damage.revision) this.foldCoachwork(damage);
    let articulated = damage.peakCrush>0;
    let stopHit;
    for (const panel of this.panels) {
      const stage = damage.stage(panel.id);
      if (stage==='secure' && panel.stage===stage) continue;
      if (stage!=='secure') articulated = true;
      const {group,spec,side} = panel;
      const hinge = panel.bentHinge || panel.hinge;
      const sprungDoor = side && stage==='unlatched' && damage.peakCrush>=65;
      const loose = stage==='loose';
      const rest = loose ? spec.looseRest : sprungDoor ? .46 : spec.openRest;
      const limit = loose ? spec.looseLimit : sprungDoor ? 1.18 : spec.openLimit;
      if (stage==='secure') {
        panel.angle = panel.angularSpeed = 0;
      } else if (this.reduced || panel.stage===null) {
        // A restored save should already look damaged on its first frame.
        panel.angle = rest;
        panel.angularSpeed = 0;
      } else {
        if (stage!==panel.stage) panel.angularSpeed += loose ? .75 : sprungDoor ? 5 : 1.5;
        const seconds = Math.min(dt,.1);
        const steps = Math.ceil(seconds*120);
        const step = seconds/steps;
        for (let n=0;n<steps;n++) {
          const sin = Math.sin(panel.angle), cos = Math.cos(panel.angle);
          const {x,y,z} = this.force;
          // (r × F) projected on each hinge axis, divided by the moment of
          // inertia of a thin panel. The hood's preload supports its weight.
          let tangent;
          if (side) tangent = side*cos*x-sin*z;
          else if (panel.id==='hood') tangent = sin*z+cos*y+GRAVITY;
          else tangent = cos*z-sin*y;
          const torque = tangent/spec.arm * (loose ? .16 : .55);
          const spring = (rest-panel.angle) * (loose ? 95 : sprungDoor ? 12 : 28);
          const damping = panel.angularSpeed * (loose ? 11 : sprungDoor ? 1.8 : 5.8);
          panel.angularSpeed += (torque+spring-damping)*step;
          panel.angle += panel.angularSpeed*step;
          if (panel.angle<0 || panel.angle>limit) {
            const speed=Math.abs(panel.angularSpeed);
            if (side && !loose && speed>1.15 && (!stopHit || speed>stopHit.speed)) stopHit={side,speed};
            panel.angle = Math.max(0,Math.min(limit,panel.angle));
            panel.angularSpeed *= -.18;
          }
        }
      }
      panel.stage = stage;
      group.quaternion.setFromAxisAngle(panel.axis,panel.angle);
      // Geometry stays in the truck's bind coordinates. This rotation about an
      // offset point preserves the coordinates used by snow, wetness and lamps.
      group.position.copy(hinge).applyQuaternion(group.quaternion).negate().add(hinge);
    }
    setBodyArticulated(this.body,articulated);
    return stopHit;
  }
  dispose() {
    this.reset();
    disposeClosedBatches(this.body);
  }
}
