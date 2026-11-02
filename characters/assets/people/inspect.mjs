import fs from 'node:fs';
import * as T from '../../../three-deps/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../../three-deps/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const file=fs.readFileSync(new URL('./sam.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
const mixer=new T.AnimationMixer(gltf.scene);
for(const name of ['Idle_Standing','Walk_Relaxed','Sit_Stand']){
  mixer.stopAllAction();const action=mixer.clipAction(gltf.animations.find(a=>a.name===name)).play();
  for(const t of name==='Sit_Stand'?[0,1,2,3,4,5]:[0,1]){
    action.time=t;mixer.update(0);gltf.scene.updateMatrixWorld(true);
    console.log(name,t,Object.fromEntries(['pelvis','head','foot_l','foot_r','hand_l','hand_r'].map(n=>[n,gltf.scene.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray().map(v=>+v.toFixed(3))])));
  }
}
