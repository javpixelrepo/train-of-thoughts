import * as T from 'three';
import {trainNose,balconyGuard,building,viaductPier,TRACK_RISE} from './model.js?v=36';
import {stabilizeOutlines} from './outlines.js?v=4';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1.5);renderer.setClearColor(0xfafaf7);document.body.append(renderer.domElement);
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0xbbbbbb,2.5));const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(-20,40,25);scene.add(sun);
const nose=new T.Group(),balconies=new T.Group(),facade=new T.Group();scene.add(nose,balconies,facade);trainNose(nose);nose.position.x=5;
for(let i=0;i<3;i++){
 const x=(i-1)*3;
 const slab=new T.Mesh(new T.BoxGeometry(2.35,.12,1.3),new T.MeshLambertMaterial({color:0xeeeeeb}));slab.position.set(x,-.06,0);balconies.add(slab);
 slab.add(new T.LineSegments(new T.EdgesGeometry(slab.geometry),new T.LineBasicMaterial({color:0x888888,depthWrite:false})));
 balconyGuard(balconies,x,0,-.6,.6,2.25,i);
}
building(facade,0,0,6.2,6.2,4,3,0,false);
const joint=new T.Group();scene.add(joint);viaductPier(joint,0,5.45+TRACK_RISE);joint.position.y=-(5.45+TRACK_RISE-3);
const wallJoint=new T.Group();scene.add(wallJoint);
building(wallJoint,0,-6.2*.15,6.2*.76,6.2*.68,5,3,0,false,null,{front:[1,3],left:[1],right:[3]});
for(const floor of [1,3]){
 const block=new T.Mesh(new T.BoxGeometry(6.2*.92,1.65,6.2*.88),new T.MeshLambertMaterial({color:0xfafafa,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:2}));
 block.position.set(floor%4===1?-6.2*.08:6.2*.08,floor*2.05+.95,-6.2*.06);wallJoint.add(block);
 block.add(new T.LineSegments(new T.EdgesGeometry(block.geometry),new T.LineBasicMaterial({color:0x6a6a65,depthWrite:false})));
}
stabilizeOutlines(scene);
const camera=new T.OrthographicCamera(-4,4,3,-3,.1,100);let mode='nose',paused=false,time=0,last=performance.now();
function select(value){mode=value;nose.visible=value==='nose';balconies.visible=value==='balcony';facade.visible=value==='facade';joint.visible=value==='joint';wallJoint.visible=value==='wallJoint';document.querySelectorAll('header button:not(#pause)').forEach(b=>b.setAttribute('aria-pressed',String(b.id===value)));resize();}
function resize(){const w=innerWidth,h=innerHeight-document.querySelector('header').offsetHeight;renderer.setSize(w,h);const span=mode==='nose'?1.6:mode==='balcony'?3.8:mode==='joint'?2.2:mode==='wallJoint'?2:5;camera.left=-span*w/h;camera.right=span*w/h;camera.top=span;camera.bottom=-span;camera.position.set(-9,mode==='nose'?6:mode==='balcony'?6:mode==='joint'?5:9,mode==='nose'?8:13);camera.lookAt(0,mode==='nose'?1.5:mode==='balcony'?.4:mode==='joint'?.4:mode==='wallJoint'?4.35:4,mode==='wallJoint'?1.5:0);camera.updateProjectionMatrix();}
for(const name of ['nose','balcony','facade','joint','wallJoint'])document.querySelector('#'+name).onclick=()=>select(name);
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Play':'Pause';};
function draw(now){const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)time+=dt;facade.position.x=mode==='facade'?Math.sin(time*.6)*1.4:0;wallJoint.position.x=mode==='wallJoint'?Math.sin(time*.6)*.3:0;renderer.render(scene,camera);document.querySelector('#status').textContent=mode==='facade'||mode==='wallJoint'?'CONTINUOUS SUBPIXEL MOTION':'LOCAL MODEL';document.body.dataset.ready='true';requestAnimationFrame(draw);}
addEventListener('resize',resize);select('nose');requestAnimationFrame(draw);
