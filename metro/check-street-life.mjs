import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeWorld} from './model.js?v=33';
import {makePassengers} from './passengers.js?v=21';
import {makeStreetLife} from './street-life.js';

let seed=842631;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const model=makeWorld();model.updateTravel(0);
const residents=await makePassengers(model,{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
const life=makeStreetLife(model,residents,{random}),directions=new Set(),previous=new Map();
assert.equal(model.bridges.length,24);assert.equal(residents.people.length,11);
let minCarGap=Infinity,maxLocalStep=0,minSole=Infinity,maxSkinHeight=0,peakWalkers=0;
const v=()=>new T.Vector3();
for(let frame=0;frame<1350;frame++){
 const time=(frame+1)/30;model.updateTravel(time*5.4);life.update(1/30,time*5.4);model.root.updateMatrixWorld(true);
 const state=life.inspect();assert.ok(state.occupiedBridges<=8);
 assert.ok(state.sidewalkWalkers.length<=10);
 for(const p of state.sidewalkWalkers){assert.ok((p.z>=9.75&&p.z<=10.25)||(p.z>=-4.21&&p.z<=-3.59),'pedestrians must stay in either sidewalk, clear of columns and shopfronts');assert.ok(p.x<97&&Number.isFinite(p.x));}
 peakWalkers=Math.max(peakWalkers,state.walkers.length);
 for(let lane=0;lane<2;lane++){
  const cars=state.vehicles.filter(v=>v.lane===lane).sort((a,b)=>a.x-b.x);
  assert.ok(cars.length<=3,'traffic density must remain low in each lane');
  for(let i=1;i<cars.length;i++){const gap=cars[i].x-cars[i-1].x;minCarGap=Math.min(minCarGap,gap);assert.ok(gap>=22-1e-6,`cars bunch together: ${gap}`);}
  for(const car of cars){assert.equal(car.z,lane===0?3.65:6.35);assert.ok(Number.isFinite(car.speed)&&car.speed>=0);}
 }
 for(const person of life.people){
  if(!person.active)continue;
  directions.add(person.direction);assert.equal(person.p.root.userData.passenger,undefined);
  const pose=person.walker.inspect(),prev=previous.get(person);
  if(prev?.walker===person.walker){const step=pose.position.distanceTo(prev.position);maxLocalStep=Math.max(maxLocalStep,step);assert.ok(step<.05,`walker teleports ${step}`);}
  previous.set(person,{walker:person.walker,position:pose.position.clone()});
  assert.ok(Math.abs(pose.position.x)<=.30&&Math.abs(pose.position.z)<person.bridge.length/2+.6);
  for(const foot of pose.feet){assert.ok(foot.ankle.toArray().every(Number.isFinite));assert.ok(foot.reach<1.02&&foot.ankle.y>0&&foot.ankle.y<.35);}
  if(frame%120===0){
   const bounds=new T.Box3();
   person.p.body.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.name==='human-outline')return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=11)bounds.expandByPoint(person.bridge.walkFrame.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i,v()))));});
   const height=bounds.max.y-bounds.min.y;maxSkinHeight=Math.max(maxSkinHeight,height);minSole=Math.min(minSole,bounds.min.y);
   assert.ok(height<2.1&&height>1.3,`stretched pedestrian: ${height}`);assert.ok(bounds.min.y>-.045,`feet below bridge: ${bounds.min.y}`);
  }
 }
}
const before=JSON.stringify(life.inspect());life.update(0,243);assert.equal(JSON.stringify(life.inspect()),before,'pause must stop all street activity');
const state=life.inspect();assert.ok(state.carArrivals>=3&&state.pedestrianArrivals>12&&state.sidewalkArrivals>4);assert.deepEqual([...directions].sort(),[-1,1]);
console.log(JSON.stringify({seconds:45,bridges:model.bridges.length,carArrivals:state.carArrivals,pedestrianArrivals:state.pedestrianArrivals,sidewalkArrivals:state.sidewalkArrivals,peakWalkers,minCarGap,maxLocalStep,minSole,maxSkinHeight}));
