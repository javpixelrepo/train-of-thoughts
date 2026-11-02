import * as T from 'three';
import { ACTIVITY_CLIPS } from './assets/people/activity-clips.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
export function createActivityCapture(p,mode){
 const clip=ACTIVITY_CLIPS[mode];if(!clip)return null;
 const names=Object.keys(clip.frames[0].rotations),inv=p.root.getWorldQuaternion(Q()).invert();
 const base=Object.fromEntries(names.map(n=>[n,inv.clone().multiply(p.bones[n].getWorldQuaternion(Q()))]));
 return {source:clip.source,sample(time){
  const index=((time%clip.duration)+clip.duration)%clip.duration/clip.duration*clip.count,i=Math.floor(index),u=index-i,a=clip.frames[i],b=clip.frames[i+1];
  const vec=(type,side)=>{
   const previous=clip.frames[(i-1+clip.count)%clip.count][type][side],next=clip.frames[(i+2)%clip.count][type][side];
   const out=[];
   for(let k=0;k<3;k++){const p0=previous[k],p1=a[type][side][k],p2=b[type][side][k],p3=next[k];out[k]=.5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);}
   return V().fromArray(out);
  };
  return {hand:side=>vec('hands',side),elbow:side=>vec('elbows',side),body(){
   const heading=p.root.getWorldQuaternion(Q()),weight=mode==='coffee'?.28:mode==='typing'?.55:.62;
   for(const n of names){
    const delta=Q().fromArray(a.rotations[n]).slerp(Q().fromArray(b.rotations[n]),u);
    // Mirror right-handed capture for the left-handed coffee/painting setup.
    if(mode!=='typing')delta.set(delta.x,-delta.y,-delta.z,delta.w);
    const world=heading.clone().multiply(Q().slerp(delta,weight)).multiply(base[n]),bone=p.bones[n];
    bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(world));bone.updateWorldMatrix(false,true);
   }
  }};
 }};
}
