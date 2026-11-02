import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
import {makePersonPicker} from './person-picking.js';
const root=new T.Group(),cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;c.position.x=i*9;root.add(c);return c;});
const residents=await makePassengers({cars},{loadSource:async name=>{
 const bytes=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}});
residents.update(1/60);root.updateMatrixWorld(true);
const picker=makePersonPicker(residents.people),ray=new T.Raycaster(),rays=[];
for(const [i,p]of residents.people.entries()){
 for(const bone of ['head','spine_03','calf_l']){
  const point=p.bones[bone].getWorldPosition(new T.Vector3());ray.set(point.clone().add(new T.Vector3(0,.02,5)),point.clone().sub(point.clone().add(new T.Vector3(0,.02,5))).normalize());
  assert.equal(picker(ray,candidate=>candidate===p),i,`Pick ${bone} on resident ${i}`);rays.push(ray.clone?.()||new T.Raycaster(ray.ray.origin.clone(),ray.ray.direction.clone()));
 }
}
ray.set(new T.Vector3(100,100,100),new T.Vector3(0,1,0));assert.equal(picker(ray,()=>true),-1);
assert.equal(picker(rays[0],()=>false),-1,'Inactive compartments must not be interactive');
const person=residents.people[0],sample=rays[1];
let t=performance.now();for(let i=0;i<5;i++)sample.intersectObject(person.body,true);const detailedMs=(performance.now()-t)/5;
t=performance.now();for(let i=0;i<1000;i++)picker(sample,p=>p===person);const proxyMs=(performance.now()-t)/1000;
assert.ok(proxyMs<detailedMs);
console.log({rays:rays.length,detailedMs,proxyMs,speedup:detailedMs/proxyMs,renderedGeometry:'unchanged'});
