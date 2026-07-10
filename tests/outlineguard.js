// FIX #5 — the outline editor must NOT pin an AUTO outline as "custom" on a
// no-edit close. Only a real edit (or a reset-to-rectangle, or an editor that
// STARTED from a custom outline) may write state.config.customStagePoints.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function pe(type,x,y){return new window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true});}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('5a) open AUTO outline, click Save with NO edit → customStagePoints stays null', ()=>{
   ev('state.config.customStagePoints=null; state.config.stageCurvature=60; state.config.stageDepth=45;');
   // mirror the real Settings→Display wiring: getInitial reads the (null) custom outline.
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ state.config.customStagePoints=p; } })');
   doc.getElementById('saPolySave').click();
   const cps = ev('state.config.customStagePoints');
   if(cps!==null && !(cps===undefined)) throw new Error('AUTO outline got PINNED on a no-edit Save: '+JSON.stringify(cps));
 });
 check('5b) open AUTO, close via the ✕ with NO edit → still null', ()=>{
   ev('state.config.customStagePoints=null;');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ state.config.customStagePoints=p; } })');
   doc.getElementById('saPolyClose').click();
   const cps = ev('state.config.customStagePoints');
   if(cps!==null && !(cps===undefined)) throw new Error('AUTO outline PINNED on a no-edit ✕: '+JSON.stringify(cps));
 });
 check('5c) open AUTO, close via backdrop with NO edit → still null', ()=>{
   ev('state.config.customStagePoints=null;');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ state.config.customStagePoints=p; } })');
   const m=doc.getElementById('saPolyModal');
   const evt=new window.MouseEvent('click',{bubbles:true}); Object.defineProperty(evt,'target',{value:m}); m.dispatchEvent(evt);
   const cps = ev('state.config.customStagePoints');
   if(cps!==null && !(cps===undefined)) throw new Error('AUTO outline PINNED on a no-edit backdrop click: '+JSON.stringify(cps));
 });
 check('5d) open AUTO, DRAG a corner, then Save → outline IS written', ()=>{
   ev('state.config.customStagePoints=null;');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ state.config.customStagePoints=p; } })');
   // drag the first corner handle. The drag engine is captured on the persistent <svg>;
   // pointerdown fires on the corner (child), move/up bubble up to the svg listener.
   const svg=doc.getElementById('saPolySvg');
   const handle=svg.querySelector('[data-corner="0"]');
   if(!handle) throw new Error('no corner handle found to drag');
   handle.dispatchEvent(pe('pointerdown',100,300));
   svg.dispatchEvent(pe('pointermove',150,260));
   svg.dispatchEvent(pe('pointerup',150,260));
   doc.getElementById('saPolySave').click();
   const cps = ev('state.config.customStagePoints');
   if(!cps || !Array.isArray(cps) || cps.length<3) throw new Error('a real edit was NOT saved: '+JSON.stringify(cps));
 });
 check('5e) open AUTO, Reset to rectangle, then Save → outline IS written (WATCHLIST #23/#32)', ()=>{
   ev('state.config.customStagePoints=null;');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ state.config.customStagePoints=p; } })');
   doc.getElementById('saPolyReset').click();      // pts = rectangleStagePoints()
   doc.getElementById('saPolySave').click();
   const cps = ev('state.config.customStagePoints');
   if(!cps || !Array.isArray(cps) || cps.length<3) throw new Error('reset-to-rectangle then save was NOT written: '+JSON.stringify(cps));
 });
 check('5f) started CUSTOM: no-edit Save still writes (backdrop-commit contract, smoke2)', ()=>{
   ev('state.config.customStagePoints=[{x:100,y:100},{x:700,y:100},{x:700,y:300},{x:100,y:300}];');
   let saved=null; window.__cb=(p)=>{saved=p;};
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>window.__cb(p) })');
   doc.getElementById('saPolySave').click();
   if(!saved||saved.length!==4) throw new Error('started-custom Save did not commit: '+JSON.stringify(saved));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
