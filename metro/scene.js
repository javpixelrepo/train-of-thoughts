import * as T from 'three';
import {createRecorder} from './recorder.js?v=4';
import {createScreenshot} from './screenshot.js?v=1';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {makeWorld,TRACK_RISE,CAB_END_X} from './model.js?v=38';
import {stabilizeOutlines} from './outlines.js?v=4';
import {makePassengers} from './passengers.js?v=26';
import {makeStreetLife} from './street-life.js?v=26';
import {makeCarLabels} from './car-labels.js?v=19';
import {makePassengerLabels} from './passenger-labels.js?v=21';
import {PIECE_TITLE,CARRIAGES,CABIN,CAB_VIEW} from './narrative.js?v=7';
import {performanceReadout,cityVisibility,humanVisibility,animationVisibility,warmScene,freezeStaticTransforms} from './performance.js?v=16';
const $=s=>document.querySelector(s),stage=$('#stage'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xfafaf7);stage.append(renderer.domElement);const scene=new T.Scene(),overlay=new T.Scene();scene.fog=new T.Fog(0xfafaf7,168,265);scene.add(new T.HemisphereLight(0xffffff,0xbbbbbb,2.5));const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(-20,40,25);scene.add(sun);const model=makeWorld();scene.add(model.root);
const passengers=await makePassengers(model),labels=makeCarLabels(model,overlay),thoughts=makePassengerLabels(passengers,model,overlay);let animationTime=0,recorder=null;
model.updateTravel(0);const streetLife=makeStreetLife(model,passengers);
stabilizeOutlines(model.root);
freezeStaticTransforms(model,passengers,streetLife);scene.updateMatrix();scene.matrixAutoUpdate=false;
const cullCity=cityVisibility(model.city),cullPeople=humanVisibility(),poseVisible=animationVisibility();scene.matrixWorldAutoUpdate=false;
const camera=new T.OrthographicCamera(-25,25,19,-19,.1,600),controls=new OrbitControls(camera,stage);
const overviewTarget=new T.Vector3(0,15.8,0),cameraOffset=new T.Vector3(-35,20.2,43).normalize().multiplyScalar(225);
// Moving an orthographic camera back preserves framing; shift fog equally.
scene.fog.near+=75;scene.fog.far+=75;
camera.position.copy(overviewTarget).add(cameraOffset);controls.target.copy(overviewTarget);controls.enableDamping=true;controls.enablePan=false;controls.maxZoom=6;controls.mouseButtons.RIGHT=null;controls.update();let selected=-1,paused=reduced,last=performance.now(),distance=0,transition=null,hovered=-1;const opened=model.cars.map(()=>0),ray=new T.Raycaster(),mouse=new T.Vector2(),views=[...CARRIAGES,CABIN];
const hoverGeometry=new LineSegmentsGeometry().setPositions(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)).attributes.position.array);
const hoverOutlines=views.map((_,i)=>{
 const line=new LineSegments2(hoverGeometry,new LineMaterial({color:0x222222,linewidth:1.75,worldUnits:false,transparent:true,opacity:0,depthWrite:false}));
 line.position.set(i===CAB_VIEW?model.cars[0].position.x+(-6.05+CAB_END_X)/2:model.cars[i].position.x+(i===0?(CAB_END_X+4.225)/2:0),8.05+TRACK_RISE,0);
 line.scale.set((i===CAB_VIEW?CAB_END_X+6.05:i===0?4.225-CAB_END_X:8.6)+.20,3.65,3.55);line.renderOrder=5;line.visible=false;scene.add(line);return line;
});
// Keep exploration close to the initial composition, including inside a car.
const initialAzimuth=controls.getAzimuthalAngle(),initialPolar=controls.getPolarAngle();
controls.minZoom=camera.zoom;
controls.minAzimuthAngle=initialAzimuth-T.MathUtils.degToRad(18);
controls.maxAzimuthAngle=initialAzimuth+T.MathUtils.degToRad(18);
controls.minPolarAngle=initialPolar-T.MathUtils.degToRad(10);
controls.maxPolarAngle=initialPolar+T.MathUtils.degToRad(10);
controls.rotateSpeed=.65;
function cameraReadout(){stage.dataset.zoom=camera.zoom.toFixed(3);stage.dataset.azimuth=T.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(2);stage.dataset.polar=T.MathUtils.radToDeg(controls.getPolarAngle()).toFixed(2);}
controls.addEventListener('change',cameraReadout);cameraReadout();
function ui(){document.querySelectorAll('[data-car]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.car===selected)));$('#back').hidden=selected<0;$('#kicker').textContent=selected<0?'PAST · PRESENT · FUTURE':selected===CAB_VIEW?'AT THE CONTROLS':`INSIDE / CAR 0${selected+1}`;$('#title').innerHTML=selected<0?'Where does your<br>mind go?':views[selected].name;$('#description').textContent=selected<0?'Three carriages. Three kinds of time. A city keeps moving while every passenger travels somewhere in their thoughts.':views[selected].description;$('#note').textContent=selected<0?'Click a carriage or the cabin to look inside.':'Click a face bubble to read a thought, or another carriage to explore it.';$('#status').textContent=selected<0?PIECE_TITLE.toUpperCase():views[selected].name.toUpperCase();$('#pause').textContent=paused?'▶ Play':'Ⅱ Pause';$('#pause').setAttribute('aria-pressed',String(paused));}
function focus(i){if(recorder?.state==='exporting')return;perf.interaction();const switching=selected>=0&&i>=0;stage.setAttribute('aria-busy','true');selected=i;hovered=-1;$('#thought-status').textContent='';$('#hover').hidden=true;const x=i<0?0:i===CAB_VIEW?model.cars[0].position.x+model.cab.focusX:model.cars[i].position.x;const target=new T.Vector3(x,i<0?15.8:7.8+TRACK_RISE,0),offset=switching?camera.position.clone().sub(controls.target):cameraOffset.clone();transition={time:0,from:camera.position.clone(),targetFrom:controls.target.clone(),to:target.clone().add(offset),target,zoomFrom:camera.zoom,zoom:i<0?1:i===CAB_VIEW?5.2:2.8};ui();}
function resize(){if(recorder?.state==='exporting')return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);const half=Math.max(18,18/(w/h));camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);document.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>focus(+b.dataset.car));$('#back').onclick=()=>focus(-1);$('#reset').onclick=()=>focus(-1);$('#pause').onclick=()=>{if(recorder?.state==='exporting')return;if(recorder?.state==='recording'){paused=true;recorder.stop();}else paused=!paused;ui();};
function setRay(e){const r=stage.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(mouse,camera);}
const trainPickMeshes=[];model.train.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh){if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();trainPickMeshes.push(o);}});
const visiblePickMeshes=[];
function pick(e){setRay(e);visiblePickMeshes.length=0;for(const mesh of trainPickMeshes){if(mesh.material.opacity<=.1)continue;let visible=true;for(let o=mesh;o;o=o.parent)if(!o.visible){visible=false;break;}if(visible)visiblePickMeshes.push(mesh);}const hit=ray.intersectObjects(visiblePickMeshes,false)[0];if(!hit)return -1;let o=hit.object;while(o&&o.userData.car===undefined)o=o.parent;return o?.userData.car??-1;}
let press=null;stage.addEventListener('pointerdown',e=>{press=e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});stage.addEventListener('pointerup',e=>{if(press&&press.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<5){if(selected>=0){setRay(e);const thought=thoughts.toggle(thoughts.pick(ray));if(thought!==null)$('#thought-status').textContent=thought;else {const i=pick(e);if(i>=0&&i!==selected)focus(i);}}else{const i=pick(e);if(i>=0)focus(i);}}press=null;});stage.addEventListener('pointercancel',()=>press=null);let pendingPointer=null;stage.addEventListener('pointermove',e=>{pendingPointer=e;});function updatePointer(){const e=pendingPointer;if(!e)return;pendingPointer=null;if(e.buttons)return;const car=pick(e);hovered=selected<0?car:-1;const overCar=selected>=0&&car>=0&&car!==selected,overPerson=selected>=0&&!overCar&&thoughts.pick(ray)>=0;stage.style.cursor=hovered>=0||overPerson||overCar?'pointer':'grab';$('#hover').hidden=true;}stage.addEventListener('pointerleave',()=>{pendingPointer=null;hovered=-1;$('#hover').hidden=true;});stage.addEventListener('contextmenu',e=>{e.preventDefault();focus(-1);});stage.addEventListener('keydown',e=>{if(e.key==='Escape')focus(-1);if(e.code==='Space'){e.preventDefault();$('#pause').click();}});controls.addEventListener('start',()=>transition=null);
renderer.autoClear=false;
// Supersample fine architectural edges even on standard-density displays.
renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));
ray.layers.enable(1);
const visibleResidents=[];
function draw(exporting=false){
 scene.updateMatrixWorld();cullCity(camera);if(!exporting){visibleResidents.length=0;for(const p of passengers.people)visibleResidents.push(p);for(const p of streetLife.people)if(p.active)visibleResidents.push(p.p);for(const p of streetLife.sidewalkPeople)if(p.active)visibleResidents.push(p.p);cullPeople(camera,visibleResidents);}
 renderer.clear();camera.layers.set(0);renderer.render(scene,camera);
 // Speech cards share the camera's perspective, with their own depth buffer:
 // cards occlude each other, but carriage outlines never cut through a face.
 if(labels.visible||thoughts.visible){renderer.clearDepth();camera.layers.set(1);renderer.render(overlay,camera);camera.layers.set(0);}
}
opened.push(0);
const panels=[...model.cars.map(car=>[car.userData.roof,car.userData.front]),[model.cab.roof,model.cab.front,model.cab.glazing]].map(pair=>pair.map(g=>{const entries=[];g.traverse(o=>{if(o.material)entries.push({material:o.material,opacity:o.userData.materialOpacity});});return {g,entries};}));
const perf=performanceReadout(stage,renderer);
createScreenshot({renderer,scene,overlay,draw,isBusy:()=>recorder?.state!=='idle'});
recorder=createRecorder({scene,overlay,model,passengers,streetLife,camera,renderer,controls,draw,onRecord(){paused=false;ui();},onRestore(){last=performance.now();paused=true;resize();draw();ui();}});
function tick(now){
 if(recorder?.state==='exporting'){last=now;requestAnimationFrame(tick);return;}
 const frameStart=perf.begin();
 const dt=Math.min((now-last)/1000,.05);last=now;animationTime+=dt;
 if(transition){const t=transition;t.time=Math.min(1,t.time+dt/1.15);const u=t.time*t.time*(3-2*t.time);camera.position.lerpVectors(t.from,t.to,u);controls.target.lerpVectors(t.targetFrom,t.target,u);camera.zoom=T.MathUtils.lerp(t.zoomFrom,t.zoom,u);camera.updateProjectionMatrix();if(t.time===1)transition=null;}
 controls.update();
 poseVisible.prepare(camera);
 passengers.update(paused||reduced?0:dt,poseVisible);
 perf.mark('passengers');
 labels.update(dt,selected<0?hovered:-1,animationTime,camera.zoom);
 thoughts.update(dt,selected,animationTime);
 perf.mark('labels');
 if(!paused){distance+=dt*5.4;model.updateTravel(distance);streetLife.update(dt,distance,poseVisible);for(const w of model.wheels)w.rotation.y=distance/.32;}
 else streetLife.update(0,distance,poseVisible);
 perf.mark('street');
 // Finish closing the previous compartment before revealing the next one.
 const previousClosed=opened.every((amount,i)=>i===selected||amount<.015);
 for(let i=0;i<panels.length;i++){
  const reveal=selected===i&&previousClosed;
  opened[i]=T.MathUtils.damp(opened[i],reveal?1:0,reveal?4.5:18,dt);
  panels[i][0].g.position.y=opened[i]*1.6;panels[i][1].g.position.z=opened[i]*.8;
  for(const {g,entries}of panels[i]){g.visible=opened[i]<.999;for(const e of entries)e.material.opacity=(1-opened[i])*e.opacity;}
 }
 const cabOpen=selected===CAB_VIEW&&opened[CAB_VIEW]>.35;model.cab.shell.visible=!cabOpen;model.cab.cutaway.visible=cabOpen;
 stage.dataset.openPanels=opened.map(v=>v.toFixed(3)).join(',');
 for(const [i,line]of hoverOutlines.entries()){
  const shown=selected<0&&hovered===i;line.material.opacity=T.MathUtils.damp(line.material.opacity,shown?.75:0,shown?9:6,dt);line.visible=line.material.opacity>.002;
 }
 stage.dataset.hoverOpacity=hoverOutlines.map(line=>line.material.opacity.toFixed(3)).join(',');
 perf.mark('controls');updatePointer();perf.mark('picking');
 draw();perf.mark("render");recorder?.sample(now);stage.dataset.selected=selected;stage.dataset.distance=distance.toFixed(2);stage.dataset.traffic=streetLife.vehicles.filter(v=>v.active).length;stage.dataset.bridgeWalkers=streetLife.people.filter(p=>p.active).length;stage.dataset.streetWalkers=streetLife.sidewalkPeople.filter(p=>p.active).length;stage.setAttribute('aria-busy',String(!!transition));perf.end(frameStart);requestAnimationFrame(tick);
}
document.querySelectorAll('[data-car]').forEach(b=>{b.addEventListener('pointerenter',()=>hovered=+b.dataset.car);b.addEventListener('pointerleave',()=>hovered=-1);b.addEventListener('focus',()=>hovered=+b.dataset.car);b.addEventListener('blur',()=>hovered=-1);});
resize();ui();await warmScene(renderer,scene,overlay,camera);
last=performance.now();$('#loading').hidden=true;requestAnimationFrame(tick);
