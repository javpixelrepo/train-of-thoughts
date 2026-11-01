import * as T from 'three';

// Small architectural assemblies, baked with the building into the existing
// city batches. No textures, transparency, extra render passes or live updates.
export function makeEntrances({mesh,box,rod,group,ink}){
 function canopy(p,x,z,width,front=.72,y=1.88){
  const back=z-.14,tip=z+front,half=width/2,lo=y-.055,hi=y+.055;
  box(p,x,y,(back+tip)/2,width,.11,tip-back,0,false).name='storefront-canopy';
  // Only exposed edges: never draw a rear stroke at the wall intersection.
  const a=[];
  for(const yy of [lo,hi]){
   a.push(x-half,yy,tip,x+half,yy,tip);
   for(const xx of [x-half,x+half])a.push(xx,yy,z+.005,xx,yy,tip);
  }
  for(const xx of [x-half,x+half])a.push(xx,lo,tip,xx,hi,tip);
  const lines=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(a,3)),ink);
  lines.name='storefront-canopy-exposed-edges';lines.renderOrder=1;p.add(lines);
 }
 function door(p,x,z,width,{top=1.80,double=width>1.05}={}){
  const bottom=.23,h=top-bottom;
  box(p,x,(top+bottom)/2,z,width,h,.055,3);
  for(const s of [-1,1])box(p,x+s*(width/2+.025),(top+bottom)/2,z+.025,.05,h+.10,.075,1);
  for(const y of [bottom-.025,top+.025])box(p,x,y,z+.025,width+.10,.05,.075,1);
  box(p,x,.36,z+.043,width-.04,.20,.025,2,false);
  if(double)box(p,x,(top+bottom)/2,z+.04,.028,h,.035,1,false);
  for(const s of double?[-1,1]:[1]){
   const handle=x+(double?s*.09:width*.34);
   rod(p,[handle,.82,z+.105],[handle,1.14,z+.105],.018,1);
   for(const y of [.82,1.14])box(p,handle,y,z+.07,.025,.025,.08,2,false);
  }
 }
 function threshold(p,x,z,width,depth=.50){
  box(p,x,.235,z+.10,width,.05,depth,1);
 }
 function plaque(p,x,z){
  box(p,x,1.30,z,.18,.25,.045,2);
  for(const y of [1.34,1.27])box(p,x,y,z+.03,.09,.015,.012,0,false);
 }
 function archShape(radius,spring,bottom){
  const shape=new T.Shape();shape.moveTo(-radius,bottom);shape.lineTo(radius,bottom);
  shape.lineTo(radius,spring);shape.absarc(0,spring,radius,0,Math.PI,false);shape.closePath();return shape;
 }
 function entrance(parent,w,d,variant){
  const p=group(parent),z=d/2,wide=w*.80,doorW=Math.min(1.30,w*.54);
  p.name='building-entrance';p.userData.entranceVariant=variant;
  if(variant===0){
   // A familiar shopfront retained among the more sculptural entrances.
   box(p,0,1.02,z-.17,wide,1.62,.06,3);
   door(p,0,z-.12,doorW);
   for(const s of [-1,1])box(p,s*wide*.39,1.02,z-.12,.035,1.62,.035,1,false);
   canopy(p,0,z,w*.86,.925,1.91);threshold(p,0,z,wide);
  }else if(variant===1){
   // Deep residential portal, with a slim transom and a recessed door.
   const span=Math.min(w*.76,2.25),post=Math.min(.22,w*.065);
   door(p,0,z-.28,Math.min(doorW,span-post*2-.08),{top:1.68});
   box(p,0,1.80,z-.23,span-post*2,.13,.04,4);
   for(const s of [-1,1])box(p,s*(span-post)/2,1.06,z+.13,post,1.82,.70,0);
   box(p,0,1.94,z+.13,span,.16,.70,0);
   threshold(p,0,z,span,.76);plaque(p,span/2+.09,z+.06);
  }else if(variant===2){
   // A solid arched surround with a matching curved fanlight, not a decal.
   const radius=Math.min(.79,w*.33),spring=1.98-radius,inner=radius-.13;
   const surround=archShape(radius,spring,.17);
   surround.holes.push(new T.Path(archShape(inner,spring,.23).getPoints(24)));
   const extrusion=new T.ExtrudeGeometry(surround,{depth:.20,bevelEnabled:false,curveSegments:16});
   mesh(p,extrusion,0,0,z+.015,0);
   mesh(p,new T.ShapeGeometry(archShape(inner,spring,.23),24),0,0,z-.22,3);
   box(p,0,(spring+.23)/2,z-.19,.035,spring-.23,.025,1,false);
   box(p,0,spring-.04,z-.18,inner*2,.035,.03,1,false);
   for(const s of [-1,1])rod(p,[s*.075,.78,z-.10],[s*.075,1.03,z-.10],.018,1);
   threshold(p,0,z,radius*2+.16,.55);plaque(p,radius+.13,z+.04);
  }else if(variant===3){
   // Asymmetric folded canopy and one substantial side blade.
   const dx=-w*.14,span=w*.75;
   door(p,dx,z-.20,Math.min(doorW,span*.55));
   const roof=new T.Shape();roof.moveTo(-span/2,1.83);roof.lineTo(span/2,1.95);
   roof.lineTo(span/2,2.04);roof.lineTo(-span/2,1.92);roof.closePath();
   mesh(p,new T.ExtrudeGeometry(roof,{depth:.84,bevelEnabled:false}),0,0,z-.14,0);
   box(p,-span/2+.07,1.04,z+.16,.14,1.74,.59,0);
   const seatW=w*.22;
   box(p,w*.26,.55,z+.22,seatW,.09,.35,1);
   for(const s of [-1,1])box(p,w*.26+s*seatW*.35,.37,z+.20,.07,.30,.25,2);
   threshold(p,dx,z,Math.min(w*.52,1.65));plaque(p,w*.20,z+.04);
  }else if(variant===4){
   // Chamfered vestibule: angled side lights and a small faceted roof.
   const half=w*.39,center=Math.min(.70,w*.24),tip=z+.40;
   const pane=(ax,az,bx,bz)=>{
    const width=Math.hypot(bx-ax,bz-az),g=group(p);
    g.position.set((ax+bx)/2,0,(az+bz)/2);g.rotation.y=-Math.atan2(bz-az,bx-ax);
    box(g,0,1.04,0,width,1.58,.045,3);
    for(const yy of [.25,1.83])box(g,0,yy,.03,width,.045,.045,1);
   };
   pane(-half,z-.12,-center,tip);pane(center,tip,half,z-.12);
   door(p,0,tip,center*2-.10,{top:1.80});
   for(const [x,zz]of [[-half,z-.12],[-center,tip],[center,tip],[half,z-.12]])box(p,x,1.04,zz,.055,1.67,.07,1);
   const footprint=new T.Shape();footprint.moveTo(-half-.08,-z+.18);footprint.lineTo(half+.08,-z+.18);
   footprint.lineTo(half+.08,-z-.04);footprint.lineTo(center+.08,-tip-.13);
   footprint.lineTo(-center-.08,-tip-.13);footprint.lineTo(-half-.08,-z-.04);footprint.closePath();
   const cap=mesh(p,new T.ExtrudeGeometry(footprint,{depth:.10,bevelEnabled:false}),0,1.86,0,0);cap.rotation.x=-Math.PI/2;
   threshold(p,0,tip,center*2+.12,.36);
  }else{
   // Open portico: one entrance, a side window and an integrated low bench.
   const span=w*.78,dx=-span*.23;
   door(p,dx,z-.25,Math.min(.95,span*.40));
   box(p,span*.25,1.20,z-.24,span*.36,1.10,.045,3);
   for(const s of [-1,1])box(p,s*(span/2-.075),1.04,z+.25,.15,1.76,.25,0);
   canopy(p,0,z,span+.18,.64,1.94);
   box(p,span*.25,.56,z+.21,span*.35,.10,.39,1);
   box(p,span*.25,.38,z+.18,span*.29,.26,.26,0);
   threshold(p,dx,z,Math.min(1.25,span*.47));plaque(p,-span*.03,z+.05);
  }
  return p;
 }
 return {entrance};
}
