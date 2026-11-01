import {gunzipSync} from './standalone-tools/node_modules/fflate/esm/browser.js';

export async function decodeEmbedded(base64){
 const raw=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 // Native streaming is preferred, but not required by the offline artwork.
 if(typeof DecompressionStream==='function'&&typeof Blob.prototype.stream==='function'){
  try{return await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  catch{/* Some embedded webviews expose the API without supporting gzip. */}
 }
 const bytes=gunzipSync(raw);
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
