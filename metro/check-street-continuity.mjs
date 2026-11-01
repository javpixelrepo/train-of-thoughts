import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeWorld} from './model.js';
import {makePassengers} from './passengers.js';
import {makeStreetLife} from './street-life.js';

let seed=Number(process.argv[2]??842631);
const initialSeed=seed;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const model=makeWorld();model.updateTravel(0);
const residents=await makePassengers(model,{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../habitat/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
const life=makeStreetLife(model,residents,{random}),point=new T.Vector3();
const pool=[...life.people,...life.sidewalkPeople],originalRoots=pool.map(p=>p.p.root);
for(const p of residents.people)assert.equal(p.root.getWorldScale(point).y,1,'train scale must remain unchanged');
for(const p of life.people)assert.ok(Math.abs(p.p.root.getWorldScale(point).y-.94)<1e-8);
for(const p of life.sidewalkPeople)assert.ok(Math.abs(p.p.root.getWorldScale(point).y-.89)<1e-8);
const windows=Array.from({length:10},()=>({bridges:0,sidewalks:[0,0],samples:0}));
const reuse=new Map(),directions=new Set(),latestWalker=new Map();
// Ten minutes covers ten scenery-ring wraps. Skip only the expensive pose solve,
// as the live app does offscreen; spawning, routes and contact clocks still run.
for(let frame=0;frame<6000;frame++){
 const time=(frame+1)/10;model.updateTravel(time*5.4);life.update(.1,time*5.4,()=>false);
 const window=windows[Math.min(9,Math.floor(time/60))];window.samples++;
 for(const person of life.people){
  if(!person.active)continue;
  person.p.root.getWorldPosition(point);
  if(Math.abs(point.x)<35&&point.z>-6&&point.z<20)window.bridges++;
  directions.add(person.direction);
  if(latestWalker.get(person)!==person.walker){reuse.set(person,(reuse.get(person)||0)+1);latestWalker.set(person,person.walker);}
  assert.equal(person.p.root.parent,person.bridge.walkFrame);
 }
 for(const person of life.sidewalkPeople){
  if(!person.active)continue;
  person.p.root.getWorldPosition(point);
  if(Math.abs(point.x)<35)window.sidewalks[Number(person.promenade)]++;
 }
}
for(const [i,w] of windows.entries()){
 assert.ok(w.bridges/w.samples>.35,`minute ${i+1}: visible bridge crossings stopped`);
 for(const [side,count] of w.sidewalks.entries())assert.ok(count/w.samples>.45,`minute ${i+1}: sidewalk ${side} is starved`);
}
assert.deepEqual([...life.people,...life.sidewalkPeople].map(p=>p.p.root),originalRoots,'reuse existing models throughout the run');
assert.ok([...reuse.values()].filter(count=>count>3).length>=10,'the resident pool must be reused over multiple scenery wraps');
assert.deepEqual([...directions].sort(),[-1,1]);
console.log(JSON.stringify({seed:initialSeed,minutes:10,scales:[1,.94,.89],windows:windows.map(w=>({bridges:+(w.bridges/w.samples).toFixed(2),sidewalks:w.sidewalks.map(n=>+(n/w.samples).toFixed(2))})),arrivals:life.inspect().pedestrianArrivals,sidewalkArrivals:life.inspect().sidewalkArrivals,poolUsed:reuse.size,directions:[...directions]}));
