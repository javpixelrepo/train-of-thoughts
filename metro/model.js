import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeStreetProps} from './street-props.js?v=3';
import {makeEntrances} from './entrances.js?v=1';
import {makeTrainRunningGear} from './train-running-gear.js?v=1';
import {splitStaticGeometry,indexStaticGeometry} from './static-geometry.js';
import {CARRIAGES,CAB_VIEW} from './narrative.js?v=5';
// Constant depth separation only. Slope-scaled offsets exposed buried edges
// on shallow facade faces and changed their visibility during translation.
const mats=[0xfafafa,0xdfdfdc,0xa0a09d,0x454543,0xeeeeeb].map(color=>new T.MeshLambertMaterial({color,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:2}));
const ink=new T.LineBasicMaterial({color:0x6a6a65,depthWrite:false});const geo=new Map(),edge=new Map();
const balconyGlass=new T.MeshBasicMaterial({color:0xbfc5c3,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});
const glassEdge=new T.LineBasicMaterial({color:0xb4b8b5,depthWrite:false});
function geometry(w,h,d){const k=[w,h,d].join();if(!geo.has(k))geo.set(k,new T.BoxGeometry(w,h,d));return geo.get(k);}
function mesh(p,g,x,y,z,m=0,outline=true){const o=new T.Mesh(g,mats[m]);o.position.set(x,y,z);p.add(o);if(outline){if(!edge.has(g))edge.set(g,new T.EdgesGeometry(g,28));const outline=new T.LineSegments(edge.get(g),ink);outline.renderOrder=1;o.add(outline);}return o;}
function box(p,x,y,z,w,h,d,m=0,outline=true){return mesh(p,geometry(w,h,d),x,y,z,m,outline);}
function cyl(p,x,y,z,r,h,m=2){const k=`c:${r}:${h}`;if(!geo.has(k))geo.set(k,new T.CylinderGeometry(r,r,h,10));return mesh(p,geo.get(k),x,y,z,m);}
function rod(p,a,b,r=.025,m=2){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const o=cyl(p,...av.add(bv).multiplyScalar(.5).toArray(),r,delta.length(),m);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
function group(p){const g=new T.Group();p.add(g);return g;}
// Bake static assemblies once to keep city traversal inexpensive.
function batch(root,spatial=false){
 root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),bins=new Map();
 root.traverse(o=>{if(!o.geometry)return;const key=o.material;let list=bins.get(key);if(!list)bins.set(key,list=[]);const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));g.deleteAttribute('uv');if(o.isLine)g.deleteAttribute('normal');list.push(g);});
 root.clear();
 for(const [m,gs]of bins){
  let merged=mergeGeometries(gs);gs.forEach(g=>g.dispose());if(!merged)continue;
  if(m.isLineBasicMaterial){
   // Draw shared slab edges once, with stable depth against their filled faces.
   const seen=new Set(),clean=[],a=merged.attributes.position.array;
   for(let i=0;i<a.length;i+=6){const one=[a[i],a[i+1],a[i+2]].map(v=>Math.round(v*1e5)).join(','),two=[a[i+3],a[i+4],a[i+5]].map(v=>Math.round(v*1e5)).join(','),key=one<two?one+':'+two:two+':'+one;if(seen.has(key))continue;seen.add(key);for(let j=0;j<6;j++)clean.push(a[i+j]);}
   merged.dispose();merged=new T.BufferGeometry();merged.setAttribute('position',new T.Float32BufferAttribute(clean,3));
   for(const part of spatial?splitStaticGeometry(merged,2):[merged]){const outlines=new T.LineSegments(part,m);outlines.renderOrder=1;outlines.matrixAutoUpdate=false;root.add(outlines);}
  }else {
   // Preserve transparent draw order; only opaque city geometry is partitioned.
   for(const part of spatial&&!m.transparent?splitStaticGeometry(merged,3):[merged]){const solid=new T.Mesh(indexStaticGeometry(part),m);solid.matrixAutoUpdate=false;root.add(solid);}
  }
 }
 return root;
}
const depthMaterials=new Map();
function atmosphere(root,amount){root.traverse(o=>{if(!o.material)return;const key=o.material.uuid+':'+amount;if(!depthMaterials.has(key)){const m=o.material.clone();m.color.lerp(new T.Color(0xfafaf7),amount);depthMaterials.set(key,m);}o.material=depthMaterials.get(key);});}
function pipe(p,points,r=.04,m=2){for(let j=1;j<points.length;j++)rod(p,points[j-1],points[j],r,m);}
export const TRACK_RISE=11;
// The rear wall and its full thickness belong to the driver's compartment.
export const CAB_PARTITION_X=-2.98;
export const CAB_END_X=-2.82;
const {streetCar,tree,crown}=makeStreetProps({mesh,box,cyl,rod,group});
const {entrance}=makeEntrances({mesh,box,rod,group,ink});
const trainBogie=makeTrainRunningGear({mesh,box,cyl,rod,group,batch,ink});
export {streetCar,tree};
export function makeTrafficCar(parent){
 const car=streetCar(parent,0,0),wheels=car.children.filter(o=>o.name==='traffic-wheel');
 for(const wheel of wheels){car.remove(wheel);batch(wheel);}
 batch(car);for(const wheel of wheels)car.add(wheel);
 return car;
}
function railing(p,x,y,z,length){for(const h of [.12,.52,.92])rod(p,[x,y+h,z],[x+length,y+h,z],.018);for(let d=0;d<=length+.01;d+=.7)rod(p,[x+d,y,z],[x+d,y+.97,z],.025);}
export function balconyGuard(p,x,y,wallZ,frontZ,width,style){
 if(style!==1){
  // Broad glass panes and a recessed base shoe, including both side returns.
  // No intermediate rails or floor-to-ceiling uprights around the balcony.
  const run=(ax,az,bx,bz)=>{
   const length=Math.hypot(bx-ax,bz-az),angle=-Math.atan2(bz-az,bx-ax),bays=Math.max(1,Math.ceil(length/2.5));
   const shoe=box(p,(ax+bx)/2,y+.035,(az+bz)/2,length,.065,.07,1);shoe.rotation.y=angle;
   for(let i=0;i<bays;i++){
    const t=(i+.5)/bays,pane=new T.Mesh(new T.PlaneGeometry(length/bays-.025,.86),balconyGlass);
    pane.position.set(ax+(bx-ax)*t,y+.50,az+(bz-az)*t);pane.rotation.y=angle;p.add(pane);
    const border=new T.LineSegments(new T.EdgesGeometry(pane.geometry),glassEdge);border.renderOrder=1;pane.add(border);
   }
   if(style===2)rod(p,[ax,y+.945,az],[bx,y+.945,bz],.014,1);
  };
  const left=x-width/2,right=x+width/2;
  run(left,frontZ,right,frontZ);run(left,wallZ,left,frontZ);run(right,wallZ,right,frontZ);
  return;
 }
 const run=(ax,az,bx,bz)=>{
  const length=Math.hypot(bx-ax,bz-az),angle=-Math.atan2(bz-az,bx-ax);
  const parapet=box(p,(ax+bx)/2,y+.45,(az+bz)/2,length,.90,.07,0);parapet.rotation.y=angle;
  const cap=box(p,(ax+bx)/2,y+.91,(az+bz)/2,length,.035,.09,1);cap.rotation.y=angle;
 };
 const left=x-width/2,right=x+width/2;
 run(left,frontZ,right,frontZ);run(left,wallZ,left,frontZ);run(right,wallZ,right,frontZ);
}
export function viaductPier(p,x,h){
 box(p,x,(h-1.4)/2,0,1.4,h-1.4,1.8,1);box(p,x,h-1.45,0,2.6,.55,3.6,0);
 for(const s of [-1,1]){
  // Mitre each brace against the column plate and the underside of the cap.
  // A rotated cylinder buried its end ring inside the column, leaving open ink.
  const wall=.98,ceiling=h-1.725,dy=1.8,dz=.88,length=Math.hypot(dy,dz),r=.20;
  const foot=h-3.4+(wall-.7)*dy/dz,vertices=[],indices=[],sides=10;
  box(p,x,foot,s*.94,.68,1.06,.08,1);
  for(const xx of [-.26,.26])for(const yy of [-.43,.43]){
   const bolt=cyl(p,x+xx,foot+yy,s*.997,.035,.034,2);bolt.rotation.x=Math.PI/2;
  }
  for(const top of [false,true])for(let j=0;j<sides;j++){
   const angle=j*2*Math.PI/sides,ox=Math.cos(angle)*r,oy=-Math.sin(angle)*r*dz/length,oz=Math.sin(angle)*r*dy/length;
   const t=top?(ceiling-(h-3.4)-oy)/dy:(wall-.7-oz)/dz;
   vertices.push(x+ox,h-3.4+oy+dy*t,s*(.7+oz+dz*t));
  }
  for(let j=0;j<sides;j++){
   const k=(j+1)%sides;indices.push(j,k,k+sides,j,k+sides,j+sides);
  }
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);indices.push(sides,sides+j,sides+j+1);}
  // The mirrored brace needs reversed winding to keep every face opaque.
  if(s>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const brace=new T.BufferGeometry();brace.setAttribute('position',new T.Float32BufferAttribute(vertices,3));brace.setIndex(indices);brace.computeVertexNormals();
  mesh(p,brace,0,0,0,1).name='pier-diagonal-brace';
  box(p,x+s*.79,h*.48,0,.12,h*.9,.18,0);
 }
 for(let y=1;y<h-1;y+=2.6)box(p,x,y,.915,1.4,.025,.018,2);
 pipe(p,[[x+.8,.4,1],[x+.8,h-2.1,1],[x+.8,h-2.1,2.3]],.065);
 for(let y=1;y<h-2;y+=1.4)box(p,x+.8,y,1,.20,.1,.20,2);
 box(p,x,.2,0,2.2,.4,2.5,1);
}
function viaduct(p){
 const h=5.45+TRACK_RISE;
 box(p,0,h,0,40,.6,4.7,1);
 for(const s of [-1,1]){
  const z=s*2.25;
  box(p,0,h-.56,z,40,1.15,.24,0);
  for(const y of [h-.04,h-1.1])box(p,0,y,z,40,.10,.40,2);
  railing(p,-20,h+.31,z,40);
  for(let x=-20;x<20;x+=2.5){
   box(p,x,h-.58,z+s*.14,.09,1.06,.08,2);
   for(const yy of [h-.2,h-.92])for(const xx of [x-.14,x+.14]){const bolt=cyl(p,xx,yy,z+s*.2,.035,.025,3);bolt.rotation.x=Math.PI/2;}
  }
  for(let j=0;j<3;j++)rod(p,[-20,h-1.25-j*.16,z],[20,h-1.25-j*.16,z],.045+j*.012,2);
  for(let x=-18;x<20;x+=5){
   box(p,x,h-.65,z+s*.3,.65,.7,.3,1);box(p,x,h-.65,z+s*.47,.47,.48,.025,0);
   pipe(p,[[x,h-.95,z],[x,h-1.7,z],[x+1.2,h-1.7,z]],.035);
   const curve=new T.CatmullRomCurve3([new T.Vector3(x,h-1.3,z),new T.Vector3(x+2,h-2,z),new T.Vector3(x+4.8,h-1.3,z)]);
   mesh(p,new T.TubeGeometry(curve,12,.028,5,false),0,0,0,3,false);
  }
 }
 for(let x=-18;x<20;x+=10)viaductPier(p,x,h);
 for(let x=-20;x<20;x+=.55){
  box(p,x,h+.35,0,.18,.14,2.5,2);
  for(const z of [-.83,.83])box(p,x,h+.45,z,.28,.055,.28,3);
 }
 for(const z of [-.83,.83]){box(p,0,h+.44,z,40,.045,.25,2);box(p,0,h+.51,z,40,.14,.07,2);box(p,0,h+.57,z,40,.07,.14,3);}
 for(const z of [-1.48,1.48]){box(p,0,h+.4,z,40,.08,.2,1);for(let x=-19;x<20;x+=2)box(p,x,h+.46,z,.04,.03,.19,2);}
}
export function trainNose(p,cutaway=false){
 // A chamfered loft narrows towards the bumper; glazing follows the rake.
 const rings=[[-5.92,.72,1.15,.83],[-5.72,.63,1.52,1.06],[-4.65,.65,2.73,1.24],[-4.12,.65,2.73,1.24]];
 if(cutaway)for(const ring of rings)ring[2]=Math.min(ring[2],1.12);
 const vertices=[],indices=[];
 for(const [x,b,t,w]of rings)for(const [y,z]of [[b,-w*.8],[b,w*.8],[b+.15,w],[t-.15,w],[t,w*.8],[t,-w*.8],[t-.15,-w],[b+.15,-w]])vertices.push(x,y,z);
 for(let r=0;r<rings.length-1;r++)for(let j=0;j<8;j++){if(cutaway&&j===4)continue;const a=r*8+j,b=r*8+(j+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
 for(let j=1;j<7;j++)indices.push(0,j+1,j);
 if(cutaway){
  // An actual inner lining and capped rim: the inside of a single-sided skin
  // disappears when the cab is opened, which used to expose the bridge below.
  const inner=vertices.length/3;
  for(let r=0;r<rings.length;r++){
   const [xx,bottom,top,width]=rings[r],x=xx+(r===0?.065:0),b=bottom+.055,t=top-.035,w=width-.065;
   for(const [y,z]of [[b,-w*.8],[b,w*.8],[b+.10,w],[t-.12,w],[t,w*.8],[t,-w*.8],[t-.12,-w],[b+.10,-w]])vertices.push(x,y,z);
  }
  for(let r=0;r<rings.length-1;r++){
   for(let j=0;j<8;j++){if(j===4)continue;const a=inner+r*8+j,b=inner+r*8+(j+1)%8,c=b+8,d=a+8;indices.push(a,d,b,b,d,c);}
   for(const j of [4,5]){const a=r*8+j,b=a+8,ia=inner+a,ib=inner+b;if(j===4)indices.push(a,ia,b,b,ia,ib);else indices.push(a,b,ia,b,ib,ia);}
  }
  for(let j=1;j<7;j++)indices.push(inner,inner+j,inner+j+1);
  indices.push(4,5,inner+4,5,inner+5,inner+4);
 }
 // The ring order looks clockwise from outside. Reverse the skin triangles,
 // and close the rear: back-face culling must never reveal the city through it.
 if(!cutaway)for(let j=1;j<7;j++)indices.push(24,24+j,24+j+1);
 for(let j=0;j<indices.length;j+=3)[indices[j+1],indices[j+2]]=[indices[j+2],indices[j+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();mesh(p,g,0,0,0,0);
 if(cutaway){box(p,-5.91,.72,0,.15,.14,1.35,2);box(p,-6.05,.58,0,.28,.18,.35,3);return;}
 // One uninterrupted windscreen; seals and wiper hardware follow its plane.
 const normal=new T.Vector3(-1.1,.93,0).normalize(),up=new T.Vector3(.93,1.1,0).normalize();
 const glassPoint=(u,v,lift=0)=>new T.Vector3(-5.69+.93*v,1.54+1.1*v,u*(.86+.12*v)).addScaledVector(normal,lift);
 const pane=(points,lift,material)=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(([u,v])=>glassPoint(u,v,lift).toArray()),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(p,g,0,0,0,material);
 };
 pane([[-1,0],[1,0],[1,1],[-1,1]],.008,2);
 pane([[-.955,.025],[.955,.025],[.955,.975],[-.955,.975]],.014,3);
 for(const s of [-1,1]){
  const wiper=group(p);wiper.name=`windscreen-wiper-${s<0?'left':'right'}`;
  const point=(u,v,h=.05)=>glassPoint(u,v,h).toArray();
  // Two parallel links, a hinge, sprung yoke and a separate rubber blade.
  const pivot=glassPoint(s*.63,.075,.043),mount=cyl(wiper,...pivot.toArray(),.047,.035,3);
  mount.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);
  const hinge=glassPoint(s*.43,.44,.057),pin=cyl(wiper,...hinge.toArray(),.026,.025,1);
  pin.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);
  for(const offset of [-.025,.025])rod(wiper,point(s*.63+offset,.08,.065),point(s*.43+offset,.44,.065),.010,2);
  const bladeA=glassPoint(s*.43,.22,.034),bladeB=glassPoint(s*.43,.79,.034);
  const blade=box(wiper,...bladeA.clone().add(bladeB).multiplyScalar(.5).toArray(),.022,bladeA.distanceTo(bladeB),.036,3,false);
  blade.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),up);
  rod(wiper,point(s*.43,.25,.049),point(s*.43,.75,.049),.010,1);
  for(const v of [.29,.65])rod(wiper,point(s*.43,.44,.065),point(s*.43,v,.043),.009,2);
 }
 for(const s of [-1,1]){
  box(p,-5.94,.95,s*.54,.05,.13,.32,4);
  const side=new T.Shape();side.moveTo(-5.43,1.43);side.lineTo(-4.65,2.48);side.lineTo(-4.28,2.48);side.lineTo(-4.28,1.42);side.closePath();
  mesh(p,new T.ShapeGeometry(side),0,0,s*1.255,3).material=new T.MeshLambertMaterial({color:0x454543,side:T.DoubleSide});
 }
 box(p,-5.91,.72,0,.15,.14,1.35,2);box(p,-6.05,.58,0,.28,.18,.35,3);
}
function driverCab(car){
 const root=group(car);root.name='motorman-cabin';root.userData.car=CAB_VIEW;
 const shell=group(root),cutaway=group(root),interior=group(root),roof=group(root),front=group(root),fixed=group(root),glazing=group(root);
 trainNose(shell);trainNose(cutaway,true);cutaway.visible=false;
 const footprint=new T.Shape();
 for(const [i,[x,z]]of [[-5.88,-.71],[-5.67,-.98],[-4.62,-1.16],[-4.09,-1.16],[-4.09,1.16],[-4.62,1.16],[-5.67,.98],[-5.88,.71]].entries())i?footprint.lineTo(x,-z):footprint.moveTo(x,-z);
 footprint.closePath();
 const deck=new T.ExtrudeGeometry(footprint,{depth:.11,bevelEnabled:false});deck.rotateX(-Math.PI/2);
 mesh(interior,deck,0,.68,0,1);
 for(const s of [-1,1])box(interior,-4.91,.65,s*.63,1.85,.18,.12,2);
 // Forward-facing adjustable seat, with a clear footwell beneath the desk.
 cyl(interior,-3.80,.96,0,.10,.34,2);
 box(interior,-3.80,1.19,0,.55,.13,.62,3);
 box(interior,-3.52,1.53,0,.12,.65,.62,2);
 box(interior,-3.52,1.94,0,.12,.20,.39,3);
 for(const z of [-.34,.34]){box(interior,-3.80,1.49,z,.44,.06,.065,2);rod(interior,[-3.64,1.22,z],[-3.64,1.46,z],.023);}
 for(const z of [-.80,.80])box(interior,-4.79,1.04,z,.38,.50,.14,1);
 const panel=box(interior,-4.61,1.34,0,.67,.09,1.85,1);panel.rotation.z=-.14;
 for(const z of [-.47,.38]){
  box(interior,-4.76,1.41,z,.28,.035,.51,3).rotation.z=-.14;
  for(let j=0;j<3;j++)box(interior,-4.83+j*.065,1.44,z,.014,.008,.32-j*.065,j===0?0:2,false);
 }
 for(let j=0;j<4;j++)cyl(interior,-4.47,1.41,-.68+j*.12,.025,.025,j%2?3:0);
 for(const z of [-.29,.29]){
  box(interior,-4.23,1.32,z,.23,.07,.20,2);
  cyl(interior,-4.22,1.37,z,.055,.055,3);
  cyl(interior,-4.22,1.45,z,.017,.14,2);
  cyl(interior,-4.22,1.60,z,.022,.19,3);
  cyl(interior,-4.22,1.699,z,.012,.012,1);
  box(interior,-4.32,.86,z,.23,.08,.18,3).rotation.z=-.15;
 }
 cabPartition(interior);
 mesh(roof,new RoundedBoxGeometry(CAB_END_X+4.225,.25,2.65,2,.10),(CAB_END_X-4.225)/2,2.79,0,0);
 for(const z of [-1.07,1.07])rod(roof,[-3.8,2.97,z],[CAB_END_X,2.97,z],.025);
 // The floor under the connecting door is part of the cabin, too.
 box(fixed,(-4.2+CAB_END_X)/2,.74,0,CAB_END_X+4.2,.1,2.45,0);
 // Closed cabin windows conceal its connecting door when car 01 is opened.
 // Their dark glass is removed only in the driver's own cutaway view.
 const windowEnd=CAB_PARTITION_X-.05,returnEnd=-2.75;
 for(const z of [-1.245,1.245])box(glazing,(-4.175+windowEnd)/2,1.885,z,windowEnd+4.175-.08,1.10,.025,3);
 // Solid side returns seal the rear door to the passenger doorway; opening
 // the cab cannot leave a slit revealing the person in the next compartment.
 for(const z of [-1.25,1.25])box(fixed,(windowEnd+returnEnd)/2,1.73,z,returnEnd-windowEnd,1.90,.10,0);
 box(fixed,(windowEnd+returnEnd)/2,2.70,0,returnEnd-windowEnd,.16,2.50,0);
 for(const part of [shell,cutaway,interior])batch(part);
 return {root,shell,cutaway,interior,roof,front,fixed,glazing,seatX:-3.80,seatHeight:.465,focusX:-4.25};
}
function cabPartition(p){
 const x=CAB_PARTITION_X;
 for(const s of [-1,1]){
  box(p,x,1.73,s*.86,.10,1.90,.76,0);
  box(p,x,1.72,s*.47,.15,1.86,.08,1);
 }
 box(p,x,2.64,0,.12,.10,.90,0);
 box(p,x,1.70,0,.075,1.76,.85,1);
 box(p,x,.80,0,.18,.06,.93,2);
 for(const face of [-1,1]){
  box(p,x+face*.05,2.08,0,.025,.72,.43,3);
  box(p,x+face*.07,2.08,0,.016,.64,.35,4);
  box(p,x+face*.05,.98,0,.016,.22,.73,4);
  box(p,x+face*.06,1.54,.31,.035,.16,.055,2);
  rod(p,[x+face*.095,1.57,.31],[x+face*.095,1.57,.18],.018,3);
  for(const y of [1.05,2.33])cyl(p,x+face*.05,y,-.42,.022,.14,2);
 }
}
function trainDoor(p,x,z){
 // Full-height paired sliding leaves, distinct from the passenger windows.
 // The carriage skin is split around this opening, so it cannot cover the feet.
 const g=group(p);g.position.set(x,0,z);
 for(const s of [-1,1]){
  box(g,s*.705,1.72,0,.10,1.86,.15,0);
  box(g,s*.646,1.72,0,.023,1.80,.10,3);
  box(g,s*.326,1.715,0,.626,1.77,.075,1);
 }
 box(g,0,1.715,0,.025,1.77,.091,3);
 box(g,0,2.675,0,1.60,.13,.16,0);
 box(g,0,2.595,0,1.35,.028,.11,3);
 box(g,0,.79,0,1.50,.075,.24,2);
 for(const zz of [-.075,.075])box(g,0,.834,zz,1.39,.009,.018,3,false);
 for(const face of [-1,1]){
  for(const s of [-1,1]){
   const xx=s*.326;
   mesh(g,new RoundedBoxGeometry(.465,.85,.025,2,.045),xx,2.075,face*.051,3);
   mesh(g,new RoundedBoxGeometry(.397,.778,.015,2,.032),xx,2.075,face*.073,4);
   box(g,xx,.975,face*.048,.53,.22,.016,4);
   box(g,s*.065,1.52,face*.051,.026,.13,.018,2);
  }
  box(g,0,2.675,face*.087,.16,.045,.018,2);
  const ring=cyl(g,.79,1.51,face*.055,.047,.025,3);ring.rotation.x=Math.PI/2;
  const button=cyl(g,.79,1.51,face*.074,.030,.015,0);button.rotation.x=Math.PI/2;
 }
}
function roofEquipment(g,w,d,h,style){
 const top=h+.28,uw=Math.min(1.4,w*.24),ud=Math.min(1.45,d*.27);
 const count=w>3?2:1;
 for(let j=0;j<count;j++){
  const ac=group(g);ac.userData.hvac=true;const x=(j-(count-1)/2)*(uw+.35),z=-d*.23;
  box(ac,x,top+.37,z,uw,.70,ud,1);cyl(ac,x,top+.75,z,Math.min(.3,uw*.28),.06,3);
  for(let q=0;q<6;q++)box(ac,x-uw*.37+q*uw*.148,top+.37,z+ud/2+.02,.025,.46,.025,2);
 }
 if(style===2){
  const n=w>4?3:1,pw=Math.min(1.3,(w-.7)/n-.2),pd=Math.min(.9,d*.24);
  for(let j=0;j<n;j++){
   const x=(j-(n-1)/2)*(pw+.22),z=d*.24;
   box(g,x,top+.12,z,pw,.24,pd,0);
   const pane=box(g,x,top+.34,z,pw,.055,pd,4);pane.rotation.x=.20;
   // Low supports stop below the underside of the inclined pane.
   box(g,x,top+.25,z-pd*.40,pw,.16,.06,0);
  }
 }else if(style===3){
  box(g,0,top+.7,d*.23,w*.44,1.4,d*.30,0).userData.buildingSolid=true;
 }else if(w>2.4&&d>2.5){
  cyl(g,w*.22,top+.63,d*.23,.38,1.2,1);mesh(g,new T.ConeGeometry(.44,.28,12),w*.22,top+1.37,d*.23,2);
 }
 if(w>3)rod(g,[-w/2+.24,top,-d/2+.24],[-w/2+.24,top+2,-d/2+.24],.025);
}
function auditHVAC(root){
 root.updateWorldMatrix(true,true);const solids=[],units=[];
 root.traverse(o=>{if(o.userData.buildingSolid)solids.push(new T.Box3().setFromObject(o).expandByScalar(-.015));if(o.userData.hvac)units.push(o);});
 let removed=0;
 for(const unit of units){const b=new T.Box3().setFromObject(unit);if(solids.some(s=>s.intersectsBox(b))){unit.removeFromParent();removed++;}}
 return {checked:units.length,removed};
}
export function building(p,x,z,w,d,floors,variant,turn=0,roofDetails=true,entranceVariant=null,coveredWindows={}){
 const g=group(p);g.position.set(x,0,z);g.rotation.y=turn;
 const style=variant%5,story=2.05,height=floors*story,guardStyle=(Math.round(w*10)+floors+variant)%3;
 let rw=w,rd=d;
 for(let f=0;f<floors;f++){
  const y=f*story,setback=style===1?Math.min(Math.min(w,d)-2.2,Math.floor(f/3)*.85):0;
  const fw=w-setback,fd=d-setback;rw=fw;rd=fd;
  if(f===0){
   // A real recessed ground floor, with solid side returns and a closed lintel.
   const opening=fw*.84,recess=.38,side=(fw-opening)/2;
   box(g,0,story/2,-recess/2,fw,story,fd-recess,style===3?0:1).userData.buildingSolid=true;
   for(const s of [-1,1])box(g,s*(fw+opening)/4,story/2,fd/2-recess/2,side,story,recess,style===3?0:1).userData.buildingSolid=true;
   box(g,0,1.985,fd/2-recess/2,opening,.13,recess,style===3?0:1).userData.buildingSolid=true;
  }else box(g,0,y+story/2,0,fw,story,fd,style===3?0:1).userData.buildingSolid=true;
  box(g,0,y+.12,0,fw+.18,.18,fd+.18,0);
  const cols=style===2?4:3;
  for(let c=0;c<cols;c++){
   const wx=(c-(cols-1)/2)*fw*.83/cols,ww=fw*.65/cols;
   for(const side of [-1,1]){
    // The ground-floor storefront replaces these windows. Their upper frames
    // used to poke through the entrance canopy as tiny flickering dark slivers.
    if(side===1&&(f===0||coveredWindows.front?.includes(f)))continue;
    const zz=side*(fd/2+.055);
    box(g,wx,y+1.15,zz,ww,style===2?1.5:1.25,.08,3);
    box(g,wx,y+1.15,zz+side*.055,ww-.10,style===2?1.36:1.1,.04,4);
    box(g,wx,y+1.15,zz+side*.09,.035,1.3,.03,2);
    if(style===2)box(g,wx,y+1.2,zz+side*.11,ww,.035,.03,2);
   }
   if(style===0&&f>0){const bw=fw/cols*.78;box(g,wx,y+.35,fd/2+.50,bw,.13,1,0);balconyGuard(g,wx,y+.42,fd/2+.005,fd/2+.96,bw-.05,guardStyle);}
  }
  for(const side of [-1,1])for(let c=0;c<2;c++){
   if(coveredWindows[side<0?'left':'right']?.includes(f))continue;
   box(g,side*(fw/2+.025),y+1.15,(c-.5)*fd*.5,.06,1.25,fd*.28,3);
   box(g,side*(fw/2+.065),y+1.15,(c-.5)*fd*.5,.04,1.12,fd*.24,4);
  }
  if(style===1&&f>0&&f%3===0){balconyGuard(g,0,y+.22,fd/2+.005,fd/2+.39,fw,guardStyle);for(const s of [-1,1]){box(g,s*fw*.35,y+.37,fd/2+.22,.5,.30,.26,1);crown(g,s*fw*.35,y+.65,fd/2+.22,.23,.24,.12);}}
  if(style===3)for(const s of f===0?[-1,1]:[-1,0,1])box(g,s*fw*.45,y+1,fd/2+.13,.16,2.05,.2,0);
  if(style===4&&f>0){box(g,0,y+.25,fd/2+.41,fw,.14,.82,0);balconyGuard(g,0,y+.32,fd/2+.005,fd/2+.78,fw-.06,guardStyle);}
  if(f%2===1){const ac=group(g);ac.userData.hvac=true;box(ac,-fw*.33,y+.66,fd/2+.29,.58,.4,.36,1);for(let n=0;n<5;n++)box(ac,-fw*.33-.22+n*.11,y+.66,fd/2+.48,.025,.29,.025,2);}
 }
 box(g,0,height+.15,0,rw+.3,.22,rd+.3,0);
 for(const s of [-1,1]){box(g,s*rw/2,height+.43,0,.12,.55,rd,0);box(g,0,height+.43,s*rd/2,rw,.55,.12,0);}
 if(roofDetails)roofEquipment(g,rw,rd,height,style);
 if(style===0||style===2)for(let f=0;f<floors-1;f++){
  const yy=f*story,s=f%2?1:-1;
  for(let n=0;n<10;n++)box(g,w/2+.4,yy+n*story/10,s*(-d*.35+n*d*.7/10),.72,.07,.28,2);
  box(g,w/2+.4,yy+story,s*d*.35,.8,.12,.65,0);
  rod(g,[w/2+.76,yy+.85,-s*d*.35],[w/2+.76,yy+story+.85,s*d*.35],.025);
 }
 rod(g,[-w/2+.15,.3,d/2+.24],[-w/2+.15,height,d/2+.24],.04);
 // Mix entrances independently of the upper facade, deterministically per
 // building. Recycled districts keep their architecture without live changes.
 const entry=entranceVariant??Math.abs(Math.round(w*13+d*7+floors*11+variant*17+x*3+z*5))%6;
 // Narrow corner bays need a single usable doorway, not a shrunken shopfront.
 entrance(g,w,d,w<2.6?(entry%2?1:2):entry);
 return g;
}
export function makeWorld(){const root=new T.Group(),city=new T.Group();root.add(city);const chunks=[],audit=[],bridges=[];
const motionLayers=[
 {name:'street',speed:1,chunks},
 // The viaduct, crossings and their receiving buildings form one structure.
 // Depth parallax belongs only to the disconnected distant city layers.
 {name:'foreground',speed:1,chunks:[]},
 {name:'district',speed:1,chunks:[]},
 {name:'distant',speed:.78,chunks:[]},
 {name:'horizon',speed:.62,chunks:[]}
];
function updateTravel(distance){
 for(const layer of motionLayers){const span=layer.chunks.length*40;for(let i=0;i<layer.chunks.length;i++)layer.chunks[i].position.x=T.MathUtils.euclideanModulo(i*40+distance*layer.speed,span)-span/2+20;}
}
function services(g,w,d,h,variant){
 // Exposed risers, offsets, collars and distribution boxes on the facade.
 for(let j=0;j<3;j++){
  const x=-w/2+.24+j*.19,z=d/2+.23+j*.05;
  pipe(g,[[x,.3,z],[x,h*.56,z],[x+.27,h*.56+.3,z],[x+.27,h+.65,z],[x+1,h+.65,z]],.045+j*.008);
  for(let y=1;y<h;y+=2.05){box(g,x,y,z,.22,.09,.15,2);if(j===0)box(g,x+.32,y+.4,z,.42,.5,.24,0);}
 }
 for(let y=2.5;y<h-1;y+=4.1){
  const ac=group(g);ac.userData.hvac=true;
  box(ac,w/2+.17,y,-d*.16,.24,.9,Math.min(1.15,d*.55),1);
  const fan=cyl(ac,w/2+.31,y,-d*.16,.25,.06,3);fan.rotation.z=Math.PI/2;
  for(let j=0;j<6;j++)box(ac,w/2+.35,y-.35+j*.14,-d*.16,.03,.025,Math.min(.95,d*.5),0);
  pipe(g,[[w/2+.3,y-.3,-d*.22],[w/2+.3,y-.7,-d*.22],[w/2+.3,y-.7,d*.3]],.035);
 }
 const roof=h+.3;
 // Roof access ladder with stand-offs, rather than decorative floating lines.
 for(const dx of [-.23,.23])rod(g,[w*.35+dx,.4,d/2+.27],[w*.35+dx,h+.95,d/2+.27],.025);
 for(let y=.5;y<h+.9;y+=.32)rod(g,[w*.35-.23,y,d/2+.27],[w*.35+.23,y,d/2+.27],.018);
}
function architecture(p,x,z,w,d,floors,type,turn=0){
 const g=group(p);g.position.set(x,0,z);g.rotation.y=turn;const h=floors*2.05;
 if(type%6===0){ // Terraced tower with a full-height service spine.
  building(g,-w*.09,0,w*.78,d,floors,1);
  box(g,w*.38,h/2,0,w*.24,h+1,d*.7,0).userData.buildingSolid=true;
  for(let y=.8;y<h;y+=1.1)box(g,w*.38,y,d*.36,w*.11,.4,.04,3);
 }else if(type%6===1){ // Two unequal residential wings on a shared podium.
  building(g,0,0,w,d,2,2,0,false);
  const a=building(g,-w*.28,0,w*.43,d*.85,floors-2,0);a.position.y=4.1;
  const b=building(g,w*.27,-d*.08,w*.40,d*.69,Math.max(2,floors-4),4);b.position.y=4.1;
 }else if(type%6===2){ // Industrial loft and a narrow chimney/service tower.
  building(g,-w*.12,0,w*.76,d,Math.max(3,floors-3),2);
  box(g,w*.38,h/2,-d*.25,w*.22,h,d*.4,1).userData.buildingSolid=true;
  for(let j=0;j<2;j++)cyl(g,w*.34+j*.24,h+.8,-d*.25,.13,2.2,2);
 }else if(type%6===3){ // Offset cantilevered slabs with an exposed structural frame.
  const coreFloors=Math.max(3,floors-2),oddFloors=Array.from({length:coreFloors},(_,f)=>f).filter(f=>f%2===1);
  const covered={front:oddFloors,left:oddFloors.filter(f=>f%4===1),right:oddFloors.filter(f=>f%4===3)};
  // These windows are entirely inside the projecting volumes. Their upper
  // edges coincide with each white roof/platform at y + 1.775, exposing three
  // flickering strokes. Omit those fronts and the covered side of each offset;
  // the opposite, exposed side keeps its windows and full outlines.
  building(g,0,-d*.15,w*.76,d*.68,coreFloors,3,0,true,null,covered);
  for(let f=1;f<floors;f+=2){
   const y=f*2.05,xx=f%4===1?-w*.08:w*.08;
   box(g,xx,y,0,w,.22,d,0);
   box(g,xx,y+.95,-d*.06,w*.92,1.65,d*.88,0).userData.buildingSolid=true;
   box(g,xx,y+.95,d*.38,w*.92,1.65,.12,4);
   for(let c=0;c<6;c++)box(g,xx-w*.43+c*w*.17,y+.95,d*.46,.07,1.8,.12,2);
   balconyGuard(g,xx,y+.12,d*.38,d/2-.035,w-.06,type%3);
  }
  for(const s of [-1,1])box(g,s*w*.43,h/2,-d*.38,.25,h,.28,0);
 }else if(type%6===4){ // Broad masonry block, recessed center and projecting corner bays.
  building(g,0,-d*.10,w,d*.76,Math.max(3,floors-1),4);
  for(const s of [-1,1]){const bay=building(g,s*w*.34,d*.24,w*.27,d*.45,floors,3);services(bay,w*.27,d*.45,h,type);}
 }else{ // Slender office tower over a much wider commercial base.
  building(g,0,0,w,d,2,2,0,false);
  const tower=building(g,-w*.12,-d*.1,w*.63,d*.66,floors-2,3);tower.position.y=4.1;
  for(let c=0;c<5;c++)box(g,-w*.41+c*w*.145,h/2+2,d*.24,.07,h-4,.2,0);
  box(g,-w*.12,h+1,-d*.1,w*.3,1.8,d*.3,1).userData.buildingSolid=true;
 }
 const core=group(g);core.position.set(w*.37,0,-d*.31);
 box(core,0,h/2,0,w*.23,h,d*.4,1).userData.buildingSolid=true;services(core,w*.23,d*.4,h,type);
 return g;
}
function skybridge(p,x,z,y,length,covered=false){
 const g=group(p);g.position.set(x,y,z);g.rotation.y=Math.PI/2;
 bridges.push({frame:g,length,covered});
 box(g,0,0,0,length,.24,1.4,0);
 for(const s of [-1,1]){railing(g,-length/2,.13,s*.67,length);rod(g,[-length/2,-.4,s*.64],[length/2,-.4,s*.64],.045);for(let j=0;j<length;j+=1.2)rod(g,[-length/2+j,-.4,s*.64],[Math.min(length/2,-length/2+j+1.2),0,s*.64],.025);}
 if(covered){box(g,0,2,0,length,.14,1.65,0);for(let j=0;j<=length;j+=1)for(const s of [-1,1])rod(g,[-length/2+j,.1,s*.67],[-length/2+j,2,s*.67],.035);}
}
for(let i=0;i<4;i++){
 const chunk=group(city);chunk.position.x=(i-1)*40;chunks.push(chunk);
 const district=group(chunk),foreground=group(chunk),far=group(chunk),horizon=group(chunk);
 // Scenery tiles are one continuous ground surface. Their hidden boundaries
 // must not draw 120-unit diagonal seams through gaps in the distant skyline.
 box(chunk,0,-.25,-20,40,.45,320,4,false);
 box(chunk,0,.01,5,40,.03,5.6,1);
 box(chunk,0,.035,9.2,40,.12,2.6,0);
 // Continuous promenade between the shopfronts and the viaduct footings.
 box(chunk,0,.035,-3.9,40,.12,4.6,0,false);
 box(chunk,0,.04,-1.65,40,.11,.10,1,false);
 for(let x=-20;x<20;x+=2.5)box(chunk,x,.098,-3.9,.012,.004,4.4,1,false);
 for(let x=-19;x<20;x+=3){box(chunk,x,.035,5,1.3,.012,.08,0,false);for(const z of [2,8])box(chunk,x,.11,z,2.9,.12,.4,0);}
 for(let b=0;b<4;b++){
  const x=-15+b*10,variant=b+i*4;
  const near=architecture(district,x,-10,6.2+(b%3)*.55,6.2,9+(variant%5),variant);
  atmosphere(near,.12);
  const middle=architecture(district,x+1,-27,6.4,6.5,5+(variant%5),variant+3);
  atmosphere(middle,.40);
  // Run through the receiving volumes; silhouettes occlude the bridge naturally
  // instead of leaving a visible cut end at a recessed facade or balcony.
  if((b+i)%2===0)skybridge(district,x-.25,-18.5,4.4+((b+i)%3)*.2,19.4,b===2);
  tree(chunk,x+1,8.45,variant%4);
  rod(chunk,[x,0,2],[x,4,2],.045);rod(chunk,[x,4,2],[x,4,3],.03);box(chunk,x,3.96,3,.2,.1,.5,2);
 }
 // Large near-field rooftops, with their lower storeys cropped by the camera.
 for(let b=0;b<3;b++){
  const x=-13.3+b*13.3,variant=i+b;
  const floors=5+(variant%3),w=10.6,d=9.5;
  const fore=building(foreground,x,32+(b%2)*2,w,d,floors,variant%2===0?0:2,Math.PI);
  services(fore,w,d,floors*2.05,variant);
 }
 // Receding city and two lower transport levels, visible through street canyons.
 for(let b=0;b<3;b++)architecture(far,-14+b*14,-49,5.3+(b%2),6,7+(b*3+i)%9,b+i+1);
 for(let b=0;b<3;b++)building(horizon,-12+b*13,-72,3.7,4.6,6+(b+i)%7,3);
 for(const [z,y]of [[-37,7],[-61,11]]){
  const layer=z<-50?horizon:far;
  box(layer,0,y,z,40,.45,2.5,0);
  for(const zz of [z-1.2,z+1.2])railing(layer,-20,y+.23,zz,40);
  for(let x=-15;x<20;x+=10){box(layer,x,y/2,z,.65,y,1.1,1);rod(layer,[x,y-1.7,z],[x+1.6,y-.2,z],.10);}
 }
 atmosphere(far,.68);
 atmosphere(horizon,.78);
 // Continue across the whole street to an entrance wing physically attached
 // to the foreground block (x=-13.3, z=32), not a freestanding terminal at z=10.
 const crossing=group(district),departure=-23.4,arrival=26.4;
 // Unequal 60/50/20/30-unit intervals, while keeping routes in building gaps.
 crossing.position.x=[0,20,30,10][i];
 skybridge(crossing,-20,(departure+arrival)/2,5.6,arrival-departure+.2,false);
 for(const [x,z,w]of [[-20,-25,2.2],[-19.3,28,3.4]]){
  box(crossing,x,3.9,z,w,7.8,3.2,0).userData.buildingSolid=true;
  box(crossing,x,7.88,z,w+.25,.16,3.45,0);
  const doorZ=z<0?z+1.61:z-1.61;
  box(crossing,-20,6.62,doorZ,1.1,1.8,.03,3);
  box(crossing,-20,6.62,doorZ,.035,1.8,.06,1);
  box(crossing,x,.9,z+1.62,1.1,1.8,.04,3);
 }
 atmosphere(crossing,.32);
 viaduct(chunk);
 audit.push(auditHVAC(chunk));
 // Keep each bridge and its buildings in one layer so parallax never separates
 // their connections. Batch each depth layer independently, once at startup.
 for(const [j,g]of [foreground,district,far,horizon].entries()){
  city.add(g);g.position.x=chunk.position.x;g.name=motionLayers[j+1].name+'-'+i;
  motionLayers[j+1].chunks.push(g);
  g.updateWorldMatrix(true,true);
  const routes=bridges.filter(b=>g.getObjectById(b.frame.id)).map(b=>({b,m:new T.Matrix4().copy(g.matrixWorld).invert().multiply(b.frame.matrixWorld)}));
  batch(g,true);
  for(const {b,m}of routes){b.frame=new T.Group();b.frame.name='bridge-walking-route';m.decompose(b.frame.position,b.frame.quaternion,b.frame.scale);g.add(b.frame);}
 }
 batch(chunk,true);
}
// Reuse the four detailed district geometries in a wider, shared-memory ring.
// The connected city keeps its original phase. Near rooftops have an extra
// 160-unit margin on either side and four more rows toward the viewer.
for(const layer of motionLayers)for(let i=0;i<4;i++){
 const source=layer.chunks[i],copy=source.clone(true);city.add(copy);layer.chunks.push(copy);
 for(const route of bridges.filter(b=>b.frame.parent===source))bridges.push({...route,frame:copy.children[source.children.indexOf(route.frame)]});
}
const foregroundLayer=motionLayers.find(layer=>layer.name==='foreground');
for(let i=0;i<8;i++){
 const copy=foregroundLayer.chunks[i%4].clone(true);city.add(copy);foregroundLayer.chunks.push(copy);
}
for(const depth of [18,36,54,72]){
 const layer={name:`foreground-${depth}`,speed:1,chunks:[]};
 for(const source of foregroundLayer.chunks){const copy=source.clone(true);copy.position.z=depth;copy.name=layer.name;city.add(copy);layer.chunks.push(copy);}
 motionLayers.push(layer);
}
updateTravel(0);
const train=group(root),cars=[],wheels=[];let cab;train.position.y=6.33+TRACK_RISE;
for(let i=0;i<CARRIAGES.length;i++){const car=group(train);car.position.x=(i-(CARRIAGES.length-1)/2)*8.9;car.userData.car=i;cars.push(car);const fixed=group(car),roof=group(car),front=group(car);car.userData.roof=roof;car.userData.front=front;box(fixed,0,.5,0,8.4,.23,2.55,1);box(fixed,i===0?(CAB_END_X+4.1)/2:0,.74,0,i===0?4.1-CAB_END_X:8.2,.1,2.45,0);box(fixed,0,.27,0,5.8,.3,1.6,3);for(const x of [-2.65,2.65])trainBogie(car,fixed,x,wheels);
if(i===0)cab=driverCab(car);
for(const z of [-1.25,1.25]){
 const wall=z>0?front:fixed;
 const spans=i===0?[[-4.175,CAB_PARTITION_X-.05],[-1.25,1.25],[2.75,4.175]]:[[-4.175,-2.75],[-1.25,1.25],[2.75,4.175]];
 for(const [a,b]of spans){
  const skin=i===0&&b<=CAB_END_X?(z>0?cab.front:cab.fixed):wall;
  box(skin,(a+b)/2,1.06,z,b-a,.56,.09,0);
  box(skin,(a+b)/2,2.55,z,b-a,.25,.10,0);
  for(const x of [a+.04,b-.04])box(skin,x,1.885,z,.07,1.10,.10,0);
  box(skin,(a+b)/2,1.365,z,b-a,.045,.12,1);
 }
 box(wall,0,1.885,z,.045,1.10,.10,0);
 for(const x of [-2,2])trainDoor(wall,x,z);
 for(const x of [-3.45,0,3.45]){if(i===0&&x<0)continue;box(fixed,x,1.06,z*.68,1.25,.18,.46,i===1?2:1);box(fixed,x,1.36,z*.89,1.25,.55,.12,1);for(const xx of [-.45,.45])box(fixed,x+xx,.89,z*.68,.065,.3,.065,2);}
}
for(const end of [-4.15,4.15]){if(i===0&&end<0)continue;const x=end;box(fixed,x,1.73,0,.1,1.9,2.48,0);box(fixed,x+Math.sign(x)*.06,1.97,0,.03,1.04,.90,3);box(fixed,x+Math.sign(x)*.08,1.97,0,.02,.94,.78,4);}
const grabObstacles=car.userData.grabObstacles=[];
for(const x of [-2.75,0,2.75]){
 const segment=(a,b,r)=>{rod(fixed,a,b,r);grabObstacles.push({a,b,r});};
 segment([x,.8,.42],[x,2.62,.42],.025);segment([x,2.62,-.95],[x,2.62,.95],.025);
 // Hand loops sit above the seat edges, leaving a continuous clear aisle.
 for(const z of [-.90,.90])for(const dx of [-.18,.18]){
  segment([x+dx,2.62,z],[x+dx,2.355,z],.013);
  mesh(fixed,new T.TorusGeometry(.075,.012,5,12),x+dx,2.28,z,2);
  for(let j=0;j<12;j++){const a=j*Math.PI/6,b=(j+1)*Math.PI/6;grabObstacles.push({a:[x+dx+Math.cos(a)*.075,2.28+Math.sin(a)*.075,z],b:[x+dx+Math.cos(b)*.075,2.28+Math.sin(b)*.075,z],r:.012});}
 }
}
if(i===1){box(fixed,-.7,.96,1.0,.37,.42,.23,2);rod(fixed,[-.7,1.15,1.0],[-.7,1.5,1.0],.025);}
mesh(roof,new RoundedBoxGeometry(i===0?4.225-CAB_END_X:8.45,.25,2.65,2,.10),i===0?(CAB_END_X+4.225)/2:0,2.79,0,0);for(const x of [i===0?-2.10:-2.5,2.5]){box(roof,x,3.02,0,1.35,.28,1.4,1);for(let j=0;j<8;j++)box(roof,x-.48+j*.14,3.17,0,.045,.02,1.05,2);}for(const z of [-1.07,1.07])rod(roof,[i===0?CAB_END_X+.035:-3.8,2.97,z],[3.8,2.97,z],.025);batch(fixed);batch(roof);batch(front);if(i===0){batch(cab.roof);batch(cab.front);batch(cab.fixed);batch(cab.glazing);}for(const movable of i===0?[roof,front,cab.roof,cab.front,cab.glazing]:[roof,front])movable.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.userData.materialOpacity=o.material.opacity;}});if(i<CARRIAGES.length-1){const joint=group(train);joint.position.set(car.position.x+4.45,1.6,0);for(let n=0;n<7;n++)box(joint,(n-3)*.065,0,0,.035,1.9,2.2,2);batch(joint);}}
cab.root.position.x=cars[0].position.x;train.add(cab.root);
return {root,city,chunks,train,cars,cab,wheels,audit,motionLayers,updateTravel,bridges};}
