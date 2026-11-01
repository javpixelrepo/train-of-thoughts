import * as T from 'three';

// Partition complete primitives, never clip or simplify them. Each partition's
// actual bounds include primitives crossing a cell boundary.
export function splitStaticGeometry(source,primitiveSize,cellSize=32){
 const position=source.attributes.position;
 if(position.count<1024)return [source];
 const bins=new Map();
 for(let i=0;i<position.count;i+=primitiveSize){
  let x=0,y=0,z=0;
  for(let j=0;j<primitiveSize;j++){x+=position.getX(i+j);y+=position.getY(i+j);z+=position.getZ(i+j);}
  const size=primitiveSize*cellSize,key=`${Math.floor(x/size)},${Math.floor(y/size)},${Math.floor(z/size)}`;
  let vertices=bins.get(key);if(!vertices)bins.set(key,vertices=[]);
  for(let j=0;j<primitiveSize;j++)vertices.push(i+j);
 }
 if(bins.size===1)return [source];
 const parts=[];
 for(const vertices of bins.values()){
  const part=new T.BufferGeometry();
  for(const [name,attribute]of Object.entries(source.attributes)){
   const {array,itemSize,normalized}=attribute,result=new array.constructor(vertices.length*itemSize);
   for(let i=0;i<vertices.length;i++)for(let j=0;j<itemSize;j++)result[i*itemSize+j]=array[vertices[i]*itemSize+j];
   part.setAttribute(name,new T.BufferAttribute(result,itemSize,normalized));
  }
  part.computeBoundingBox();part.computeBoundingSphere();parts.push(part);
 }
 source.dispose();return parts;
}

// Reuse only bit-identical vertices, including normals. Unlike a weld with a
// tolerance, this preserves every seam, hard edge and triangle exactly.
export function indexStaticGeometry(source){
 if(source.index)return source;
 const attributes=Object.values(source.attributes),count=source.attributes.position.count;
 const words=attributes.map(a=>new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 const seen=new Map(),vertices=[],indices=new Uint32Array(count);
 for(let i=0;i<count;i++){
  let key='';
  for(let a=0;a<attributes.length;a++){
   const stride=attributes[a].itemSize*attributes[a].array.BYTES_PER_ELEMENT;
   for(let j=0;j<stride;j++)key+=String.fromCharCode(words[a][i*stride+j]);
  }
  let index=seen.get(key);
  if(index===undefined){index=vertices.length;vertices.push(i);seen.set(key,index);}
  indices[i]=index;
 }
 if(vertices.length===count)return source;
 for(const [name,attribute]of Object.entries(source.attributes)){
  const {array,itemSize,normalized}=attribute,result=new array.constructor(vertices.length*itemSize);
  for(let i=0;i<vertices.length;i++)for(let j=0;j<itemSize;j++)result[i*itemSize+j]=array[vertices[i]*itemSize+j];
  source.setAttribute(name,new T.BufferAttribute(result,itemSize,normalized));
 }
 source.setIndex(new T.BufferAttribute(vertices.length<=65535?new Uint16Array(indices):indices,1));
 return source;
}
