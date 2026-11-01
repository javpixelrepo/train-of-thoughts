import * as T from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// Render the current pose and camera once at full resolution. No simulation
// step, camera interpolation, recording session or permanent canvas resize.
export function createScreenshot({renderer,scene,overlay,draw,isBusy}){
 const button=document.querySelector('#screenshot'),status=document.querySelector('#screenshot-status');
 let capturing=false,url=null;
 button.onclick=async()=>{
  if(capturing)return;
  if(isBusy()){status.textContent='Finish the recording or export to take a screenshot.';return;}
  capturing=true;button.disabled=true;status.textContent='Preparing PNG…';
  const size=renderer.getSize(new T.Vector2()),dpr=renderer.getPixelRatio();
  const width=4096,height=Math.round(width*size.y/size.x),factor=width/size.x;
  const widths=new Map(),proxies=[];
  let encoded;
  try{
   try{
    const thinLines=[];
    for(const tree of [scene,overlay])tree.traverse(o=>{
     if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isLineMaterial&&!widths.has(m)){widths.set(m,m.linewidth);m.linewidth*=factor;}
     if(o.isLineSegments&&!o.isLineSegments2)thinLines.push(o);
    });
    // Preserve architectural line weight relative to the artwork at 4K.
    for(const line of thinLines){
     const geometry=new LineSegmentsGeometry().setPositions(line.geometry.attributes.position.array);
     const material=new LineMaterial({color:line.material.color,linewidth:factor/dpr,transparent:true,opacity:line.material.opacity,depthTest:line.material.depthTest,depthWrite:false});
     material.visible=line.material.visible;
     const proxy=new LineSegments2(geometry,material);proxy.layers.mask=line.layers.mask;proxy.renderOrder=line.renderOrder;
     line.add(proxy);proxies.push({line,proxy,visible:line.material.visible});line.material.visible=false;
    }
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);draw();
    // toBlob snapshots pixels on invocation; restore the live scene before
    // yielding to the PNG encoder so the next animation frame stays normal.
    encoded=new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));
   }finally{
    for(const [m,w]of widths)m.linewidth=w;
    for(const {line,proxy,visible}of proxies){proxy.removeFromParent();proxy.geometry.dispose();proxy.material.dispose();line.material.visible=visible;}
    renderer.setPixelRatio(dpr);renderer.setSize(size.x,size.y,false);draw();
   }
   const blob=await encoded;if(!blob)throw new Error('Could not create the image.');
   if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=url;link.download=`Train-of-Thoughts-4K-${Date.now()}.png`;
   document.body.append(link);link.click();link.remove();
   status.textContent=`PNG saved · ${width} × ${height}`;
  }catch(error){status.textContent='Screenshot failed. Please try again.';console.error(error);}
  finally{capturing=false;button.disabled=false;}
 };
 window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
}
