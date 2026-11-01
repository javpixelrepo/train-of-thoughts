import * as T from 'three';

// Local tailoring of Sam's shirt: a flatter chest plane, softly blended into
// the collar, sides and abdomen. Skeleton, skin weights and sleeves stay intact.
export function tailorMaleShirt(asset){
 asset.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!/Sam.*original top/.test(mesh.material.name))return;
  const geometry=mesh.geometry.clone(),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const w=(1-T.MathUtils.smoothstep(Math.abs(x),.14,.23))*T.MathUtils.smoothstep(y,1.12,1.23)*(1-T.MathUtils.smoothstep(y,1.37,1.48))*T.MathUtils.smoothstep(z,.055,.10);
   const plane=.128-.12*x*x-Math.max(0,y-1.31)*.20;
   p.setZ(i,T.MathUtils.lerp(z,Math.min(z,plane),w*.85));
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh.geometry=geometry;
 });
}
