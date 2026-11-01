// Download a bundled local build without navigating away from the animation.
const button=document.querySelector('#download-html');
let busy=false,url=null;
button.addEventListener('click',async event=>{
 event.preventDefault();if(busy)return;
 busy=true;button.setAttribute('aria-busy','true');button.textContent='↓ Preparing HTML…';
 try{
  const response=await fetch(button.href,{cache:'no-store'});
  if(!response.ok)throw new Error(`HTML download failed (${response.status})`);
  const blob=await response.blob();
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='Train-of-Thoughts.html';
  document.body.append(link);link.click();link.remove();
  button.textContent='↓ Download HTML';
 }catch(error){button.textContent='↓ Retry HTML download';console.error(error);}
 finally{busy=false;button.removeAttribute('aria-busy');}
});
window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
