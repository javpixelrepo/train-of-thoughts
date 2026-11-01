import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {splitStaticGeometry,indexStaticGeometry} from './static-geometry.js';

function primitives(geometry,size){
 const count=geometry.index?.count??geometry.attributes.position.count,records=[];
 for(let i=0;i<count;i+=size){
  const hash=createHash('sha256');
  for(let j=0;j<size;j++){
   const vertex=geometry.index?geometry.index.getX(i+j):i+j;
   for(const name of Object.keys(geometry.attributes).sort()){
    const {array,itemSize}=geometry.attributes[name],stride=itemSize*array.BYTES_PER_ELEMENT;
    hash.update(new Uint8Array(array.buffer,array.byteOffset+vertex*stride,stride));
   }
  }
  records.push(hash.digest('hex'));
 }
 return records.sort();
}
for(const size of [2,3]){
 const pieces=[];
 for(let i=0;i<64;i++){
  const solid=new T.BoxGeometry(i%3+1,8,2).translate(i*2-30,Math.sin(i)*12,(i%4)*9);
  pieces.push(size===2?new T.EdgesGeometry(solid):solid.toNonIndexed());
 }
 const original=mergeGeometries(pieces),before=primitives(original,size),verticesBefore=original.attributes.position.count;
 const parts=splitStaticGeometry(original,size,8);
 if(size===3)parts.forEach(indexStaticGeometry);
 assert.deepEqual(parts.flatMap(p=>primitives(p,size)).sort(),before,'Every original primitive and attribute must survive bit for bit');
 for(const part of parts){
  part.computeBoundingBox();const position=part.attributes.position;
  for(let i=0;i<position.count;i++)assert.ok(part.boundingBox.containsPoint(new T.Vector3().fromBufferAttribute(position,i)),'Bounds must include crossing primitives');
 }
 console.log({primitive:size===2?'line':'triangle',partitions:parts.length,verticesBefore,verticesAfter:parts.reduce((n,p)=>n+p.attributes.position.count,0),geometry:'bit-identical'});
}
