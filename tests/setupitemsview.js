// FEATURE: Setup Items page redesign — grouped rich cards. Helpers + render + toggle.
// Spec: docs/superpowers/specs/2026-07-17-setup-items-page-redesign-design.md
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

// Seed a roster: 1 band MD (keys) + 3 vocalists with mics/packs assigned.
function seed(){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};`);
 ev(`state.setupItems={}; state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
 ev(`state.config.voxIemPacks=['Pack A','Pack B','Pack C','Pack D','Pack E','Pack F','Pack G','Pack H'];`);
 ev(`state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Reed'}];`);
 ev(`state.musicDirectorId='i_keys';`);
 ev(`state.vocalists=[{id:'v1',name:'Ava Chen',isWL:true,micAssigned:'Beta 58 #1'},{id:'v2',name:'Noah Brooks',micAssigned:'Beta 58 #2'},{id:'v3',name:'Mia Torres'}];`);
 ev(`state.assignments=['v1','v2','v3'].concat(new Array(MAX_VOCALISTS-3).fill(null));`);
 ev(`state.service={name:'Sunday Service',date:'2026-07-19'};`);
}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 console.log('--- helpers ---');
 check('vocalSlotFor returns 1-based assignment slot', ()=>{
   seed();
   if(ev(`vocalSlotFor('v1')`)!==1) throw new Error('v1 should be slot 1');
   if(ev(`vocalSlotFor('v3')`)!==3) throw new Error('v3 should be slot 3');
   if(ev(`vocalSlotFor('nope')`)!==0) throw new Error('unknown should be 0');
 });

 check('iemNoteFor returns the vocalist pack by slot', ()=>{
   seed();
   const p=ev(`JSON.stringify(getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'))`);
   if(ev(`iemNoteFor(${p})`)!=='Pack A') throw new Error('v1 IEM should be Pack A, got '+ev(`iemNoteFor(${p})`));
 });

 check('syncAssignedMicItem materializes a checkable mic item for a vocalist', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   ev(`(function(){var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p);})()`);
   const mics=JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(key)}].items||[]).filter(function(i){return i.kind==='mic';}))`));
   if(mics.length!==1) throw new Error('expected 1 mic item, got '+mics.length);
   if(mics[0].text!=='Beta 58 #1') throw new Error('mic text wrong: '+mics[0].text);
   if(mics[0].autoAdded!==true) throw new Error('mic item should be autoAdded');
 });

 check('syncAssignedMicItem removes the mic item when assignment cleared', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   ev(`(function(){var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p); state.vocalists.find(v=>v.id==='v1').micAssigned=''; syncAssignedMicItem(p);})()`);
   const n=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).filter(function(i){return i.kind==='mic';}).length`);
   if(n!==0) throw new Error('mic item should be removed, got '+n);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
