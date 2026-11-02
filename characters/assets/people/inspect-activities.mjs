import fs from 'node:fs';
import * as T from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
for(const id of ['79_38','79_43','79_85']){
 const {skeleton,clip}=new BVHLoader().parse(fs.readFileSync(new URL(`./cmu-${id}.bvh`,import.meta.url),'utf8'));
 const root=skeleton.bones[0],mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip).play();
 console.log(id,'duration',clip.duration,'dt',clip.tracks[0].times[1]);
 for(let t=.5;t<clip.duration;t+=.5){action.time=t;mixer.update(0);root.updateMatrixWorld(true);
 const hip=root.getWorldPosition(new T.Vector3()).multiplyScalar(.056444);
 const parts=Object.fromEntries(['Head','LeftHand','RightHand'].map(n=>[n,root.getObjectByName(n).getWorldPosition(new T.Vector3()).multiplyScalar(.056444).sub(hip).toArray().map(v=>+v.toFixed(3))]));
 console.log(t.toFixed(1),JSON.stringify(parts));
 }
}
