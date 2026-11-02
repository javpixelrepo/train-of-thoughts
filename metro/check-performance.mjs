import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makePassengers} from './passengers.js';
import {createWalker} from '../characters/locomotion.js?v=3';
const loadSource=async name=>{const data=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');};
async function fixture(){const root=new T.Group();root.position.y=17.33;const cars=[0,1,2].map(i=>{const c=new T.Group();c.userData.car=i;c.position.x=(i-1)*8.9;root.add(c);return c;});return makePassengers({cars},{loadSource});}
const full=await fixture(),culled=await fixture();
for(let i=0;i<240;i++){full.update(1/60);culled.update(1/60,()=>i===239);}
let maxError=0;
for(let i=0;i<full.people.length;i++)for(const [name,bone]of Object.entries(full.people[i].bones)){
 const other=culled.people[i].bones[name];bone.updateWorldMatrix(true,false);other.updateWorldMatrix(true,false);
 for(let j=0;j<16;j++)maxError=Math.max(maxError,Math.abs(bone.matrixWorld.elements[j]-other.matrixWorld.elements[j]));
}
assert.ok(maxError<1e-6,`Offscreen clock changed the visible pose: ${maxError}`);
const floorA=new T.Group(),floorB=new T.Group();floorA.rotation.y=floorB.rotation.y=.7;
const p=full.createHuman(floorA,1),q=culled.createHuman(floorB,1);
const options={hallX:.3,route:{start:-7,speed:.8}};
const a=createWalker(p,options),b=createWalker(q,options);
for(let i=0;i<240;i++){a.update(1/60);b.update(1/60,()=>i===239);}
for(const name of Object.keys(p.bones))assert.ok(p.bones[name].getWorldPosition(new T.Vector3()).distanceTo(q.bones[name].getWorldPosition(new T.Vector3()))<1e-6,'Walker pose must resume at the same contact, without a jump');
const calibration=structuredClone(q.walkCalibration);createWalker(q,options);
assert.deepEqual(q.walkCalibration,calibration,'Respawn must reuse shoe calibration');
console.log({secondsSkipped:4,passengers:11,maxPoseMatrixError:maxError,walkers:'identical at reentry',calibration:'reused'});
