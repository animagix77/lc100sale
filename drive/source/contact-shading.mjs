// Judge Dean LLC — bounded screen-space contact shading, before tone mapping.
import {ao} from 'three/addons/tsl/display/GTAONode.js';
import {denoise} from 'three/addons/tsl/display/DenoiseNode.js';
import {vec4,mix,float} from 'three/tsl';
export function contactShading(scenePass,camera,{mobile=false,enabled=true}={}){
 const color=scenePass.getTextureNode('output');
 if(!enabled)return {output:color,dispose(){}};
 const depth=scenePass.getTextureNode('depth'),occlusion=ao(depth,null,camera);
 occlusion.resolutionScale=mobile?.35:.5;occlusion.samples.value=mobile?8:16;
 occlusion.radius.value=.65;occlusion.thickness.value=.75;occlusion.scale.value=.85;
 // Fixed sampling plus a depth-aware filter avoids temporal ghosting behind wheels.
 const filtered=denoise(occlusion.getTextureNode(),depth,null,camera);filtered.radius.value=3;
 const amount=mix(float(1),filtered.r,mobile?.30:.42);
 return {output:vec4(color.rgb.mul(amount),color.a),dispose(){filtered.dispose();occlusion.dispose();}};
}
