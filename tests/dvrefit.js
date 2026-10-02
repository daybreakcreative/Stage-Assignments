// 2026-10-01 overnight QA on Dillon's export. The display view places stage cards by MEASURING the
// plot, and nothing re-ran that measurement when the plot changed size: a 1920→1280 resize left the
// people layer 790px wide over a 503px plot (Drums 34px off-screen), while a fresh render at 1280 was
// perfect. Fullscreen arriving after the Display click, a divider drag or a divider reset all change
// the plot the same way. Only the edit view ever re-rendered on resize. Also: the run-sheet rail cut
// its last item at 1920×1080 (1032px of list in 1004px) and the per-device text scale was manual only.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){const o=this.__rect||{width:800,height:380};return{left:0,top:0,width:o.width,height:o.height,right:o.width,bottom:o.height,x:0,y:0,toJSON(){}}};
 // jsdom has no ResizeObserver: a stub that records observers so the test can fire them.
 w.__ros=[]; w.ResizeObserver=class{constructor(cb){this.cb=cb;w.__ros.push(this);}observe(el){this.el=el;}unobserve(){}disconnect(){}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fire=(target,type,init)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,init||{});target.dispatchEvent(e);};

window.addEventListener('load',()=>setTimeout(async()=>{
 ev(`toast=function(){};saveState=function(){};
     state.vocalists=[]; state.assignments=new Array(8).fill(null); state.shadows=[];
     state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Player',tag:'Keys'}];
     window.__renders=0; const __orig=renderDisplayView; renderDisplayView=function(){ window.__renders++; return __orig.apply(this, arguments); };`);
 const renders=()=>ev('window.__renders');

 console.log('--- the display refits after every geometry change ---');
 {
   ev(`document.body.classList.add('display-mode'); state.viewMode='display'; window.__renders=0;`);
   fire(window,'resize'); fire(window,'resize'); fire(window,'resize');
   await sleep(250);
   const n=renders();
   check('a window resize in display mode re-renders the display, debounced to ONE render for a burst', ()=>{ if(n!==1) throw new Error('renders: '+n); });
 }
 {
   ev(`document.body.classList.remove('display-mode'); state.viewMode='setup'; window.__renders=0;`);
   fire(window,'resize'); await sleep(250);
   check('a resize OUTSIDE display mode does not render the display', ()=>{ const n=renders(); if(n!==0) throw new Error('renders: '+n); });
 }
 {
   ev(`document.body.classList.add('display-mode'); state.viewMode='display'; window.__renders=0;`);
   fire(doc,'fullscreenchange'); await sleep(250);
   check('fullscreen arriving after the Display click re-renders the display', ()=>{ const n=renders(); if(n!==1) throw new Error('renders: '+n); });
 }
 {
   ev(`window.__renders=0; renderDisplayView(); window.__renders=0;`);
   const div=doc.getElementById('dvDividerSide');
   fire(div,'mousedown',{clientX:400,clientY:300,button:0});
   fire(doc,'mouseup',{clientX:420,clientY:300,button:0});
   await sleep(250);
   check('finishing a divider drag re-renders the display (cards follow the new plot size)', ()=>{ const n=renders(); if(n!==1) throw new Error('renders: '+n+' (divider '+(div?'found':'missing')+')'); });
 }
 {
   ev(`window.__renders=0;`);
   const div=doc.getElementById('dvDividerSide');
   fire(div,'dblclick'); await sleep(250);
   check('double-click divider reset re-renders the display', ()=>{ const n=renders(); if(n!==1) throw new Error('renders: '+n); });
 }
 {
   ev(`window.__renders=0; resetDvDividers();`); await sleep(250);
   check('"Reset display layout to defaults" re-renders the display', ()=>{ const n=renders(); if(n!==1) throw new Error('renders: '+n); });
 }
 {
   ev(`document.body.classList.remove('display-mode'); window.__renders=0; enterDisplayMode();`);
   const immediate=renders(); await sleep(250);
   check('enterDisplayMode renders, applies the dividers, then refits once for the geometry they set', ()=>{ const n=renders(); if(immediate!==1||n!==2) throw new Error('immediate '+immediate+', after '+n); });
   ev(`exitDisplayMode();`);
 }

 {
   ev(`document.body.classList.add('display-mode'); state.viewMode='display'; renderDisplayView(); window.__renders=0;`);
   const wrap=doc.querySelector('#displayView .dv-stage-svg-wrap');
   const ros=window.__ros;
   check('the display watches its plot with a ResizeObserver', ()=>{ if(!ros.length||ros[ros.length-1].el!==wrap) throw new Error('observers: '+ros.length); });
   ros[ros.length-1].cb([]); await sleep(250);
   check('an observer tick with the SAME plot size schedules nothing (no echo loop)', ()=>{ const n=renders(); if(n!==0) throw new Error('renders: '+n); });
   wrap.__rect={width:503,height:316};
   ros[ros.length-1].cb([]); await sleep(250);
   check('an observer tick with a CHANGED plot size refits once', ()=>{ const n=renders(); if(n!==1) throw new Error('renders: '+n); });
   ev(`window.__renders=0;`); ros[ros.length-1].cb([]); await sleep(250);
   check('...and the refit recorded the new size, so the next same-size tick is quiet', ()=>{ const n=renders(); if(n!==0) throw new Error('renders: '+n); });
   delete wrap.__rect; ev(`document.body.classList.remove('display-mode'); state.viewMode='setup';`);
 }

 console.log('--- the run sheet shrinks its text rather than cut the last item ---');
 // jsdom has no layout: stub a list whose scrollHeight follows --rs-scale (fixed padding + scaled text).
 const mkList=(clientH, items, padPx, textPx)=>{
   const list=doc.createElement('div'); doc.body.appendChild(list);
   Object.defineProperty(list,'clientHeight',{get:()=>clientH});
   Object.defineProperty(list,'scrollHeight',{get:()=>{const s=parseFloat(list.style.getPropertyValue('--rs-scale'))||1; return Math.round(items*(padPx+textPx*s));}});
   return list;
 };
 check('a list that overflows a little shrinks to the first scale that fits and is marked autofit', ()=>{
   ev(`localStorage.removeItem(DV_SCALE_KEY)`);
   const list=mkList(1004, 15, 20, 49); // at 1: 15*69=1035 > 1004; at 0.95: 15*(20+46.55)=998 fits
   const s=window.fitDvRunSheet(list);
   if(s!==0.95) throw new Error('scale '+s);
   if(list.dataset.dvAutofit!=='0.95'||list.style.getPropertyValue('--rs-scale')!=='0.95') throw new Error('marker/var: '+list.dataset.dvAutofit+' '+list.style.getPropertyValue('--rs-scale'));
   list.remove();
 });
 check('a list that already fits is left at full size with no marker', ()=>{
   const list=mkList(1200, 15, 20, 49);
   if(window.fitDvRunSheet(list)!==1||list.dataset.dvAutofit||list.style.getPropertyValue('--rs-scale')) throw new Error('touched a fitting list');
   list.remove();
 });
 check('below the floor it gives up: full size, scrolls (readable beats squeezed)', ()=>{
   const list=mkList(638, 15, 20, 49); // even at 0.8: 15*(20+39.2)=888 > 638
   if(window.fitDvRunSheet(list)!==1) throw new Error('did not revert');
   if(list.style.getPropertyValue('--rs-scale')||list.dataset.dvAutofit) throw new Error('left a partial scale behind');
   list.remove();
 });
 check('an operator-set run-sheet scale is never overridden', ()=>{
   ev(`saveDisplaySectionScales(Object.assign(loadDisplaySectionScales(),{runSheet:1.3}))`);
   const list=mkList(1004, 15, 20, 49);
   if(window.fitDvRunSheet(list)!==1||list.style.getPropertyValue('--rs-scale')) throw new Error('overrode a manual scale');
   list.remove(); ev(`localStorage.removeItem(DV_SCALE_KEY)`);
 });
 check('renderDisplayView calls the fitter on the real rail', ()=>{
   ev(`window.__fits=0; const __f=fitDvRunSheet; fitDvRunSheet=function(l){ window.__fits++; return __f(l); }; state.config.display=state.config.display||{}; state.config.display.showRunSheet=true; state.serviceOrder=[{id:'a',title:'Song',type:'song',length:300}]; renderDisplayView();`);
   if(ev('window.__fits')<1) throw new Error('fitter not called from the display render');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
