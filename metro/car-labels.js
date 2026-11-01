import * as T from 'three';
import {CARRIAGES,CAB_VIEW} from './narrative.js?v=7';
const NAMES=[...CARRIAGES.map(c=>c.name.toUpperCase()),'MOTORMAN’S CABIN'];
export function makeCarLabels(model,overlay){
 const labels=[...model.cars,model.cab.root].map((car,i)=>{
  const g=new T.Group();overlay.add(g);const anchor=car.getWorldPosition(new T.Vector3());anchor.x+=i===CAB_VIEW?model.cab.focusX:0;
  const shape=new T.Shape();shape.moveTo(-2.2,.1);shape.lineTo(-.25,.1);shape.lineTo(0,-.25);shape.lineTo(.25,.1);shape.lineTo(2.2,.1);shape.lineTo(2.2,1.05);shape.lineTo(-2.2,1.05);shape.closePath();
  const mat=new T.MeshBasicMaterial({color:0xfafaf7,transparent:true,opacity:0,side:T.DoubleSide});
  g.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false}),mat));
  const lineMat=new T.LineBasicMaterial({color:0x242424,transparent:true,opacity:0});
  g.add(new T.LineSegments(new T.EdgesGeometry(g.children[0].geometry),lineMat));
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=180;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#242424';ctx.font='500 21px monospace';ctx.fillText(`${i===CAB_VIEW?'CAB':`0${i+1}`}  /  EXPLORE`,24,43);ctx.font='bold 49px monospace';ctx.fillText(NAMES[i],24,120,550);ctx.font='30px monospace';ctx.fillText('↗',590,120);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const textMat=new T.MeshBasicMaterial({map:texture,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false});
  const text=new T.Mesh(new T.PlaneGeometry(4.4,.94),textMat);text.position.set(0,.58,.062);g.add(text);
  // Vertical card aligned with the carriage, so it shares the world projection.
  g.traverse(o=>o.layers.set(1));g.rotation.y=0;g.visible=false;
  return {g,anchor,mats:[mat,lineMat,textMat],amount:0};
 });
 return {get visible(){return labels.some(l=>l.g.visible);},update(dt,hovered,time,zoom=1){labels.forEach((l,i)=>{
  l.amount=T.MathUtils.damp(l.amount,hovered===i?1:0,11,dt);
  l.g.visible=l.amount>.004;
  l.g.position.copy(l.anchor);l.g.position.y+=4.35+.30*l.amount+Math.sin(time*2.6+i)*.10*l.amount;
  l.g.scale.setScalar(1.2*(1.40+.20*l.amount)/Math.max(1,zoom));l.mats.forEach(m=>m.opacity=l.amount);
 });}};
}
