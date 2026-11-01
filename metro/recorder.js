import * as T from 'three';
import {cameraTrack} from './recorded-camera.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

const API='http://127.0.0.1:4174',FPS=60,SIZE=2048;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export function createRecorder({scene,overlay,model,passengers,streetLife,camera,renderer,controls,draw,onRecord,onRestore}){
 const button=document.querySelector('#record'),status=document.querySelector('#record-status'),cancel=document.querySelector('#cancel-export'),download=document.querySelector('#download-video');
 const roots=[...passengers.people,...streetLife.people.map(p=>p.p),...streetLife.sidewalkPeople.map(p=>p.p)].map(p=>p.root);
 const view=cameraTrack(camera,controls);
 const nodes=new Set([...model.motionLayers.flatMap(l=>l.chunks),streetLife.sidewalkFrame,...model.wheels,model.cab.shell,model.cab.cutaway]);
 for(const p of [...passengers.people,...streetLife.people.map(p=>p.p),...streetLife.sidewalkPeople.map(p=>p.p)]){nodes.add(p.root);nodes.add(p.body);Object.values(p.bones).forEach(b=>nodes.add(b));}
 for(const v of streetLife.vehicles){nodes.add(v.root);v.wheels.forEach(w=>nodes.add(w));}
 for(const car of model.cars){nodes.add(car.userData.roof);nodes.add(car.userData.front);}
 for(const o of [model.cab.roof,model.cab.front,model.cab.glazing])nodes.add(o);
 // Only moving frames are recorded. Keep the fixed train, floors and bridge
 // frames at their original precision instead of rewriting their transforms.
 scene.children.filter(o=>o.isLineSegments2).forEach(o=>nodes.add(o));
 overlay.traverse(o=>nodes.add(o));
 const objects=[...nodes],all=new Map(),materials=new Set(),lineMaterials=new Set(),thinLines=[];
 for(const tree of [scene,overlay])tree.traverse(o=>{all.set(o.id,o);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.isLineMaterial)lineMaterials.add(m);}if(o.isLineSegments&&!o.isLineSegments2)thinLines.push(o);});
 const mats=[...materials],qa=new T.Quaternion(),qb=new T.Quaternion();
 let state='idle',frames=[],started=0,bytes=0,url=null,cancelled=false,session=null;
 let saved,size,dpr,enabled,widths=[],proxies=[];
 const mix=(a,b,u)=>a+(b-a)*u;
 function snapshot(t=0){
  const pose=new Float32Array(objects.length*11),opacity=new Float32Array(mats.length);
  for(let j=0;j<objects.length;j++){const o=objects[j],k=j*11;o.position.toArray(pose,k);o.quaternion.toArray(pose,k+3);o.scale.toArray(pose,k+7);pose[k+10]=+o.visible;}
  mats.forEach((m,i)=>opacity[i]=m.opacity);
  return {t,pose,opacity,parents:roots.map(r=>r.parent.id),camera:view.capture()};
 }
 function apply(a,b=a,u=0){
  roots.forEach((r,i)=>{const parent=all.get(a.parents[i]);if(r.parent!==parent)parent.add(r);});
  for(let j=0;j<objects.length;j++){
   const o=objects[j],k=j*11;
   // A recycling tile / newly spawned pedestrian must never sweep across town.
   const jump=Math.hypot(a.pose[k]-b.pose[k],a.pose[k+1]-b.pose[k+1],a.pose[k+2]-b.pose[k+2])>8;
   const v=jump?0:u;
   for(let c=0;c<3;c++){o.position.setComponent(c,mix(a.pose[k+c],b.pose[k+c],v));o.scale.setComponent(c,mix(a.pose[k+7+c],b.pose[k+7+c],v));}
   o.quaternion.copy(qa.fromArray(a.pose,k+3).slerp(qb.fromArray(b.pose,k+3),v));o.visible=!!a.pose[k+10];
  }
  mats.forEach((m,i)=>m.opacity=mix(a.opacity[i],b.opacity[i],u));
  view.apply(a.camera,b.camera,u);
 }
 async function request(path,body){
  const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':body?'image/png':'application/json'},body});
  if(!response.ok){const problem=await response.json();throw new Error(problem.error||'Video export failed.');}return response;
 }
 function sample(now){
  if(state!=='recording')return;
  const frame=snapshot(Math.max(0,(now-started)/1000));frames.push(frame);bytes+=frame.pose.byteLength+frame.opacity.byteLength;
  status.textContent=`REC ${frame.t.toFixed(1)}s · 2K / 60 fps · Pause to save`;
  if(bytes>384*1024*1024){status.textContent='Saving this take before the memory limit…';queueMicrotask(stop);}
 }
 async function start(){
  if(state!=='idle')return;
  button.disabled=true;status.textContent='Preparing recorder…';
  try{
   const response=await fetch(API+'/health');if(!response.ok)throw new Error('Local video encoder is unavailable.');
   const encoder=await response.json();if(!encoder.ready)throw new Error('Local video encoder is unavailable.');
   if(encoder.width!==SIZE||encoder.height!==SIZE||encoder.fps!==FPS)throw new Error('Restart the local video encoder to record in 2K / 60 fps.');
   frames=[];bytes=0;download.hidden=true;started=performance.now();state='recording';button.textContent='● Recording';button.setAttribute('aria-pressed','true');onRecord();sample(started);
  }catch(error){status.textContent='Could not start: '+error.message;button.disabled=false;}
 }
 async function stop(){
  if(state!=='recording')return;
  sample(performance.now());state='exporting';button.textContent='Exporting…';cancelled=false;cancel.hidden=false;status.dataset.state=state;
  saved=snapshot();size=renderer.getSize(new T.Vector2());dpr=renderer.getPixelRatio();enabled=controls.enabled;controls.enabled=false;
  document.querySelector('nav').inert=true;document.querySelector('#stage').inert=true;
  const count=Math.max(1,Math.ceil(frames.at(-1).t*FPS));
  try{
   session=(await (await request('/start')).json()).id;
   const factor=SIZE/size.x;
   widths=[...lineMaterials].map(m=>[m,m.linewidth]);for(const [m,w]of widths)m.linewidth=w*factor;
   for(const line of thinLines){
    const geometry=new LineSegmentsGeometry().setPositions(line.geometry.attributes.position.array);
    const mat=new LineMaterial({color:line.material.color,linewidth:factor/dpr,transparent:true,opacity:line.material.opacity,depthTest:line.material.depthTest,depthWrite:false});
    const proxy=new LineSegments2(geometry,mat);proxy.layers.mask=line.layers.mask;proxy.renderOrder=line.renderOrder;line.add(proxy);proxies.push({line,proxy,visible:line.material.visible});line.material.visible=false;
   }
   renderer.setPixelRatio(1);renderer.setSize(SIZE,SIZE,false);
   let index=0;
   for(let i=0;i<count;i++){
    if(cancelled)throw new DOMException('Export cancelled.','AbortError');
    const t=i/FPS;while(index<frames.length-2&&frames[index+1].t<=t)index++;
    const a=frames[index],b=frames[index+1]||a,u=b.t>a.t?T.MathUtils.clamp((t-a.t)/(b.t-a.t),0,1):0;
    apply(a,b,u);for(const {line,proxy}of proxies)proxy.material.opacity=line.material.opacity;
    draw(true);
    const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('Could not render the video frame.');
    await request('/frame/'+session,blob);
    status.textContent=`Exporting 2K MP4 · ${Math.round((i+1)/count*100)}%`;
    if(i%4===0)await yieldUI();
   }
   const result=await request('/finish/'+session);session=null;
   if(cancelled)throw new DOMException('Export cancelled.','AbortError');
   const blob=await result.blob();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);
   download.href=url;download.download=`Train-of-Thoughts-2K-60fps-${Date.now()}.mp4`;download.hidden=false;download.click();
   status.textContent='MP4 ready · 2048 × 2048 · 60 fps';Object.assign(status.dataset,{frames:count,duration:count/FPS,bytes:blob.size,width:SIZE,height:SIZE,fps:FPS});
  }catch(error){status.textContent=error.name==='AbortError'?'Export cancelled.':error.message;if(session)await request('/cancel/'+session).catch(()=>{});}
  finally{
   session=null;for(const [m,w]of widths)m.linewidth=w;widths=[];
   for(const {line,proxy,visible}of proxies){proxy.removeFromParent();proxy.geometry.dispose();proxy.material.dispose();line.material.visible=visible;}proxies=[];
   apply(saved);renderer.setPixelRatio(dpr);renderer.setSize(size.x,size.y,false);controls.enabled=enabled;
   document.querySelector('nav').inert=false;document.querySelector('#stage').inert=false;
   state='idle';status.dataset.state=state;frames=[];bytes=0;cancel.hidden=true;button.disabled=false;button.textContent='● Record · 2K / 60 fps';button.setAttribute('aria-pressed','false');onRestore();
  }
 }
 button.onclick=start;cancel.onclick=()=>cancelled=true;
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='recording')stop();});
 window.addEventListener('resize',()=>{if(state==='recording')stop();});
 window.addEventListener('pagehide',()=>{if(session)fetch(API+'/cancel/'+session,{method:'POST',keepalive:true}).catch(()=>{});if(url)URL.revokeObjectURL(url);});
 return {sample,stop,get state(){return state;}};
}
