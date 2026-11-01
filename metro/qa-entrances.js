import * as T from 'three';
import {building} from './model.js?v=35';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1.5);renderer.setClearColor(0xfafaf7);document.body.append(renderer.domElement);
const scenes=Array.from({length:6},(_,i)=>{
 const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0xbbbbbb,2.5));
 const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(-20,40,25);scene.add(sun);
 building(scene,0,0,4.8,6.2,2,3,0,false,i);
 const pavement=new T.Mesh(new T.BoxGeometry(6.2,.12,1.9),new T.MeshLambertMaterial({color:0xf4f4f1}));pavement.position.set(0,.03,3.9);scene.add(pavement);
 return scene;
});
function render(){
 const w=innerWidth,h=innerHeight-64,cw=w/2,ch=h/3;renderer.setSize(w,h,false);renderer.setScissorTest(true);
 scenes.forEach((scene,i)=>{
  const x=(i%2)*cw,y=(2-Math.floor(i/2))*ch;
  renderer.setViewport(x,y,cw,ch);renderer.setScissor(x,y,cw,ch);
  const span=1.75,camera=new T.OrthographicCamera(-span*cw/ch,span*cw/ch,span,-span,.1,100);
  camera.position.set(-5.2,3.9,14);camera.lookAt(0,1.18,3.3);renderer.render(scene,camera);
 });
 document.body.dataset.ready='true';
}
addEventListener('resize',render);render();
