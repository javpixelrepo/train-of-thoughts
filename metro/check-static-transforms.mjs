import assert from 'node:assert/strict';
import * as T from 'three';
import {makeWorld} from './model.js';
import {freezeStaticTransforms,cityVisibility} from './performance.js';

const world=makeWorld(),rig=new T.Group(),bone=new T.Bone(),sidewalkFrame=new T.Group(),vehicle=new T.Group(),wheel=new T.Group();
world.cars[0].add(rig);rig.add(bone);world.root.add(sidewalkFrame,vehicle);vehicle.add(wheel);
const street={people:[],sidewalkPeople:[],sidewalkFrame,vehicles:[{root:vehicle,wheels:[wheel]}]},passengers={people:[{root:rig}]};
const nodes=[];world.root.traverse(o=>nodes.push({o,auto:o.matrixAutoUpdate}));
const frozen=freezeStaticTransforms(world,passengers,street);nodes.forEach(n=>n.optimized=n.o.matrixAutoUpdate);
assert.ok(rig.matrixAutoUpdate&&bone.matrixAutoUpdate,'Whole character rigs must keep normal transform updates');
const camera=new T.OrthographicCamera(-18,18,18,-18,.1,600),target=new T.Vector3(0,18.8,0),frustum=new T.Frustum(),projection=new T.Matrix4(),box=new T.Box3();
const cull=cityVisibility(world.city);
let matrixChecks=0,boundsChecks=0;
for(const [frame,distance]of [0,38,80,319.9,320.1,640,900].entries()){
 world.updateTravel(distance);world.cars[1].userData.roof.position.y=frame*.2;world.cab.front.position.z=frame*.1;
 for(const w of world.wheels)w.rotation.y=frame*.4;
 sidewalkFrame.position.x=distance;vehicle.position.x=frame;wheel.rotation.z=frame*.1;rig.position.x=frame*.01;bone.rotation.z=frame*.03;
 nodes.forEach(n=>n.o.matrixAutoUpdate=n.optimized);world.root.updateMatrixWorld();
 const optimized=nodes.map(n=>n.o.matrixWorld.clone());
 nodes.forEach(n=>n.o.matrixAutoUpdate=n.auto);world.root.updateMatrixWorld(true);
 nodes.forEach((n,i)=>{assert.deepEqual(n.o.matrixWorld.elements,optimized[i].elements,`Transform changed at ${n.o.name||n.o.type}`);matrixChecks++;});
 for(const zoom of [1,2.8,6]){
  camera.zoom=zoom;camera.updateProjectionMatrix();camera.position.copy(target).add(new T.Vector3(-35,20.2,43).normalize().multiplyScalar(225));camera.lookAt(target);camera.updateMatrixWorld();
  cull(camera);frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  world.city.traverse(o=>{if(!o.geometry||o.isSkinnedMesh)return;box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).expandByScalar(.25);assert.equal(o.visible,frustum.intersectsBox(box),'Hierarchical culling must agree with original per-object culling');boundsChecks++;});
 }
}
console.log({frozen,matrixChecks,boundsChecks,result:'identical across scrolling, recycling, wheels, cutaways and zoom'});
