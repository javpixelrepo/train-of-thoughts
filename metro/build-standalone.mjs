import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build} from './standalone-tools/node_modules/esbuild/lib/main.js';
import {loadingStyle,loadingMarkup,loadingRuntime,loadingFailure} from './standalone-loading.mjs';

// Build an independent, offline artwork. The interactive application is read-only.
const dir=path.dirname(fileURLToPath(import.meta.url));
const project=path.dirname(dir),three=path.join(project,'three-deps/node_modules/three');
const original=await readFile(path.join(dir,'scene.js'),'utf8');
let entry=original;
// Download controls belong only to the full application.
entry=entry.split('\n').filter(line=>!line.startsWith('import {createScreenshot}')&&!line.startsWith('createScreenshot(')).join('\n');
function replace(from,to){
 if(!entry.includes(from))throw new Error('Scene changed: missing standalone transform '+from.slice(0,100));
 entry=entry.replaceAll(from,to);
}
replace("import {createRecorder} from './recorder.js?v=4';", "import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';\nimport {loadEmbeddedPerson} from 'embedded-people';");
replace('performanceReadout,cityVisibility','cityVisibility');
replace("const $=s=>document.querySelector(s),stage=$('#stage'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;", "const stage=document.querySelector('#stage');");
replace('await makePassengers(model)', 'await makePassengers(model,{loadSource:name=>loadEmbeddedPerson(name,new GLTFLoader())})');
replace('let animationTime=0,recorder=null;', 'let animationTime=0;');
replace('selected=-1,paused=reduced,last=', 'selected=-1,last=');
entry=entry.split('\n').filter(line=>!line.startsWith('function ui()')&&!line.startsWith('const perf=')&&!line.startsWith('recorder=createRecorder(')&&!line.startsWith("document.querySelectorAll('[data-car]')")).join('\n');
replace("if(recorder?.state==='exporting')return;",'');
replace('perf.interaction();','');
replace("$('#thought-status').textContent='';$('#hover').hidden=true;",'');
replace(';ui();}', ';}');
const resizeSuffix="new ResizeObserver(resize).observe(stage);";
const resizeStart=entry.indexOf('function resize()'),resizeEnd=entry.indexOf('\n',resizeStart);
const resizeLine=entry.slice(resizeStart,resizeEnd);
if(!resizeLine.includes(resizeSuffix))throw new Error('Missing resize observer');
entry=entry.slice(0,resizeStart)+resizeLine.slice(0,resizeLine.indexOf(resizeSuffix)+resizeSuffix.length)+entry.slice(resizeEnd);
replace('const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize', 'const w=stage.clientWidth,h=stage.clientHeight;if(w<=0||h<=0)return;renderer.setSize');
replace(resizeSuffix,"if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(stage);window.addEventListener('resize',resize);");
replace("if(thought!==null)$('#thought-status').textContent=thought;else {",'if(thought===null){');
replace("$('#hover').hidden=true;",'');
replace("if(e.code==='Space'){e.preventDefault();$('#pause').click();}",'');
replace('function draw(exporting=false){','function draw(){');
replace('if(!exporting){visibleResidents.length=0;', '{visibleResidents.length=0;');
replace(" if(recorder?.state==='exporting'){last=now;requestAnimationFrame(tick);return;}\n",'');
replace(' const frameStart=perf.begin();\n','');
replace('passengers.update(paused||reduced?0:dt,poseVisible);','passengers.update(dt,poseVisible);');
entry=entry.replace(/\s*perf\.mark\(['"][^'"]+['"]\);/g,'');
replace('if(!paused){distance+=dt*5.4;', '{distance+=dt*5.4;');
replace(' else streetLife.update(0,distance,poseVisible);\n','');
replace('recorder?.sample(now);','');
replace('perf.end(frameStart);','');
replace('scene.add(model.root);', "scene.add(model.root);await loadingStep('Welcoming the passengers…');");
replace('resize();ui();await warmScene', "resize();await loadingStep('Preparing the scene…');await warmScene");
replace("$('#loading').hidden=true;", "draw();stage.dataset.ready='true';finishLoading();");
if(/recorder|#pause|#back|#reset|#record|\bui\(|\$\(|\bpaused\b|\breduced\b|\bperf\./.test(entry))throw new Error('Sidebar or recording behavior remains in export entry');
// Classic inline script plus an async initializer avoids module/CORS and
// top-level-await requirements in file URLs and opaque sandboxed iframes.
const imports=entry.split('\n').filter(line=>line.startsWith('import ')).join('\n');
const implementation=entry.split('\n').filter(line=>!line.startsWith('import ')).join('\n');
entry=imports+'\n'+loadingFailure+'\n(async()=>{\n'+loadingRuntime+implementation+'\n})().catch(showLoadingFailure);';

const compressed={};
for(const name of ['maya','sam']){
 const bytes=await readFile(path.join(project,`characters/assets/people/${name}.glb`));
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 if(gltf.buffers.some(b=>b.uri)||gltf.images?.some(i=>i.uri))throw new Error('Unexpected external GLB dependency');
 compressed[name]=gzipSync(bytes,{level:9}).toString('base64');
}
const embeddedSource=`import {decodeEmbedded} from 'embedded-decoder';
const assets=${JSON.stringify(compressed)};
export async function loadEmbeddedPerson(name,loader){
 const bytes=await decodeEmbedded(assets[name]);
 delete assets[name];
 return loader.parseAsync(bytes,'');
}`;
const result=await build({
 stdin:{contents:entry,resolveDir:dir,sourcefile:'standalone-scene.js',loader:'js'},
 bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',minify:true,
 legalComments:'inline',metafile:true,treeShaking:true,
 plugins:[{name:'offline-scene',setup(api){
  api.onResolve({filter:/^embedded-people$/},()=>({path:'people',namespace:'embedded'}));
  api.onResolve({filter:/^embedded-decoder$/},()=>({path:path.join(dir,'decode-embedded.js')}));
  api.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:embeddedSource,loader:'js'}));
  api.onResolve({filter:/^three(?:\/|$)/},args=>({path:args.path==='three'?path.join(three,'build/three.module.js'):path.join(three,'examples/jsm',args.path.slice('three/addons/'.length))}));
  api.onResolve({filter:/\?v=/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));
  // Offline loader is injected above: omit the application-only URL fallback.
  api.onLoad({filter:/[\\/]metro[\\/]passengers\.js$/},async args=>({contents:(await readFile(args.path,'utf8')).replace("loadSource?loadSource(n):loader.loadAsync(new URL(`../characters/assets/people/${n}.glb`,import.meta.url).href)",'loadSource(n)'),loader:'js'}));
 }}]
});
const inputs=Object.keys(result.metafile.inputs);
if(inputs.some(p=>/recorder|recorded-camera/.test(p)))throw new Error('Recording dependency was bundled');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'">
<title>Train of Thoughts</title><link rel="icon" href="data:,">
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;background:#fafaf7}#stage{position:absolute;inset:0;width:100%;height:100%;outline:none;touch-action:none;cursor:grab}canvas{display:block;width:100%;height:100%;outline:none}${loadingStyle}</style>
</head><body>${loadingMarkup}<noscript><style>#loading,#stage{display:none}</style><p style="font:14px Arial;text-align:center;padding:24px">Enable JavaScript to start Train of Thoughts.</p></noscript><main id="stage" inert aria-busy="true" tabindex="0" aria-label="Train of Thoughts interactive scene"></main><script>${js}</script></body></html>`;
const output=path.join(dir,'exports','Train-of-Thoughts.html');
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,html);
// Each rebuild refreshes the sidebar link so a previous download cannot be
// served from the browser cache after the artwork changes.
const indexPath=path.join(dir,'index.html'),index=await readFile(indexPath,'utf8');
const revision=createHash('sha256').update(html).digest('hex').slice(0,12);
const updatedIndex=index.replace(/(id="download-html" href=")exports\/Train-of-Thoughts\.html(?:\?[^" ]*)?/,`$1exports/Train-of-Thoughts.html?v=${revision}`);
if(updatedIndex!==index)await writeFile(indexPath,updatedIndex);
if(await readFile(path.join(dir,'scene.js'),'utf8')!==original)throw new Error('Original entry changed during build');
await writeFile(path.join(dir,'exports','standalone-build.json'),JSON.stringify({file:output,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),originalSceneSha256:createHash('sha256').update(original).digest('hex'),inputs,offline:true,recording:false,sidebar:false},null,2));
console.log(JSON.stringify({output,megabytes:(Buffer.byteLength(html)/1e6).toFixed(2),modules:inputs.length,originalUnchanged:true}));
