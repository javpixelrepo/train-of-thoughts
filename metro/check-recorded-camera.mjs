import assert from 'node:assert/strict';
import * as T from 'three';
import {cameraTrack} from './recorded-camera.js';

const camera=new T.OrthographicCamera(-18,18,18,-18,.1,600),controls={target:new T.Vector3(0,18,0)};
const track=cameraTrack(camera,controls),radius=225;
camera.position.set(-100,105,181);camera.zoom=5.43;camera.lookAt(controls.target);camera.updateMatrixWorld();camera.updateProjectionMatrix();
const original=camera.matrixWorld.clone(),staticView=track.capture();
for(let i=0;i<=120;i++){
 track.apply(staticView,staticView,i/120);
 assert.ok(camera.matrixWorld.elements.every((v,j)=>Math.abs(v-original.elements[j])<1e-12),'A still camera must stay still at every export subframe');
}
const a=track.capture();camera.position.copy(controls.target).add(new T.Vector3(-100,87,181).applyAxisAngle(new T.Vector3(0,1,0),.08));camera.lookAt(controls.target);const b=track.capture();
assert.ok(new T.Vector3().fromArray(a.position).distanceTo(new T.Vector3().fromArray(b.position))>8,'Exercise the old scenery teleport threshold');
const landmark=new T.Vector3(5,19,1),projections=[];
for(let i=0;i<=60;i++){
 track.apply(a,b,i/60);
 const focus=controls.target.clone().project(camera);
 assert.ok(Math.hypot(focus.x,focus.y)<1e-12,'Orbit interpolation must keep the focus locked to screen center');
 projections.push(landmark.clone().project(camera).multiplyScalar(1024));
}
const steps=projections.slice(1).map((p,i)=>p.distanceTo(projections[i]));
assert.ok(Math.max(...steps)<1,'Camera travel must interpolate even when its world-space displacement exceeds 8 units');
console.log({staticCamera:'stable to 1e-12',focus:'locked',largestLandmarkStepPx:Math.max(...steps),fps:60});
