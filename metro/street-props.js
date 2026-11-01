import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared monochrome construction: solid planes, restrained outlines, no textures.
export function makeStreetProps({mesh,box,cyl,rod,group}){
 function line(g,points,r=.009,m=2){for(let i=1;i<points.length;i++)rod(g,points[i-1],points[i],r,m);}
 function panel(g,points,m,normal){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
  const a=new T.Vector3(...points[0]),b=new T.Vector3(...points[1]),c=new T.Vector3(...points[2]);
  const reverse=b.sub(a).cross(c.sub(a)).dot(new T.Vector3(...normal))<0,indices=[];
  for(let i=1;i<points.length-1;i++)indices.push(...(reverse?[0,i+1,i]:[0,i,i+1]));
  geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(g,geometry,0,0,0,m);
 }
 function wheel(g,x,z,side){
  const axle=group(g);axle.name='traffic-wheel';axle.position.set(x,.335,z);
  const tire=mesh(axle,new T.CylinderGeometry(.325,.325,.215,24),0,0,0,3);tire.rotation.x=Math.PI/2;
  const rim=mesh(axle,new T.CylinderGeometry(.245,.245,.025,24),0,0,side*.116,2);rim.rotation.x=Math.PI/2;
  const face=side*.135;
  mesh(axle,new T.TorusGeometry(.236,.012,5,24),0,0,face,0);
  for(let i=0;i<5;i++){
   const angle=i*Math.PI*2/5;
   for(const fork of [-.15,.15])rod(axle,[Math.sin(angle)*.045,Math.cos(angle)*.045,face],[Math.sin(angle+fork)*.218,Math.cos(angle+fork)*.218,face],.014,0);
  }
  const hub=mesh(axle,new T.CylinderGeometry(.052,.052,.035,12),0,0,face,1);hub.rotation.x=Math.PI/2;
 }
 function streetCar(p,x,z,yaw=0){
  const g=group(p);g.name='outlined-five-door-hatchback';g.position.set(x,.04,z);g.rotation.y=yaw;g.scale.setScalar(.8);
  // 4.28 m hatchback, 2.62 m wheelbase, 1.79 m body width. Wheel arches
  // are cut into the shell silhouette instead of painting tyres over a box.
  const s=new T.Shape();s.moveTo(-2.10,.30);s.lineTo(-2.14,.56);s.quadraticCurveTo(-2.14,.76,-1.98,.82);
  s.quadraticCurveTo(-1.45,.95,-.92,.965);s.lineTo(1.86,.965);s.quadraticCurveTo(2.13,.93,2.13,.72);s.lineTo(2.10,.28);
  s.lineTo(1.69,.28);s.absarc(1.31,.335,.385,0,Math.PI,false);s.lineTo(.925,.25);s.lineTo(-.925,.25);
  s.lineTo(-.925,.335);s.absarc(-1.31,.335,.385,0,Math.PI,false);s.lineTo(-1.695,.28);s.closePath();
  const shell=new T.ExtrudeGeometry(s,{depth:1.66,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,steps:1,curveSegments:16});shell.translate(0,0,-.83);mesh(g,shell,0,0,0,0);
  box(g,0,.23,0,2.9,.12,1.2,3);
  // Cabin: compound sloping glasshouse, narrower roof and substantial pillars.
  const sections=[[-.94,.97,.80],[-.32,1.425,.70],[.15,1.465,.69],[1.14,1.445,.70],[1.89,.99,.81]];
  for(let i=1;i<sections.length;i++){
   const [a,ay,aw]=sections[i-1],[b,by,bw]=sections[i];
   panel(g,[[a,ay,-aw],[a,ay,aw],[b,by,bw],[b,by,-bw]],0,[0,1,0]);
   for(const side of [-1,1])panel(g,[[a,.94,side*.83],[b,.94,side*.83],[b,by,side*bw],[a,ay,side*aw]],0,[0,0,side]);
  }
  panel(g,[[-.905,1.012,-.745],[-.905,1.012,.745],[-.325,1.433,.662],[-.325,1.433,-.662]],3,[-1,1,0]);
  panel(g,[[1.21,1.417,-.654],[1.21,1.417,.654],[1.83,1.037,.748],[1.83,1.037,-.748]],3,[1,1,0]);
  for(const side of [-1,1]){
   const at=(x,y,z)=>[x,y,side*z];
   panel(g,[at(-.825,1.002,.827),at(-.275,1.393,.714),at(.355,1.415,.709),at(.355,1.002,.842)],3,[0,0,side]);
   panel(g,[at(.445,1.002,.842),at(.445,1.415,.710),at(1.115,1.397,.719),at(1.715,1.012,.836)],3,[0,0,side]);
   line(g,[at(-.84,.958,.875),at(-.88,.61,.875),at(-.85,.35,.875),at(-.74,.29,.875),at(.39,.29,.875),at(.39,.95,.875)],.007);
   line(g,[at(.43,.95,.875),at(.43,.29,.875),at(.88,.29,.875),at(.95,.47,.875),at(1.15,.68,.875)],.007);
   line(g,[at(-1.92,.79,.866),at(-.80,.83,.876),at(.40,.84,.876),at(1.97,.86,.86)],.006);
   for(const xx of [.15,1.18])box(g,xx,.879,side*.882,.19,.038,.026,2);
   box(g,0,.265,side*.862,1.88,.07,.05,1);
   rod(g,at(-.65,1.02,.80),at(-.61,1.04,.98),.028,3);
   mesh(g,new RoundedBoxGeometry(.245,.12,.16,2,.04),-.60,1.075,side*.99,0);
   box(g,-.59,1.073,side*1.074,.17,.072,.012,3);
   wheel(g,-1.31,side*.81,side);wheel(g,1.31,side*.81,side);
   // Lamps wrap around the corners, with a separate light strip and housing.
   panel(g,[[-2.145,.715,side*.43],[-2.14,.815,side*.43],[-2.04,.823,side*.79],[-2.10,.725,side*.78]],3,[-1,.2,side]);
   rod(g,[-2.151,.79,side*.44],[-2.058,.797,side*.76],.012,0);
   box(g,2.135,.85,side*.61,.024,.13,.38,3);box(g,2.151,.867,side*.61,.012,.025,.30,1);
   box(g,1.99,.85,side*.872,.25,.12,.022,3);box(g,1.99,.87,side*.887,.22,.023,.01,1);
   line(g,[[-1.94,.875,side*.58],[-1.45,.962,side*.63],[-.94,1.005,side*.67]],.007);
  }
  box(g,-2.156,.49,0,.026,.24,1.25,3);for(const y of [.43,.53])box(g,-2.175,y,0,.018,.018,1.18,1);
  box(g,-2.164,.751,0,.028,.035,.82,3);box(g,-2.16,.315,0,.07,.07,1.51,1);
  box(g,2.125,.37,0,.04,.15,1.50,3);box(g,2.153,.48,0,.025,.035,1.31,1);
  for(const xx of [-2.183,2.158]){
   box(g,xx,.60,0,.025,.145,.43,3);box(g,xx+Math.sign(xx)*.015,.60,0,.012,.113,.39,0);
   for(let n=0;n<5;n++)box(g,xx+Math.sign(xx)*.023,.60,(n-2)*.055,.009,.047,.021,2,false);
  }
  line(g,[[2.14,.75,-.47],[2.15,.73,-.47],[2.15,.69,.47],[2.14,.75,.47]],.007);
  box(g,1.17,1.467,0,.21,.065,1.47,0);
  line(g,[[-.85,1.047,-.47],[-.55,1.267,-.12]],.009,2);line(g,[[-.85,1.047,.28],[-.55,1.267,.58]],.009,2);
  line(g,[[1.79,1.081,-.36],[1.58,1.22,.16]],.008,2);
  mesh(g,new T.ConeGeometry(.045,.10,5),.80,1.52,0,2);
  return g;
 }
 function crown(p,x,y,z,sx,sy,sz,m=1){
  // Pointed, folded foliage with radial veins, matching the conifer's linework.
  const g=group(p);g.position.set(x,y,z);g.scale.set(sx,sy,sz);
  mesh(g,new T.ConeGeometry(1,.66,8),0,0,0,m);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   rod(g,[0,.339,0],[Math.sin(a)*.98,-.319,Math.cos(a)*.98],.009,2);
  }
  return g;
 }
 function tree(p,x,z,type=0){
  const g=group(p);g.name=['spreading-canopy','slender-poplar','layered-pine','branching-ornamental'][type%4];g.position.set(x,0,z);
  box(g,0,.07,0,1.15,.14,1.15,1);cyl(g,0,.83,0,.065,1.65,2);
  if(type===0){
   for(let j=0;j<3;j++){const a=j*2.4,xx=Math.sin(a)*.40,zz=Math.cos(a)*.40;rod(g,[0,.85,0],[xx,1.65+j*.16,zz],.033);crown(g,xx,1.75+j*.21,zz,.74-j*.10,.80,.68-j*.08,j%2?4:0);}
   crown(g,0,2.35,0,.40,.60,.39,0);
  }else if(type===1){
   cyl(g,0,1.35,0,.045,2.70,2);
   for(let j=0;j<5;j++)crown(g,Math.sin(j*2)*.06,1.34+j*.39,0,.44-j*.064,1.05,.40-j*.06,j%2?4:0);
  }else if(type===2){
   for(let j=0;j<4;j++)mesh(g,new T.ConeGeometry(.78-j*.15,.95,9),0,1.35+j*.43,0,j%2?1:4);
  }else{
   for(let j=0;j<4;j++){const a=j*2.4,xx=Math.sin(a)*.53,zz=Math.cos(a)*.53,yy=1.65+(j%2)*.45;
    rod(g,[0,.65,0],[xx,yy,zz],.029);rod(g,[xx*.6,1.1,zz*.6],[xx*1.22,yy-.13,zz*1.22],.017);
    crown(g,xx,yy+.15,zz,.49,.68,.43,j%2?4:0);
   }
   crown(g,-.1,2.3,.05,.38,.65,.35,0);
  }
  return g;
 }
 return {streetCar,tree,crown};
}
