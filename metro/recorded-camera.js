import * as T from 'three';

// Keep the camera out of float32 skeletal data and scenery recycling rules.
// Position and focus are one state: reconstructing their shared view prevents
// independent rotation/translation interpolation from wobbling the train.
export function cameraTrack(camera,controls){
 const target=new T.Vector3();
 return {
  capture(){return {position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),zoom:camera.zoom,projection:[camera.left,camera.right,camera.top,camera.bottom]};},
  apply(a,b=a,u=0){
   for(let i=0;i<3;i++){
    camera.position.setComponent(i,T.MathUtils.lerp(a.position[i],b.position[i],u));
    target.setComponent(i,T.MathUtils.lerp(a.target[i],b.target[i],u));
    camera.up.setComponent(i,T.MathUtils.lerp(a.up[i],b.up[i],u));
   }
   camera.zoom=T.MathUtils.lerp(a.zoom,b.zoom,u);
   [camera.left,camera.right,camera.top,camera.bottom]=a.projection.map((v,i)=>T.MathUtils.lerp(v,b.projection[i],u));
   camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
 };
}
