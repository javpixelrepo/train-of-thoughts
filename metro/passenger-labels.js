import * as T from 'three';
import {makePersonPicker} from './person-picking.js';
import {STORIES} from './narrative.js?v=6';
const CARD_DEPTH=.065;
function texture(draw,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
export function drawFace(ctx,kind){
 ctx.strokeStyle='#262626';ctx.fillStyle='#262626';ctx.lineWidth=7;ctx.lineCap='round';
 ctx.beginPath();ctx.arc(128,128,92,0,Math.PI*2);ctx.stroke();
 const curve=(ax,ay,bx,by,cx,cy)=>{ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo(bx,by,cx,cy);ctx.stroke();};
 const brow=(ax,ay,bx,by)=>{ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();};
 for(const x of [96,160]){
  if(['sleep','melancholy','sad','nostalgic'].includes(kind))curve(x-11,110,x,118,x+11,112);
  else if(['content','music'].includes(kind))curve(x-11,113,x,101,x+11,113);
  else {ctx.beginPath();ctx.arc(x+(kind==='wonder'?4:0),kind==='hopeful'?103:110,kind==='surprise'?9:5,0,Math.PI*2);ctx.fill();}
 }
 if(kind==='surprise'){ctx.beginPath();ctx.arc(128,157,17,0,Math.PI*2);ctx.stroke();}
 else if(kind==='melancholy')curve(106,167,128,148,150,167);
 else if(kind==='sad')curve(101,172,128,143,155,172);
 else if(kind==='worried'){
  curve(108,168,118,156,128,161);curve(128,161,139,166,150,157);
 }else if(kind==='nostalgic')curve(109,160,132,166,149,153);
 else if(kind==='sleep')brow(114,160,142,160);
 else if(kind==='wonder')curve(116,164,133,153,147,161);
 else if(kind==='content')curve(104,153,128,174,152,153);
 else {ctx.beginPath();ctx.arc(128,134,38,.3,Math.PI-.3);ctx.stroke();}
 if(['melancholy','sad'].includes(kind)){brow(83,94,106,84);brow(150,84,173,94);}
 else if(kind==='worried'){brow(82,96,108,80);brow(148,80,174,96);}
 else if(kind==='hopeful'){curve(83,84,96,76,109,82);curve(147,82,160,76,173,84);}
 else if(kind==='wonder'){brow(83,88,108,88);curve(148,82,161,74,174,81);}
 else if(kind==='focus'){brow(83,87,108,91);brow(148,91,173,87);}
}
export function makePassengerLabels(passengers,model,overlay){
 const pickPerson=makePersonPicker(passengers.people);
 let active=-1,expanded=-1;
 const labels=passengers.people.map((p,i)=>{
  const [name,thought,mood]=STORIES[i%STORIES.length],g=new T.Group();overlay.add(g);g.visible=false;
  const shape=new T.Shape();shape.moveTo(-.5,.1);shape.lineTo(-.08,.1);shape.lineTo(0,-.07);shape.lineTo(.08,.1);shape.lineTo(.5,.1);shape.lineTo(.5,.82);shape.lineTo(-.5,.82);shape.closePath();
  const bgMat=new T.MeshBasicMaterial({color:0xfafaf7,transparent:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const sideMat=new T.MeshBasicMaterial({color:0xd7d7d3,transparent:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const bg=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:CARD_DEPTH,bevelEnabled:false}),[bgMat,sideMat]);g.add(bg);
  const lineMat=new T.LineBasicMaterial({color:0x242424,transparent:true,depthWrite:false});const edge=new T.LineSegments(new T.EdgesGeometry(bg.geometry),lineMat);bg.add(edge);
  const fm=new T.MeshBasicMaterial({map:texture(ctx=>drawFace(ctx,mood),256,256),transparent:true,depthWrite:false,side:T.DoubleSide});
  const icon=new T.Mesh(new T.PlaneGeometry(.55,.55),fm);icon.position.set(0,.47,CARD_DEPTH+.008);g.add(icon);
  const tm=new T.MeshBasicMaterial({map:texture(ctx=>{ctx.fillStyle='#242424';ctx.font='bold 32px monospace';ctx.fillText(name.toUpperCase(),18,48);ctx.font='40px monospace';thought.split('\n').forEach((s,n)=>ctx.fillText(s,18,108+n*42));},640,192),transparent:true,depthWrite:false,side:T.DoubleSide});
  const text=new T.Mesh(new T.PlaneGeometry(2.35,.70),tm);text.position.set(.37,.47,CARD_DEPTH+.01);g.add(text);
  g.traverse(o=>{o.layers.set(1);o.userData.passenger=i;o.renderOrder=30+(o===text||o===icon?2:o===edge?1:0);});
  return {p,g,bg,icon,text,mats:[bgMat,sideMat,lineMat,fm],tm,open:0,alpha:0,name,thought,mood};
 });
 const belongs=(p,view)=>(p.view??p.car)===view;
 function toggle(index){if(!labels[index]||!belongs(labels[index].p,active))return null;expanded=expanded===index?-1:index;return expanded<0?'':`${labels[index].name}: ${labels[index].thought.replace('\n',' ')}`;}
 const head=new T.Vector3();
 return {toggle,labels,get visible(){return labels.some(l=>l.g.visible);},update(dt,selected,time){
  if(active!==selected){active=selected;expanded=-1;}
  labels.forEach((l,i)=>{
   const shown=belongs(l.p,selected);
   l.alpha=T.MathUtils.damp(l.alpha,shown?1:0,10,dt);l.open=T.MathUtils.damp(l.open,shown&&expanded===i?1:0,12,dt);
   l.g.visible=l.alpha>.01;
   if(!l.g.visible)return;
   l.p.bones.head.getWorldPosition(head);
   l.g.position.copy(head);l.g.position.y+=.38+Math.sin(time*2+i)*.035;
   const width=.72+2.55*l.open;l.bg.scale.x=width;l.icon.position.x=-1.22*l.open;
   l.text.visible=l.open>.01;l.tm.opacity=l.alpha*l.open;l.mats.forEach(m=>m.opacity=l.alpha);
  });
 },pick(ray){
  const hit=ray.intersectObjects(labels.filter(l=>belongs(l.p,active)&&l.g.visible).map(l=>l.g),true).find(h=>h.object.isMesh&&(Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material).opacity>.1);
  if(hit)return hit.object.userData.passenger;
  return pickPerson(ray,p=>belongs(p,active));
 }};
}
