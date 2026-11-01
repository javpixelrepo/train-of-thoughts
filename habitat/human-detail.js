import * as T from 'three';

// One Loop subdivision pass on garments: rounded silhouettes, with skin weights
// interpolated by the same stencil as positions. Body/face topology is retained.
function tailoredGeometry(geometry){
  const p=geometry.attributes.position,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight;
  if(!si||!sw||!geometry.index)return geometry;
  const vertices=[],map=new Map(),remap=[];
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    if(!map.has(key)){
      const weights=new Map();for(let j=0;j<4;j++){const joint=si.array[i*4+j];weights.set(joint,(weights.get(joint)||0)+sw.array[i*4+j]);}
      map.set(key,vertices.length);vertices.push({p:new T.Vector3().fromBufferAttribute(p,i),weights,neighbors:new Set(),boundary:[]});
    }
    remap[i]=map.get(key);
  }
  const edges=new Map(),faces=[];
  for(let i=0;i<geometry.index.count;i+=3){
    const ids=[0,1,2].map(j=>remap[geometry.index.getX(i+j)]);if(new Set(ids).size<3)continue;faces.push(ids);
    for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],o=ids[(j+2)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');
      if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(o);vertices[a].neighbors.add(b);vertices[b].neighbors.add(a);}
  }
  for(const e of edges.values())if(e.opposite.length===1){vertices[e.a].boundary.push(e.b);vertices[e.b].boundary.push(e.a);}
  const positions=[],indices=[],weights=[],joints=[];
  function append(stencil){
    const position=new T.Vector3(),blend=new Map();
    for(const [i,w]of stencil){position.addScaledVector(vertices[i].p,w);for(const [j,v]of vertices[i].weights)blend.set(j,(blend.get(j)||0)+v*w);}
    const top=[...blend].filter(a=>a[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,a)=>n+a[1],0);
    positions.push(...position);for(let i=0;i<4;i++){joints.push(top[i]?.[0]||0);weights.push((top[i]?.[1]||0)/sum);}return positions.length/3-1;
  }
  // Keep garment openings on the source's body-mask boundary. Smoothing a
  // neckline/armhole inward would uncover triangles deliberately hidden by it.
  vertices.forEach((v,i)=>{const n=v.neighbors.size,b=n===3?3/16:3/(8*n);append(v.boundary.length?[[i,1]]:[[i,1-n*b],...[...v.neighbors].map(j=>[j,b])]);});
  for(const e of edges.values())e.index=append(e.opposite.length===2?[[e.a,.375],[e.b,.375],...e.opposite.map(j=>[j,.125])]:[[e.a,.5],[e.b,.5]]);
  const edge=(a,b)=>edges.get([Math.min(a,b),Math.max(a,b)].join(':')).index;
  for(const [a,b,c]of faces){const ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));result.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));result.setIndex(indices);result.computeVertexNormals();result.computeBoundingSphere();return result;
}
export function refineHumanAsset(asset){
  asset.scene.traverse(o=>{if(o.isSkinnedMesh&&/suit|ponytail|short01|shoes/i.test(o.name))o.geometry=tailoredGeometry(o.geometry);});
}

export function turnBone(bone,rotation){
  const q=bone.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation).multiply(q));bone.updateWorldMatrix(false,true);
}

// Independent, critically damped channels preserve velocity while a target
// changes (Holden's spring/inertialization principle), instead of lerp snapping.
export class MotionSpring {
  constructor(value=0){this.value=value;this.velocity=0;}
  step(target,dt,halfLife=.09){const w=2*Math.LN2/halfLife,d=this.value-target,j=this.velocity+w*d,e=Math.exp(-w*dt);this.value=target+(d+j*dt)*e;this.velocity=(this.velocity-w*j*dt)*e;return this.value;}
}

export function relaxFingers(person,side,amount=.23){
  const {bones}=person,sign=side==='l'?1:-1;
  const hand=bones[`hand_${side}`],middle=bones[`middle_01_${side}`],index=bones[`index_01_${side}`],pinky=bones[`pinky_01_${side}`];
  const forward=middle.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
  const across=index.getWorldPosition(new T.Vector3()).sub(pinky.getWorldPosition(new T.Vector3())).normalize();
  // Curl in the palm's own plane, including when a wrist turns to hold a cup.
  const inward=new T.Vector3().crossVectors(forward,across).normalize().multiplyScalar(sign);
  for(const name of ['index','middle','ring','pinky']){
    const first=bones[`${name}_01_${side}`],next=bones[`${name}_02_${side}`];if(!first||!next)continue;
    const direction=next.getWorldPosition(new T.Vector3()).sub(first.getWorldPosition(new T.Vector3())).normalize();
    const axis=new T.Vector3().crossVectors(direction,inward).normalize();
    for(const [j,m]of [['01',.65],['02',1],['03',.55]]){const b=bones[`${name}_${j}_${side}`];if(b)turnBone(b,new T.Quaternion().setFromAxisAngle(axis,amount*m));}
  }
  const thumb=bones[`thumb_02_${side}`];if(thumb)turnBone(thumb,new T.Quaternion().setFromAxisAngle(forward,-sign*amount*.35));
}
