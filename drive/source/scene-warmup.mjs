// Judge Dean LLC — prepare route materials before handing the driver the keys.
// Call during the loading screen, before starting the render loop. The optional
// render callback also warms shadow/effect passes, so keep the canvas covered
// until a normal frame has been rendered after this helper restores the scene.
export async function warmSceneMaterials(renderer,scene,camera,{scenePass=null,onProgress=null,warmRender=null}={}){
 const objects=[],materials=new Map(),target=renderer.getRenderTarget(),mrt=renderer.getMRT();
 scene.traverse(object=>{
  let lightVisible=object.visible;if(object.isLight)for(let parent=object.parent;parent;parent=parent.parent)lightVisible&&=parent.visible;
  objects.push({object,visible:object.visible,lightVisible,frustumCulled:object.frustumCulled,layers:object.layers.mask,count:object.isInstancedMesh?object.count:undefined,autoUpdate:object.isLOD?object.autoUpdate:undefined});
  if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])if(!materials.has(material))materials.set(material,material.visible);
 });
 try{
  // compileAsync uses the regular visibility/frustum traversal. An empty forest
  // pool or the distant canyon otherwise compiles only on its first appearance.
  // Preserve the live light set: adding inactive lights changes every lit shader.
  for(const {object,lightVisible} of objects){
   if(object.isLight){object.visible=lightVisible;continue;}
   object.visible=true;object.frustumCulled=false;object.layers.mask|=camera.layers.mask;
   if(object.isInstancedMesh&&object.count===0&&object.instanceMatrix.count>0)object.count=1;
   if(object.isLOD)object.autoUpdate=false;
  }
  for(const material of materials.keys())material.visible=true;
  if(scenePass){
   // Match the color/depth target and MRT used by the gameplay scene pass, not
   // the canvas framebuffer (a different pipeline on WebGPU and WebGL).
   renderer.setRenderTarget(scenePass.renderTarget);renderer.setMRT(scenePass.getMRT());
  }
  await renderer.compileAsync(scene,camera,null,onProgress);
  if(warmRender){
   // Three deliberately skips shadow renders in compileAsync. A loading-only
   // frame includes every casting material while the temporary visibility and
   // culling overrides still hold. Pipelines manage their own render targets.
   renderer.setRenderTarget(target);renderer.setMRT(mrt);
   await warmRender();
  }
 }finally{
  renderer.setRenderTarget(target);renderer.setMRT(mrt);
  for(const state of objects){
   const {object}=state;object.visible=state.visible;object.frustumCulled=state.frustumCulled;object.layers.mask=state.layers;
   if(state.count!==undefined)object.count=state.count;
   if(state.autoUpdate!==undefined)object.autoUpdate=state.autoUpdate;
  }
  for(const [material,visible] of materials)material.visible=visible;
 }
}
