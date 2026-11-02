import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {shareSkeletons} from './rig-performance.js';

for(const name of ['maya','sam']){
 const bytes=await fs.readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
 const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const body=clone(source.scene),other=clone(source.scene),meshes=[];
 body.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone&&o.name==='spine_01')o.rotation.z+=.2;});
 body.position.set(11,17,-5);body.rotation.y=.7;body.updateMatrixWorld(true);
 const before=meshes.map(m=>{m.skeleton.update();return Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));});
 const previous=new Set(meshes.map(m=>m.skeleton)).size,result=shareSkeletons(body);
 let error=0;
 meshes.forEach((m,j)=>{m.skeleton.update();for(let i=0;i<before[j].length;i++)error=Math.max(error,m.getVertexPosition(i,new T.Vector3()).distanceTo(before[j][i]));});
 assert.equal(error,0,'Every skinned vertex must remain exactly identical');
 shareSkeletons(other);const first=meshes[0].skeleton;
 other.traverse(o=>{if(o.isSkinnedMesh)assert.notEqual(o.skeleton,first,'Different residents must animate independently');});
 console.log({name,palettesBefore:previous,palettesAfter:result.palettes,vertices:before.reduce((n,v)=>n+v.length,0),maxVertexError:error});
}
