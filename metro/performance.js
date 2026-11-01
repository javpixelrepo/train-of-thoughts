import * as T from 'three';

// The train's fixed construction never moves. Updating the scene root used to
// force every carriage, fixture and wheel housing to rebuild its world matrix.
// Keep dynamic nodes and whole character rigs on the normal update path.
export function freezeStaticTransforms(model,passengers,streetLife){
 const rigs=new Set([...passengers.people,...streetLife.people.map(p=>p.p),...streetLife.sidewalkPeople.map(p=>p.p)].map(p=>p.root));
 const moving=new Set([...model.motionLayers.flatMap(l=>l.chunks),...model.wheels,streetLife.sidewalkFrame]);
 for(const car of model.cars){moving.add(car.userData.roof);moving.add(car.userData.front);}
 for(const o of [model.cab.roof,model.cab.front,model.cab.glazing])moving.add(o);
 for(const car of streetLife.vehicles){moving.add(car.root);for(const wheel of car.wheels)moving.add(wheel);}
 let frozen=0;
 function visit(object){
  if(rigs.has(object))return;
  if(!moving.has(object)){object.updateMatrix();object.matrixAutoUpdate=false;frozen++;}
  for(const child of object.children)visit(child);
 }
 visit(model.root);return frozen;
}

// Compilation alone does not upload vertex buffers or skin palettes. Do that
// while the loading cover is up, including pooled pedestrians and hidden cards,
// rather than on the first frame that a camera move reveals them.
export async function warmScene(renderer,scene,overlay,camera){
 const states=[],target=renderer.getRenderTarget(),layers=camera.layers.mask;
 const scratch=new T.WebGLRenderTarget(1,1);
 for(const tree of [scene,overlay])tree.traverse(o=>{states.push([o,o.visible,o.frustumCulled]);o.visible=true;o.frustumCulled=false;});
 try{
  scene.updateMatrixWorld(true);overlay.updateMatrixWorld(true);
  renderer.setRenderTarget(scratch);camera.layers.enableAll();
  await renderer.compileAsync(scene,camera);await renderer.compileAsync(overlay,camera);
  renderer.clear();renderer.render(scene,camera);renderer.clearDepth();renderer.render(overlay,camera);
 }finally{
  renderer.setRenderTarget(target);camera.layers.mask=layers;
  for(const [o,visible,culled]of states){o.visible=visible;o.frustumCulled=culled;}
  scratch.dispose();
 }
}

// Tighter bounds than the default spheres for long bridges and city strips.
// Entirely offscreen meshes are skipped; their geometry and detail stay intact.
export function cityVisibility(city){
 const frustum=new T.Frustum(),projection=new T.Matrix4(),box=new T.Box3(),offset=new T.Vector3();
 city.updateWorldMatrix(true,true);
 const groups=city.children.map(root=>{
  const objects=[],bounds=new T.Box3(),inverse=root.matrixWorld.clone().invert(),relative=new T.Matrix4();
  root.traverse(o=>{if(o.geometry&&!o.isSkinnedMesh){
   if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();o.frustumCulled=false;
   const local=o.geometry.boundingBox.clone().applyMatrix4(relative.multiplyMatrices(inverse,o.matrixWorld));
   bounds.union(local);objects.push({object:o,bounds:local});
  }});
  return {root,objects,bounds};
 });
 const worldBounds=(local,matrix)=>{
  const e=matrix.elements;box.copy(local);
  // City rings translate without rotating or scaling. Retain the general path
  // if a future layer uses a different transform.
  if(e[0]===1&&e[5]===1&&e[10]===1&&e[1]===0&&e[2]===0&&e[4]===0&&e[6]===0&&e[8]===0&&e[9]===0)box.translate(offset.set(e[12],e[13],e[14]));
  else box.applyMatrix4(matrix);
  return box.expandByScalar(.25);
 };
 return camera=>{
  camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  // A small pre-render margin covers rapid orbiting and wide outline endcaps.
  // This is the only culling pass; do not re-cull shared batches by spheres.
  for(const {root,objects,bounds}of groups){
   const visible=frustum.intersectsBox(worldBounds(bounds,root.matrixWorld));
   for(const entry of objects)entry.object.visible=visible&&frustum.intersectsBox(worldBounds(entry.bounds,root.matrixWorld));
  }
 };
}

