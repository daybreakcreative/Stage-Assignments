// FEATURE: ✓ Items checklist footer — "Mark all done" replaced by a "▶ Display" button that
// illuminates (.ready) when every item is checked and, on click, enters Display mode (reusing the
// block-until-setup gate via goToDisplay()). Plus a stacked card header (name over role).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// One vocalist with an assigned mic → exactly one checklist item. `done` marks it complete.
function seedAva(done){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};renderDisplayView=function(){};applyDvDividers=function(){};`);
 ev(`state.setupItems={}; state.checklistState={}; state.shadows=[]; state.instruments=[]; state.musicDirectorId=null; state.config.stageFeatures=[]; state.config.blockDisplayUntilSetup=false;`);
 ev(`state.config.voxIemPacks=['Pack A'];`);
 ev(`state.vocalists=[{id:'v1',name:'Ava Chen',isWL:true,micAssigned:'Beta 58 #1'}];`);
 ev(`state.assignments=['v1'].concat(new Array(MAX_VOCALISTS-1).fill(null));`);
 ev(`state.service={name:'S',date:'2026-07-19'};`);
 // Render once to materialize the mic item, then (optionally) mark it done and re-render.
 ev(`renderSetupChecklist();`);
 if(done){
   const key=ev(`(function(){var c=[].find.call(document.querySelectorAll('#setupChecklistView .si-chip[data-item-key]'),function(){return true;}); return c?c.getAttribute('data-item-key'):'';})()`);
   ev(`state.checklistState=state.checklistState||{}; getChecklistState()[${JSON.stringify(key)}]=true; renderSetupChecklist();`);
 }
}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};renderDisplayView=function(){};applyDvDividers=function(){};');

 check('footer has a Display button and no Mark-all-done; Reset all stays', ()=>{
   seedAva(false);
   if(!doc.querySelector('#setupChecklistView #scvDisplayBtn')) throw new Error('no #scvDisplayBtn');
   if(doc.querySelector('#setupChecklistView #scvMarkAllBtn')) throw new Error('#scvMarkAllBtn should be gone');
   if(!doc.querySelector('#setupChecklistView #scvResetBtn')) throw new Error('#scvResetBtn missing');
 });

 check('Display button illuminates (.ready) only when all items are done', ()=>{
   seedAva(false);
   if(doc.querySelector('#scvDisplayBtn').classList.contains('ready')) throw new Error('should NOT be ready with an unchecked item');
   seedAva(true);
   if(!doc.querySelector('#scvDisplayBtn').classList.contains('ready')) throw new Error('should be ready when all done');
 });

 check('checking the last item flips .ready on live', ()=>{
   seedAva(false);
   const chip=doc.querySelector('#setupChecklistView .si-chip[data-item-key]');
   if(doc.querySelector('#scvDisplayBtn').classList.contains('ready')) throw new Error('precondition: not ready');
   chip.dispatchEvent(new window.Event('click',{bubbles:true}));
   if(!doc.querySelector('#scvDisplayBtn').classList.contains('ready')) throw new Error('.ready not added after checking last item');
 });

 check('clicking Display enters Display mode and hides the checklist', ()=>{
   seedAva(true);
   doc.querySelector('#scvDisplayBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
   if(ev(`state.viewMode`)!=='display') throw new Error('viewMode should be display, got '+ev(`state.viewMode`));
   if(doc.getElementById('setupChecklistView').style.display!=='none') throw new Error('checklist overlay should be hidden');
 });

 check('card header stacks name over role inside .si-card-id', ()=>{
   seedAva(false);
   const card=doc.querySelector('#setupChecklistView .si-card');
   const id=card.querySelector('.si-card-id');
   if(!id) throw new Error('no .si-card-id wrapper');
   if(!id.querySelector('.si-card-name')) throw new Error('name not inside .si-card-id');
   if(!id.querySelector('.si-card-role')) throw new Error('role not inside .si-card-id');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
