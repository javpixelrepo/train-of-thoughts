import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {decodeEmbedded} from './decode-embedded.js';
const native=globalThis.DecompressionStream;
try{
 for(const name of ['maya','sam']){
  const original=await readFile(new URL(`../characters/assets/people/${name}.glb`,import.meta.url));
  const encoded=gzipSync(original).toString('base64');
  for(const fallback of [false,true]){
   globalThis.DecompressionStream=fallback?undefined:native;
   assert.deepEqual(Buffer.from(await decodeEmbedded(encoded)),original);
   console.log(`${name}: ${fallback?'fallback':'native'} decoder preserves every byte`);
  }
 }
 await assert.rejects(()=>decodeEmbedded('bm90IGd6aXA='));
}finally{globalThis.DecompressionStream=native;}
