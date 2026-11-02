import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createWalker } from './locomotion.js';
import { refineHumanAsset } from './human-detail.js';
import { createActivity } from './resident-motion.js';

// The geometry and animation are shared; skeletons and fading materials are not.
// Light direction is world-fixed, so the cel shadows remain coherent when orbiting.
export function celMaterial(name,variant){
  const n=name.toLowerCase();
  let color=0xe8e8e8;
  if(/eyebrow|eyelash|ponytail|short01|hair roots|low-poly/.test(n))color=0x303030;
  else if(/trousers|bottom/.test(n))color=variant%2?0x707070:0x484848;
  else if(/shoes|ankle/.test(n))color=0x414141;
  else if(/top/.test(n))color=variant%3===1?0x9d9d9d:0xf3f3f3;
  const mat=new T.MeshToonMaterial({color});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCelKey;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCelKey = normalize(mat3(viewMatrix) * vec3(-0.5, 1.0, 0.7));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCelKey;').replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`float lightFacing = dot(normal, normalize(vCelKey));
      float cel = 0.38 + 0.29 * smoothstep(-0.12, 0.04, lightFacing) + 0.33 * smoothstep(0.48, 0.60, lightFacing);
      vec3 outgoingLight = diffuseColor.rgb * cel;`);
  };
  mat.customProgramCacheKey=()=> 'habitat-soft-cel-v1';
  return mat;
}
export function outlineMaterial(){
  const mat=new T.MeshBasicMaterial({color:0x252525,side:T.BackSide});
  mat.onBeforeCompile=shader=>{
    const varyings='\nvarying vec3 vOutlineNormal;\nvarying vec3 vOutlineView;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>'+varyings)
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normal * 0.0022;\nvOutlineNormal = normalize(transformedNormal);')
      .replace('#include <project_vertex>','#include <project_vertex>\nvOutlineView = -mvPosition.xyz;');
    // Only draw the silhouette. Inverted surfaces seen through an armhole
    // must not become solid black triangles on the character's shoulder.
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+varyings)
      .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (abs(dot(normalize(vOutlineNormal), normalize(vOutlineView))) > 0.42) discard;');
  };
  mat.customProgramCacheKey=()=> 'habitat-skinned-outline-v2';
  return mat;
}
export async function makeResidents(model,floors){
  const loader=new GLTFLoader();
  const sources=await Promise.all(['maya','sam'].map(n=>loader.loadAsync(new URL(`./assets/people/${n}.glb`,import.meta.url).href)));
  sources.forEach(refineHumanAsset);
  const residents=[];
  function person(parent,kind,variant,mode,floor,room=null){
    const source=sources[kind],root=new T.Group(),body=clone(source.scene);
    root.name=`resident-${residents.length+1}`;root.userData.activity=mode;root.add(body);parent.add(root);
    const meshes=[];body.traverse(o=>{if(o.isMesh)meshes.push(o);});
    for(const mesh of meshes){
      const originalName=mesh.material.name;
      mesh.material=celMaterial(originalName,variant);mesh.frustumCulled=false;mesh.userData.animatedHuman=true;
      if(!/eyebrow|eyelash|low-poly|ankle/i.test(originalName)){
        const edge=mesh.clone(false);edge.material=outlineMaterial();edge.name='human-outline';edge.raycast=()=>{};edge.frustumCulled=false;
        edge.skeleton=mesh.skeleton;edge.bindMatrix.copy(mesh.bindMatrix);edge.bindMatrixInverse.copy(mesh.bindMatrixInverse);edge.userData.animatedHuman=true;mesh.parent.add(edge);
      }
    }
    const mixer=new T.AnimationMixer(body),actions=Object.fromEntries(source.animations.map(a=>[a.name,mixer.clipAction(a)]));
    const item={root,body,mixer,actions,time:variant*.9,bones:{},mode,floor,room};
    body.traverse(o=>{if(o.isBone)item.bones[o.name]=o;});residents.push(item);return item;
  }
  function activity(parent,kind,variant,mode,l,r,options){
    const p=person(parent,kind,variant,mode,l,r);
    p.activity=createActivity(p,{mode,...options,material:color=>{const m=celMaterial('',0);m.color.setHex(color);return m;}});
    return p;
  }
  // Each resident has an activity suited to the actual furniture on that floor.
  const livingIndex=floors[0].rooms.findIndex(s=>s.type==='living'),living=floors[0].rooms[livingIndex];
  activity(model.rooms[0][livingIndex].parts.contents,0,0,'relax',0,livingIndex,
    {x:-.3,z:-(living.d-.28)/2+.35+.23,seat:.57});
  for(const l of [1,5]){
    const b=floors[l].balcony,sign=b.side==='left'?-1:1;
    activity(model.levels[l].getObjectByName('structure'),l===1?1:0,l,'coffee',l,null,
      {x:sign*(4.25+b.depth/2),z:b.z+(b.furnitureOffsetZ||0)+1.02,yaw:Math.PI,seat:.50,floor:.03});
  }
  const studioIndex=floors[2].rooms.findIndex(s=>s.type==='artStudio');
  activity(model.rooms[2][studioIndex].parts.contents,1,7,'painting',2,studioIndex,
    {x:.30,z:1.42,yaw:Math.PI});
  const balcony=floors[3].balcony;
  activity(model.levels[3].getObjectByName('structure'),0,3,'view',3,null,
    {x:-4.25-balcony.depth+.34,z:balcony.z-1.0,yaw:-Math.PI/2,floor:.03});
  const studyIndex=floors[4].rooms.findIndex(s=>s.type==='study'),study=floors[4].rooms[studyIndex];
  activity(model.rooms[4][studyIndex].parts.contents,1,4,'typing',4,studyIndex,
    {x:-.15,z:-(study.d-.28)/2+.35+.82,yaw:Math.PI,seat:.50});
  for(const l of [0,2]){
    const p=person(model.levels[l].getObjectByName('structure'),l===0?1:0,l+2,'walk',l);
    p.walker=createWalker(p,{hallX:floors[l].hall.x,variant:l===2?1:0});p.walker.update(l*1.6);
  }
  function visible(p){for(let o=p.root;o;o=o.parent)if(!o.visible)return false;return true;}
  function update(dt,animate){
    if(!animate)return false;let active=false;
    for(const p of residents){if(!visible(p))continue;active=true;(p.walker||p.activity).update(dt);}
    return active;
  }
  update(0,true);
  return {update,count:residents.length,walkers:residents.filter(p=>p.mode==='walk').map(p=>p.walker),residents};
}
