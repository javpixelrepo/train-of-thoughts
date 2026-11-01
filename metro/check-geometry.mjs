import assert from 'node:assert/strict';
import * as T from 'three';
import {trainNose,makeWorld,viaductPier,building,TRACK_RISE,CAB_END_X,CAB_PARTITION_X} from './model.js';
const nose=new T.Group();trainNose(nose);nose.updateMatrixWorld(true);
const facade=building(new T.Group(),0,0,6.2,6.2,4,3,0,false,0);facade.updateMatrixWorld(true);
const canopy=facade.getObjectByName('storefront-canopy'),canopyInk=facade.getObjectByName('storefront-canopy-exposed-edges');
assert.ok(new T.Box3().setFromObject(canopy).min.z<3.1,'canopy must join the facade without an air gap');
const edgePositions=canopyInk.geometry.attributes.position;
for(let i=0;i<edgePositions.count;i+=2){
 const a=new T.Vector3().fromBufferAttribute(edgePositions,i),b=new T.Vector3().fromBufferAttribute(edgePositions,i+1);
 assert.ok(Math.abs(a.x-b.x)<.001||a.z>4,'no horizontal ink may cross the canopy/wall joint');
}
const shell=nose.children.find(o=>o.isMesh),ray=new T.Raycaster();
// The cantilever roofs lie exactly on the old window-frame top edges. Check
// actual ink segments there, including all three bays, rather than depth bias.
const coveredFloors=[1,3,5],core=building(new T.Group(),0,0,4.712,4.216,7,3,0,false,null,{front:coveredFloors,left:[1,5],right:[3]});
core.updateMatrixWorld(true);
for(const floor of coveredFloors){
 const top=floor*2.05+1.775;
 core.traverse(o=>{
  if(!o.isLineSegments)return;
  const positions=o.geometry.attributes.position;
  for(let i=0;i<positions.count;i+=2){
   const a=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld),b=new T.Vector3().fromBufferAttribute(positions,i+1).applyMatrix4(o.matrixWorld);
   const front=a.z>2.11&&a.z<2.30&&b.z>2.11&&b.z<2.30&&Math.abs(a.x)<2&&Math.abs(b.x)<2;
   const sign=floor%4===1?-1:1,side=a.x*sign>2.35&&a.x*sign<2.47&&b.x*sign>2.35&&b.x*sign<2.47;
   const touchesJoint=Math.abs(a.y-top)<1e-5&&Math.abs(b.y-top)<1e-5&&(front||side);
   assert.ok(!touchesJoint,'hidden window ink must not lie on the white cantilever roof');
  }
 });
}
for(const [origin,direction]of [[[-8,1,0],[1,0,0]],[[-5.6,.9,5],[0,0,-1]],[[-5.6,.9,-5],[0,0,1]],[[-5.1,5,0],[0,-1,0]],[[-3,1,0],[-1,0,0]]]){
 ray.set(new T.Vector3(...origin),new T.Vector3(...direction));
 assert.ok(ray.intersectObject(shell).length>0,`nose shell missing from ${origin}`);
}
assert.equal(shell.material.opacity,1);assert.equal(shell.material.transparent,false);
const pier=new T.Group(),pierHeight=5.45+TRACK_RISE;viaductPier(pier,0,pierHeight);pier.updateMatrixWorld(true);
const braces=pier.children.filter(o=>o.name==='pier-diagonal-brace');assert.equal(braces.length,2);
for(const brace of braces){
 const positions=brace.geometry.attributes.position,indices=brace.geometry.index.array,edges=new Map();
 for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
  const a=indices[i+j],b=indices[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);
 }
 assert.ok([...edges.values()].every(count=>count===2),'brace must be a closed solid at both connections');
 for(let i=0;i<positions.count;i++){
  assert.ok(Math.abs(positions.getZ(i))>=.98-1e-5,'brace must terminate outside the column');
  assert.ok(Math.abs(positions.getZ(i))<=1.8,'upper brace end must fit below the pier cap');
 }
 const center=new T.Vector3();for(let i=0;i<positions.count;i++)center.add(new T.Vector3().fromBufferAttribute(positions,i));center.divideScalar(positions.count);
 for(const sign of [-1,1]){ray.set(center.clone().add(new T.Vector3(sign,0,0)),new T.Vector3(-sign,0,0));assert.ok(ray.intersectObject(brace,false).length,'both mirrored braces must have outward-facing solid surfaces');}
}
const cutaway=new T.Group();trainNose(cutaway,true);cutaway.updateMatrixWorld(true);
const lining=cutaway.children.find(o=>o.isMesh);
for(const direction of [[0,0,1],[0,0,-1],[-1,0,0]]){
 ray.set(new T.Vector3(-5.2,.93,0),new T.Vector3(...direction));
 assert.ok(ray.intersectObject(lining).length>0,'opened cab must have an inward-facing lining on every exposed side');
}
const errors=[],old=console.error;console.error=(...s)=>errors.push(s.join(' '));
const world=makeWorld();console.error=old;assert.deepEqual(errors,[],'all static geometry must batch successfully');
assert.ok(world.audit.every(a=>a.checked>100&&a.removed<a.checked));
world.root.updateMatrixWorld(true);
assert.equal(world.cab.root.parent,world.train,'cabin must be independent of the first carriage root');
assert.notEqual(world.cab.roof,world.cars[0].userData.roof);
const cabBounds=new T.Box3().setFromObject(world.cab.roof),carBounds=new T.Box3().setFromObject(world.cars[0].userData.roof),firstX=world.cars[0].position.x;
assert.ok(cabBounds.max.x-firstX>CAB_PARTITION_X+.12,'closed cabin roof must cover the entire connecting partition');
assert.ok(Math.abs(carBounds.min.x-firstX-CAB_END_X)<.001,'passenger roof must start beyond the cabin partition');
for(const [x,z]of [[-5.7,0],[-5.4,.65],[-5.4,-.65],[-4.7,.95],[-4.7,-.95],[-4.14,0]]){
 ray.set(world.cars[0].localToWorld(new T.Vector3(x,1.1,z)),new T.Vector3(0,-1,0));
 const deck=ray.intersectObject(world.cab.interior,true).find(h=>h.object.isMesh);
 assert.ok(deck&&Math.abs(world.cars[0].worldToLocal(deck.point.clone()).y-.79)<.002,'shaped cab floor must cover the entire nose footprint');
}
assert.ok(world.motionLayers.slice(0,3).every(layer=>layer.speed===1),'connected bridges, piers and receiving buildings must move together');
const crossings=world.bridges.filter(b=>b.length>20);
assert.equal(crossings.length,8);
let connectedEnds=0;
for(const distance of [0,39.99,40.01,319.99,320.01,1000]){
 world.updateTravel(distance);world.root.updateMatrixWorld(true);
 for(const bridge of crossings)for(const sign of [-1,1]){
  const origin=bridge.frame.localToWorld(new T.Vector3(sign*(bridge.length/2-.6),1,0));
  const direction=new T.Vector3(sign,0,0).transformDirection(bridge.frame.matrixWorld);
  ray.set(origin,direction);ray.far=1;
  const landing=ray.intersectObject(world.city,true).find(hit=>hit.object.isMesh);
  assert.ok(landing&&landing.distance<.61,'crossing must meet a solid entrance at either end, including after wrapping');connectedEnds++;
 }
}
// Every foreground template must recycle outside every allowed orbit,
// including zooming back to 1x while focused at either end of the train.
const nearLayers=world.motionLayers.filter(layer=>layer.name.startsWith('foreground'));
assert.equal(nearLayers.length,5);assert.ok(nearLayers.every(layer=>layer.chunks.length===16));
world.updateTravel(0);world.root.updateMatrixWorld(true);
const camera=new T.OrthographicCamera(-18,18,18,-18,.1,600),frustum=new T.Frustum(),projection=new T.Matrix4();
const initial=new T.Spherical().setFromVector3(new T.Vector3(-35,20.2,43));
let hiddenRecycles=0;
for(const target of [new T.Vector3(0,15.8,0),new T.Vector3(-13.15,18.8,0),new T.Vector3(8.9,18.8,0)]){
 for(const az of [-18,-9,0,9,18])for(const tilt of [-10,-5,0,5,10]){
  const offset=new T.Vector3().setFromSpherical(new T.Spherical(225,initial.phi+T.MathUtils.degToRad(tilt),initial.theta+T.MathUtils.degToRad(az)));
  camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld(true);
  frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  for(const layer of nearLayers)for(const tile of layer.chunks.slice(0,4))for(const edge of [-300,340]){
   const bounds=new T.Box3().setFromObject(tile).translate(new T.Vector3(edge-tile.position.x,0,0)).expandByScalar(2);
   assert.ok(!frustum.intersectsBox(bounds),`visible rooftop recycle: ${layer.name}, ${az}, ${tilt}`);hiddenRecycles++;
  }
 }
}
console.log(JSON.stringify({opaqueNoseDirections:5,cabLiningDirections:3,cabFloorPoints:6,hvacAudit:world.audit,crossingLength:crossings[0].length,connectedEnds,foregroundRows:nearLayers.length,foregroundSpan:640,hiddenRecycles}));
