// The EDIT view fits its people layer onto the drawn plot once, inside renderStage, and until
// 2026-10-08 nothing re-ran that fit except a window resize. The left column settles AFTER the
// first render at boot — measured: the layer was fitted to a 486px-wide wrap that was 442px by the
// time the page was readable — so every card sat 10% off its spot (Bass drawn below the back wall)
// and the compact tier engaged for overlaps that did not exist. One service, three pictures
// (bug_6a0219ce). The display got its ResizeObserver in cf30a0a; this pins the edit view's.
// jsdom has no ResizeObserver and no layout, so the observer is stubbed: the test checks that the
// wrap is observed, that a changed wrap size re-renders the stage (debounced), that an unchanged
// size does not (echo guard), and that a refit waits for a slot drag to finish.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('JSDOM ERR',(e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 // Stub: records every observer and what it watches; the test fires callbacks by hand.
 w.__ros=[];
 w.ResizeObserver=class{constructor(cb){this.cb=cb;this.els=[];w.__ros.push(this);}observe(el){this.els.push(el);}unobserve(){}disconnect(){}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.addEventListener('load',()=>setTimeout(async()=>{
 ev('toast=function(){};');
 ev(`state.instruments.find(i=>i.id==='inst_drums').assignedTo='Danny';
     state.vocalists=[{id:'v1',name:'Mo'},{id:'v2',name:'Ella'}];
     state.assignments=computePositions(state.vocalists); renderStage();`);
 const wrap=document.getElementById('stageWrap');
 const people=document.getElementById('stagePeople');
 let size={w:800,h:380};
 wrap.getBoundingClientRect=()=>({left:0,top:0,width:size.w,height:size.h,right:size.w,bottom:size.h,x:0,y:0,toJSON(){}});
 const watchers=()=>window.__ros.filter(ro=>ro.els.includes(wrap));
 const fire=()=>watchers().forEach(ro=>ro.cb([{target:wrap,contentRect:{width:size.w,height:size.h}}],ro));
 const plant=()=>{const i=document.createElement('i');i.id='refitProbe';people.appendChild(i);};
 const planted=()=>!!document.getElementById('refitProbe');

 check('the edit stage wrap is watched by a ResizeObserver', ()=>{
   if(!watchers().length) throw new Error('#stageWrap is not observed — the people layer goes stale the moment the left column settles after the first render');
 });
 plant();
 size={w:442,h:231}; fire(); await sleep(250);
 check('a changed wrap size re-renders the stage (debounced)', ()=>{
   if(planted()) throw new Error('renderStage did not run after the wrap resized');
 });
 plant();
 fire(); await sleep(250);
 check('an unchanged wrap size does not re-render (echo guard)', ()=>{
   if(!planted()) throw new Error('renderStage ran again for the same wrap size — that feeds back into its own observer');
 });
 document.body.classList.add('dragging-slot');
 size={w:600,h:300}; fire(); await sleep(250);
 check('a refit waits while a slot drag is in progress', ()=>{
   if(!planted()) throw new Error('the slots were rebuilt under a live drag — the pointer capture dies with them');
 });
 document.body.classList.remove('dragging-slot'); await sleep(300);
 check('...and lands once the drag ends', ()=>{
   if(planted()) throw new Error('the deferred refit never ran after the drag ended');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
