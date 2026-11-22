// Judge Dean LLC. A failed latch lets a body panel swing about its surviving hinge.
import {Quaternion, Vector3} from 'three/webgpu';
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

export class VehicleDamageView {
  constructor(truck,{reduced=false}={}) {
    this.truck = truck;
    this.body = truck.getObjectByName('Body');
    this.reduced = reduced;
    this.panels = [];
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
    this.sampled = false;
    this.wasHealthy = false;
    this.acceleration.set(0,0,0);
    setBodyArticulated(this.body,false);
    for (const panel of this.panels) {
      panel.stage = null;
      panel.angle = panel.angularSpeed = 0;
      panel.group.position.set(0,0,0);
      panel.group.quaternion.identity();
    }
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
    let articulated = false;
    for (const panel of this.panels) {
      const stage = damage.stage(panel.id);
      if (stage==='secure' && panel.stage===stage) continue;
      if (stage!=='secure') articulated = true;
      const {group,spec,side,hinge} = panel;
      const loose = stage==='loose';
      const rest = loose ? spec.looseRest : spec.openRest;
      const limit = loose ? spec.looseLimit : spec.openLimit;
      if (stage==='secure') {
        panel.angle = panel.angularSpeed = 0;
      } else if (this.reduced || panel.stage===null) {
        // A restored save should already look damaged on its first frame.
        panel.angle = rest;
        panel.angularSpeed = 0;
      } else {
        if (stage!==panel.stage) panel.angularSpeed += loose ? .75 : 1.5;
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
          const spring = (rest-panel.angle) * (loose ? 95 : 28);
          const damping = panel.angularSpeed * (loose ? 11 : 5.8);
          panel.angularSpeed += (torque+spring-damping)*step;
          panel.angle += panel.angularSpeed*step;
          if (panel.angle<0 || panel.angle>limit) {
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
  }
  dispose() {
    this.reset();
    disposeClosedBatches(this.body);
  }
}
