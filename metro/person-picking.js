import * as T from 'three';

// Interaction volumes follow the actual bones. Pointer motion must not skin
// hundreds of thousands of rendered vertices on the CPU for every hover.
// These volumes are never added to the scene and do not alter its appearance.
const segments=[
 ['pelvis','spine_03',.18],['spine_03','neck_01',.16],['head','head',.13],
 ...['l','r'].flatMap(s=>[
  [`upperarm_${s}`,`lowerarm_${s}`,.065],[`lowerarm_${s}`,`hand_${s}`,.055],
  [`thigh_${s}`,`calf_${s}`,.10],[`calf_${s}`,`foot_${s}`,.07],
  [`foot_${s}`,`ball_${s}`,.08]
 ])
];
export function makePersonPicker(people){
 const a=new T.Vector3(),b=new T.Vector3(),onRay=new T.Vector3(),onBone=new T.Vector3(),scale=new T.Vector3();
 return (ray,accept)=>{
  let picked=-1,nearest=Infinity;
  for(let i=0;i<people.length;i++){
   const p=people[i];if(!p.root.visible||!accept(p))continue;
   p.root.getWorldScale(scale);const size=Math.max(scale.x,scale.y,scale.z);
   for(const [from,to,r]of segments){
    const first=p.bones[from],last=p.bones[to]||first;if(!first)continue;
    a.setFromMatrixPosition(first.matrixWorld);b.setFromMatrixPosition(last.matrixWorld);
    const radius=r*size,d2=ray.ray.distanceSqToSegment(a,b,onRay,onBone);
    if(d2>radius*radius)continue;
    const distance=Math.max(0,ray.ray.origin.distanceTo(onRay)-Math.sqrt(radius*radius-d2));
    if(distance<ray.near||distance>ray.far||distance>=nearest)continue;
    nearest=distance;picked=i;
   }
  }
  return picked;
 };
}
