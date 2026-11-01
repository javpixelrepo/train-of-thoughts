// SkeletonUtils clones a palette for every mesh, even when those meshes use
// exactly the same bones and inverse bind matrices. Share only exact matches
// within one resident: skinning and geometry remain identical.
export function shareSkeletons(root){
 const palettes=[];let meshes=0;
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;meshes++;
  const source=mesh.skeleton;
  const match=palettes.find(p=>p.bones.length===source.bones.length&&p.bones.every((b,i)=>b===source.bones[i]&&p.boneInverses[i].equals(source.boneInverses[i])));
  if(match)mesh.skeleton=match;
  else palettes.push(source);
 });
 return {meshes,palettes:palettes.length};
}

