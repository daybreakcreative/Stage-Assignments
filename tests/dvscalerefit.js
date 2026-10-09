// The TV's stage-text slider (--dv-stage-text-scale) changes every card's size, and the de-overlap
// resolver places cards by MEASURING them — so a slider move must re-run placement, or the TV keeps
// the nudges computed for the old size (2026-10-09: at 75% the Drums card stayed lifted 56 units
// for a collision that no longer existed, while the set-up page, re-rendered on exit, had it home).
// The setter schedules the display's debounced refit; outside display mode nothing runs.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('JSDOM ERR',(e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.addEventListener('load',()=>setTimeout(async()=>{
 ev('toast=function(){};');
 ev(`state.instruments.find(i=>i.id==='inst_drums').assignedTo='Danny';
     state.vocalists=[{id:'v1',name:'Mo'},{id:'v2',name:'Ella'}];
     state.assignments=computePositions(state.vocalists); renderAll();`);
 const layer=()=>document.getElementById('dvStagePeople');
 const plant=()=>{const i=document.createElement('i');i.id='scaleProbe';layer().appendChild(i);};
 const planted=()=>!!document.getElementById('scaleProbe');

 // Outside display mode the slider is unreachable; a programmatic change must not render anything.
 plant();
 ev("setDisplaySectionScale('stageText', 0.8)");
 await sleep(250);
 check('a stage-text scale change outside display mode renders nothing', ()=>{
   if(!planted()) throw new Error('the display view re-rendered while hidden');
 });
 ev('enterDisplayMode()');
 // enterDisplayMode schedules its own debounced refit; let it land first, or it removes the probe
 // and this check passes for the wrong reason.
 await sleep(400);
 plant();
 await sleep(250);
 check('entering display mode has settled (no stray refit still pending)', ()=>{
   if(!planted()) throw new Error('a refit ran 400ms+ after enterDisplayMode with nothing changed');
 });
 ev("setDisplaySectionScale('stageText', 0.75)");
 await sleep(300);
 check('in display mode, a stage-text scale change re-places the stage cards (debounced)', ()=>{
   if(planted()) throw new Error('renderDisplayView did not run after the stage text scale changed — the TV keeps nudges computed for the old card size');
 });
 check('the scale itself persisted and reached :root', ()=>{
   const v=document.documentElement.style.getPropertyValue('--dv-stage-text-scale').trim();
   if(v!=='0.75') throw new Error('--dv-stage-text-scale is '+JSON.stringify(v));
   if(ev("getDisplaySectionScale('stageText')")!==0.75) throw new Error('not persisted');
 });
 ev("setDisplaySectionScale('stageText', 1)");
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
