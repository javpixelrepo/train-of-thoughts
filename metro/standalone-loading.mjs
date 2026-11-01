// Lightweight, self-contained loading artwork used only by the HTML export.
export const loadingStyle=`
#loading{position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:#fafaf7;color:#343431;opacity:1;transition:opacity .55s ease;cursor:wait}
#loading.leaving{opacity:0;pointer-events:none}
.loading-card{width:min(360px,82vw);text-align:center;font-family:Arial,Helvetica,sans-serif}
.loading-edition{font:9px/1.5 monospace;letter-spacing:.24em;color:#88887f;text-transform:uppercase;margin:0 0 25px}
.loading-title{font-size:clamp(32px,7vw,45px);line-height:.94;letter-spacing:-2px;font-weight:700;margin:0}
.loading-title span{display:block;font-weight:400}
.loading-train{display:block;width:100%;height:auto;margin:28px 0 9px;overflow:hidden}
.loading-train .track{stroke-dasharray:2 14;animation:passing-track 1.2s linear infinite}
.loading-route{display:flex;justify-content:space-between;align-items:center;font:9px monospace;letter-spacing:.14em;text-transform:uppercase;color:#8d8d83}
.loading-route span{display:flex;align-items:center;gap:7px}.loading-route i{width:4px;height:4px;background:#babbb0;border-radius:50%}.loading-route span:nth-child(2){color:#42423d}.loading-route span:nth-child(2) i{background:#42423d}
.loading-rule{height:1px;background:#deded6;margin:25px 0 16px;overflow:hidden}.loading-rule:after{content:'';display:block;width:35%;height:1px;background:#55554d;animation:loading-pass 2.2s ease-in-out infinite}
#loading-status{font:10px/1.6 monospace;letter-spacing:.02em;color:#77776e;margin:0;min-height:32px}
#loading-retry{margin-top:16px;padding:10px 18px;border:1px solid #aaa99f;background:transparent;color:#343431;font:11px monospace;cursor:pointer}
#loading-retry[hidden]{display:none}#loading[data-state=error]{cursor:default}#loading[data-state=error] .loading-rule:after,#loading[data-state=error] .track{animation:none}
@media(max-height:420px){.loading-edition{margin-bottom:10px}.loading-title{font-size:30px}.loading-train{max-width:260px;margin:10px auto 5px}.loading-rule{margin:12px 0 8px}#loading-status{min-height:0}}
@keyframes passing-track{to{stroke-dashoffset:-32}}
@keyframes loading-pass{from{transform:translateX(-110%)}to{transform:translateX(390%)}}
@media(prefers-reduced-motion:reduce){#loading{transition:none}.loading-train .track,.loading-rule:after{animation:none}}
`;
export const loadingMarkup=`<div id="loading" role="status" aria-live="polite" aria-atomic="true">
 <div class="loading-card">
  <p class="loading-edition">An interactive journey</p>
  <h1 class="loading-title">Train of<span>Thoughts</span></h1>
  <svg class="loading-train" viewBox="0 0 360 100" fill="none" aria-hidden="true">
   <g stroke="#66665f" stroke-width="1.1" stroke-linejoin="round">
    <path d="M27 63V47l10-20h274l18 10v26Z" fill="#efefea"/>
    <path d="M27 63h302v7H27Z" fill="#d9d9d1"/>
    <path d="M38 32h14v20H30Z" fill="#62625c"/>
    <path d="M59 33h19v18H59Zm46 0h19v18h-19Zm28 0h19v18h-19Zm28 0h19v18h-19Zm46 0h19v18h-19Zm28 0h19v18h-19Zm28 0h19v18h-19Zm28 0h19v18h-19Z" fill="#fafaf7"/>
    <path d="M83 32h15v31H83Zm100 0h17v31h-17Zm100 0h17v31h-17Z" fill="#e0e0d9"/>
    <path d="M89 36h4v15h-4Zm99 0h7v15h-7Zm100 0h7v15h-7Z" fill="#fafaf7"/>
    <path d="M113 27v43m2-43v43m100-43v43m2-43v43M31 57h52m15 0h85m17 0h83m17 0h29"/>
    <path d="M57 27v-5h23v5m70 0v-5h23v5m70 0v-5h23v5" fill="#e0e0d9"/>
    <g fill="#686861"><circle cx="52" cy="73" r="5"/><circle cx="89" cy="73" r="5"/><circle cx="140" cy="73" r="5"/><circle cx="187" cy="73" r="5"/><circle cx="242" cy="73" r="5"/><circle cx="303" cy="73" r="5"/></g>
    <path d="M13 80h334M13 87h334" stroke="#a9a99e"/>
    <path class="track" d="M-16 83.5h392" stroke="#a9a99e" stroke-width="6"/>
   </g>
  </svg>
  <div class="loading-route" aria-hidden="true"><span><i></i>Past</span><span><i></i>Present</span><span><i></i>Future</span></div>
  <div class="loading-rule" aria-hidden="true"></div>
  <p id="loading-status">Preparing your journey…</p>
  <button id="loading-retry" hidden type="button">Try again</button>
 </div>
</div>`;
export const loadingRuntime=`
const loadingScreen=document.querySelector('#loading');
document.querySelector('#loading-retry').addEventListener('click',()=>location.reload());
async function loadingStep(message){
 document.querySelector('#loading-status').textContent=message;
 // Give the browser a paint before synchronous geometry and rig preparation.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}
function finishLoading(){
 const stage=document.querySelector('#stage');stage.inert=false;stage.setAttribute('aria-busy','false');
 document.querySelector('#loading-status').textContent='Your journey begins.';
 loadingScreen.classList.add('leaving');
 const remove=()=>loadingScreen.remove();
 loadingScreen.addEventListener('transitionend',remove,{once:true});setTimeout(remove,650);
}
await loadingStep('Drawing the city…');
`;
export const loadingFailure=`
function showLoadingFailure(error){
 console.error(error);
 const loading=document.querySelector('#loading');
 loading.classList.remove('leaving');loading.dataset.state='error';
 document.querySelector('#loading-status').textContent=/webgl/i.test(String(error))
  ?'This browser cannot display the 3D scene. Try an updated browser with graphics acceleration enabled.'
  :'The journey could not start. Please reload and try again.';
 document.querySelector('#loading-retry').hidden=false;
}
`;
