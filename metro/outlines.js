import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// Native GL lines are one framebuffer pixel wide: supersampling makes them
// thinner in CSS pixels and their coverage jumps as architecture scrolls.
// Screen-space strips retain their width and smooth subpixel coverage instead.
export function stabilizeOutlines(root){
 const materials=new Map(),geometries=new Map(),lines=[];
 // Speech cards have their own layer and animated material references.
 root.traverse(o=>{if((o.layers.mask&1)&&o.isLineSegments&&o.material.isLineBasicMaterial)lines.push(o);});
 for(const old of lines){
  let material=materials.get(old.material);
  if(!material){
   const source=old.material;
   material=new LineMaterial({color:source.color,linewidth:.85,worldUnits:false,
    // LineMaterial's coverage endcaps replace alpha, so fading train panels
    // use ordinary MSAA/blending and retain their animated opacity everywhere.
    alphaToCoverage:!source.transparent,depthTest:true,depthWrite:false,transparent:source.transparent,
    opacity:source.opacity,fog:source.fog});
   materials.set(source,material);
  }
  let geometry=geometries.get(old.geometry);
  if(!geometry){geometry=new LineSegmentsGeometry().setPositions(old.geometry.attributes.position.array);geometries.set(old.geometry,geometry);}
  const line=new LineSegments2(geometry,material);
  line.name=old.name;line.position.copy(old.position);line.quaternion.copy(old.quaternion);line.scale.copy(old.scale);
  line.layers.mask=old.layers.mask;line.visible=old.visible;line.renderOrder=old.renderOrder;
  line.userData={...old.userData};line.raycast=()=>{};
  line.matrixAutoUpdate=old.matrixAutoUpdate;line.updateMatrix();
  old.parent.add(line);old.removeFromParent();
 }
 return lines.length;
}