export function humanVisibility(){
 const frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere(new T.Vector3(),1.7);
 return (camera,people)=>{
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const p of people){p.root.getWorldPosition(sphere.center);sphere.center.y+=.9;p.root.visible=frustum.intersectsSphere(sphere);}
 };
}

// Conservative full-body volume, refreshed from this frame's camera before IK.
export function animationVisibility(){
 const frustum=new T.Frustum(),projection=new T.Matrix4(),sphere=new T.Sphere(new T.Vector3(),2);
 const visible=root=>{root.getWorldPosition(sphere.center);sphere.center.y+=.9;return frustum.intersectsSphere(sphere);};
 visible.prepare=camera=>{camera.updateMatrixWorld();frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));};
 return visible;
}

// DOM diagnostics for repeatable local browser checks; no overlay on the art.
export function performanceReadout(stage,renderer){
 let start=performance.now(),frames=0,cpu=0,calls=0,triangles=0,lastFrame=0,stamp=0,maxCpu=0;
 const sections={},maxSections={},intervals=[];
 let interaction=null;
 renderer.info.autoReset=false;
 return {interaction(){interaction={start:performance.now(),last:0,intervals:[],cpu:[],sections:{}};},begin(){renderer.info.reset();stamp=performance.now();if(lastFrame)intervals.push(stamp-lastFrame);lastFrame=stamp;if(interaction){if(interaction.last)interaction.intervals.push(stamp-interaction.last);interaction.last=stamp;}return stamp;},mark(name){const now=performance.now();sections[name]=(sections[name]||0)+now-stamp;maxSections[name]=Math.max(maxSections[name]||0,now-stamp);if(interaction)interaction.sections[name]=(interaction.sections[name]||0)+now-stamp;stamp=now;},end(time){
  if(interaction){const s=interaction;s.cpu.push(performance.now()-time);if(performance.now()-s.start>=2200){const sorted=s.intervals.slice().sort((a,b)=>a-b);stage.dataset.transitionPerformance=JSON.stringify({frames:s.cpu.length,cpuMs:s.cpu.reduce((a,b)=>a+b,0)/s.cpu.length,p95Ms:sorted[Math.floor(sorted.length*.95)]||0,maxMs:sorted.at(-1)||0,slowFrames:sorted.filter(t=>t>25).length,sections:Object.fromEntries(Object.entries(s.sections).map(([k,v])=>[k,v/s.cpu.length]))});interaction=null;}}
  const frameCpu=performance.now()-time;frames++;cpu+=frameCpu;maxCpu=Math.max(maxCpu,frameCpu);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
  const elapsed=performance.now()-start;
  if(elapsed<3000)return;
  intervals.sort((a,b)=>a-b);
  stage.dataset.performance=JSON.stringify({fps:+(frames*1000/elapsed).toFixed(1),cpuMs:+(cpu/frames).toFixed(2),maxCpuMs:+maxCpu.toFixed(2),maxSections:Object.fromEntries(Object.entries(maxSections).map(([k,v])=>[k,+v.toFixed(2)])),p95Ms:+(intervals[Math.floor(intervals.length*.95)]||0).toFixed(2),maxMs:+(intervals.at(-1)||0).toFixed(2),sections:Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,+(v/frames).toFixed(2)])),drawCalls:Math.round(calls/frames),triangles:Math.round(triangles/frames),width:stage.clientWidth,height:stage.clientHeight});
  intervals.length=0;for(const key in sections){sections[key]=0;maxSections[key]=0;}
  start=performance.now();frames=cpu=calls=triangles=maxCpu=0;
 }};
}
