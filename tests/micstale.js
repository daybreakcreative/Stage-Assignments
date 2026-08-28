// The auto-added vocal mic item must never be absorbed into bucket.customItems.
// Found 2026-08-27: reconstructSetupBucket treats any item whose text isn't a catalog option as a
// custom item, so the assigned mic became a permanent "custom" line. Changing the mic then left
// the OLD capsule on the checklist forever — a tech would grab the wrong mic.
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

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 const K = "stableSetupKey('Kaeli Hearn','vocalist','vocals')";
 const seed=()=>ev(`
   state.serviceOrder=[]; state.setupItems={}; state.config.setupDefaults={};
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'}];
   state.assignments=['v1',null,null,null,null,null,null,null];
   state.instruments=[]; state.shadows=[]; state.hosts={}; state.mdSoloName=null; state.musicDirectorId=null;
   collectChecklistItems();   // drives seeding + syncAssignedMicItem + reconstruction
 `);

 check('the assigned mic does NOT become a custom item', ()=>{
   seed();
   const custom=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].customItems||[]).map(c=>c.text))`));
   if(custom.indexOf('KMS105')!==-1) throw new Error('mic leaked into customItems: '+JSON.stringify(custom));
 });

 check('changing the mic replaces it on the checklist (old capsule gone)', ()=>{
   seed();
   ev(`setVocalistMicByName('Kaeli Hearn','SE V7'); rebuildPersonItems(${K},'vocals'); collectChecklistItems();`);
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));
   if(items.indexOf('KMS105')!==-1) throw new Error('stale old mic still listed: '+JSON.stringify(items));
   if(items.indexOf('SE V7')===-1) throw new Error('new mic missing: '+JSON.stringify(items));
 });

 // THE REAL TRIGGER (reproduced in the browser): the bucket has EMPTY selections and the auto
 // mic item is already present, then reconstructSetupBucket runs on a later enumeration pass.
 check('reconstruction with the mic already present does not turn it into a custom item', ()=>{
   seed();
   ev(`var k=${K}; state.setupItems[k].selections={}; reconstructSetupBucket(k,'vocals');`);
   const custom=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].customItems||[]).map(c=>c.text))`));
   if(custom.indexOf('KMS105')!==-1) throw new Error('mic swept into customItems by reconstruction: '+JSON.stringify(custom));
 });

 check('after that reconstruction, changing the mic still swaps it cleanly', ()=>{
   seed();
   ev(`var k=${K}; state.setupItems[k].selections={}; reconstructSetupBucket(k,'vocals');`);
   ev(`setVocalistMicByName('Kaeli Hearn','SE V7'); rebuildPersonItems(${K},'vocals'); collectChecklistItems();`);
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));
   if(items.indexOf('KMS105')!==-1) throw new Error('OLD capsule still on the checklist: '+JSON.stringify(items));
   if(items.indexOf('SE V7')===-1) throw new Error('new capsule missing: '+JSON.stringify(items));
 });

 check('a genuine custom item still survives reconstruction', ()=>{
   seed();
   ev(`var k=${K}; state.setupItems[k].customItems=[{id:'c1',text:'Needs a stool'}]; state.setupItems[k].selections={}; rebuildPersonItems(k,'vocals'); reconstructSetupBucket(k,'vocals');`);
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));
   if(items.indexOf('Needs a stool')===-1) throw new Error('real custom item lost: '+JSON.stringify(items));
 });

 check('the mic is still shown on the checklist (not dropped entirely)', ()=>{
   seed();
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));
   if(items.indexOf('KMS105')===-1) throw new Error('mic vanished from the checklist: '+JSON.stringify(items));
 });

 check('clearing the mic removes it without stranding a custom line', ()=>{
   seed();
   ev(`setVocalistMicByName('Kaeli Hearn',''); rebuildPersonItems(${K},'vocals'); collectChecklistItems();`);
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));
   const custom=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].customItems||[]).map(c=>c.text))`));
   if(items.indexOf('KMS105')!==-1) throw new Error('mic remained after clearing: '+JSON.stringify(items));
   if(custom.indexOf('KMS105')!==-1) throw new Error('mic stranded in customItems: '+JSON.stringify(custom));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
