// Judge Dean LLC — shared onshore gusts sampled at each plant's permanent roots.
import {attribute, sin, vec3} from 'three/tsl';

export function foliagePhase(x, z) {
 return x * .23 + z * .074;
}

// positionLocal already includes the instance's rotation. Offset in the common
// land frame so neighboring plants with different planting angles lean together.
// Flex is in metres and comes from the undeformed blade, branch or frond.
export function breezeOffset(clock, phase, strength, flex) {
 const leaf = attribute('position', 'vec3');
 const swell = sin(clock.mul(.92).sub(phase));
 const ripple = sin(clock.mul(2.1).sub(phase.mul(2.3)).add(leaf.x.mul(3.1)).add(leaf.z.mul(2.4)));
 const bend = swell.mul(.43).add(.51).add(ripple.mul(.065)).mul(strength).mul(flex);
 return vec3(bend, bend.abs().mul(-.10), bend.mul(.32));
}
