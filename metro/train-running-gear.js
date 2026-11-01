import * as T from 'three';

// Stylized monobloc wheel: inset web, raised hub, conical tread and inner
// flange. Keep the original .32 rolling radius and the existing rail gauge.
export function makeTrainRunningGear({mesh,box,cyl,rod,group,batch,ink}){
 const templates=new Map();
 const lathe=points=>new T.LatheGeometry(points.map(([r,y])=>new T.Vector2(r,y)),64);
 const rim=lathe([[.255,-.072],[.332,-.102],[.350,-.096],[.355,-.080],[.348,-.062],[.324,-.050],[.316,.071],[.306,.086],[.262,.086],[.255,.065],[.255,-.072]]);
 const web=lathe([[.091,-.055],[.256,-.065],[.267,-.035],[.267,.065],[.250,.067],[.221,.034],[.124,.028],[.108,.074],[.091,.074],[.091,-.055]]);
 const hub=lathe([[0,-.100],[.095,-.100],[.113,-.072],[.118,.071],[.102,.103],[.078,.113],[0,.113],[0,-.100]]);
 function wheelTemplate(side){
  if(templates.has(side))return templates.get(side);
  const wheel=new T.Group(),parts=group(wheel);parts.rotation.x=side<0?Math.PI:0;
  mesh(parts,rim,0,0,0,2,false);mesh(parts,web,0,0,0,3,false);mesh(parts,hub,0,0,0,2,false);
  const positions=[];
  for(const [r,y]of [[.350,-.096],[.324,-.050],[.306,.087],[.262,.087],[.221,.035],[.118,.072],[.078,.114]]){
   for(let i=0;i<64;i++)for(const a of [i*Math.PI/32,(i+1)*Math.PI/32])positions.push(Math.sin(a)*r,y,Math.cos(a)*r);
  }
  const lines=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)),ink);
  lines.renderOrder=1;parts.add(lines);batch(wheel);templates.set(side,wheel);return wheel;
 }
 const coilPoints=[];
 for(let i=0;i<=48;i++){const a=i/48*Math.PI*6;coilPoints.push(new T.Vector3(Math.cos(a)*.053,i/48*.12-.06,Math.sin(a)*.053));}
 const coil=new T.TubeGeometry(new T.CatmullRomCurve3(coilPoints),48,.011,5,false);
 return function bogie(car,fixed,x,wheels){
  // The frame and axle bearings stay still; only the wheel bodies rotate.
  box(fixed,x,.25,0,.34,.17,2.10,2);
  for(const s of [-1,1]){
   box(fixed,x,.315,s*1.015,1.52,.095,.12,2);
   const suspension=cyl(fixed,x,.345,s*.64,.18,.08,3);
   suspension.name='bogie-secondary-suspension';
  }
  for(const dx of [-.54,.54]){
   rod(fixed,[x+dx,0,-.95],[x+dx,0,.95],.064,3);
   for(const side of [-1,1]){
    const wheel=wheelTemplate(side).clone(true);wheel.name='train-wheel';
    wheel.position.set(x+dx,0,side*.83);wheel.rotation.x=Math.PI/2;
    wheel.userData.rollingRadius=.32;wheel.userData.innerFlangeSide=-side;
    car.add(wheel);wheels.push(wheel);
    // Compact axle box, inspection cover and fasteners, outside the wheel.
    box(fixed,x+dx,.035,side*1.01,.21,.18,.16,2);
    const cover=cyl(fixed,x+dx,.035,side*1.105,.069,.024,1);cover.rotation.x=Math.PI/2;
    for(const xx of [-.069,.069])for(const yy of [-.052,.052]){
     const bolt=cyl(fixed,x+dx+xx,.035+yy,side*1.10,.013,.023,3);bolt.rotation.x=Math.PI/2;
    }
    for(const offset of [-.12,.12]){
     box(fixed,x+dx+offset,.158,side*1.015,.14,.035,.15,2);
     mesh(fixed,coil,x+dx+offset,.235,side*1.015,3,false);
    }
    // Brake shoe follows the tread, carried by the stationary frame.
    box(fixed,x+dx-Math.sign(dx)*.315,.025,side*.83,.07,.19,.14,3);
   }
  }
 };
}
