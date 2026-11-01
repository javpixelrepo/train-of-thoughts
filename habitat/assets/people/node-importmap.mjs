// Mirror index.html's import map for the dependency-free animation checks.
export function resolve(specifier,context,next){
  if(specifier==='three')specifier=new URL('../../../mecha/node_modules/three/build/three.module.js',import.meta.url).href;
  if(specifier.startsWith('three/addons/'))specifier=new URL('../../../mecha/node_modules/three/examples/jsm/'+specifier.slice(13),import.meta.url).href;
  return next(specifier,context);
}
