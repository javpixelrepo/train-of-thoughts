import * as T from 'three';
import {streetCar,tree} from './model.js?v=15';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1.5);renderer.setClearColor(0xfafaf7);document.body.append(renderer.domElement);
function scene(){const s=new T.Scene();s.add(new T.HemisphereLight(0xffffff,0xbbbbbb,2.5));const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(-20,40,25);s.add(sun);return s;}
const carScene=scene();streetCar(carScene,0,0);const trees=scene();for(let i=0;i<4;i++)tree(trees,(i-1.5)*2.8,0,i);
function view(s,pos,target,x,y,w,h,span){
 renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);const aspect=w/h,c=new T.OrthographicCamera(-span*aspect,span*aspect,span,-span,.1,100);c.position.set(...pos);c.lookAt(...target);renderer.render(s,c);
}
function render(){const w=innerWidth,h=innerHeight-47,row=h/3;renderer.setSize(w,h,false);renderer.setScissorTest(true);
 view(carScene,[-6,3.3,7],[0,.59,0],0,row*2,w/2,row,1.05);
 view(carScene,[6,3.0,7],[0,.59,0],w/2,row*2,w/2,row,1.05);
 view(carScene,[0,1,8],[0,.59,0],0,row,w/2,row,1.05);
 view(carScene,[-4,7,4],[0,.59,0],w/2,row,w/2,row,1.50);
 view(trees,[-2,4,12],[0,1.45,0],0,0,w,row,1.8);
 document.body.dataset.ready='true';
}
addEventListener('resize',render);render();
