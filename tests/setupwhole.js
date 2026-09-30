// Diagnosed 2026-09-30 from Dillon's real export. One person can hold several setup buckets
// (a Keys player who is also the MD has band|keys AND md|md), the ✓ Items card merges them, but a
// remove in the editor reached ONE bucket — so the line stayed on the card and reappeared in the
// other section. "Save someone's preferences and things hold over." Also: the auto-added vocal mic
// and boom stand were stored a second time as a customItem in 7 buckets, and 7 legacy buckets
// keyed |band|none (from an old build) sit in the data. No names from that export appear here.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 // A Keys player who is also the MD. Both buckets carry "Laptop stand" — the shared line.
 const seedKeysMD=()=>ev(`
   state._firstRun=false; state.config.setupCatalog=null; state.setupItems={};
   state.vocalists=[]; state.assignments=new Array(8).fill(null); state.shadows=[];
   state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Player',pack:'Keys',tag:'Keys'}];
   state.musicDirectorId='i_keys';
   const kk=stableSetupKey('Pat Player','band','keys'), mk=stableSetupKey('Pat Player','md','md');
   state.setupItems[kk]={selections:{source:'k_user_kbd',soundsfrom:'k_dante',inputs:'k_in2',cabling:[],extras:['k_laptop']},customItems:[],seeded:true,items:[]};
   state.setupItems[mk]={selections:{rig:['md_tracks','md_dante','md_stand']},customItems:[],seeded:true,items:[]};
   rebuildPersonItems(kk,'keys'); rebuildPersonItems(mk,'md');
   window.__kk=kk; window.__mk=mk;
 `);
 const linesOf=k=>JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(k)}].items||[]).map(i=>i.text))`));
 const cardChips=()=>{ ev('renderSetupChecklist()');
   const card=Array.from(doc.querySelectorAll('.si-card')).find(c=>/Pat Player/.test(c.textContent));
   return card?Array.from(card.querySelectorAll('.si-chip-text')).map(x=>x.textContent.trim()):null; };

 console.log('--- a remove reaches the WHOLE person, not one bucket ---');

 check('precondition: the shared line is in both buckets and once on the card', ()=>{
   seedKeysMD();
   const a=linesOf(ev('__kk')), b=linesOf(ev('__mk'));
   if(a.indexOf('Laptop stand')===-1||b.indexOf('Laptop stand')===-1) throw new Error('seed did not put the line in both: '+JSON.stringify([a,b]));
   const chips=cardChips(); if(!chips) throw new Error('no card');
   if(chips.filter(t=>t==='Laptop stand').length!==1) throw new Error('card should show it once: '+JSON.stringify(chips));
 });

 check('removing it from the Keys bucket removes it from the MD bucket too', ()=>{
   seedKeysMD();
   ev(`removeSetupLine(__kk,'keys','Laptop stand')`);
   const a=linesOf(ev('__kk')), b=linesOf(ev('__mk'));
   if(a.indexOf('Laptop stand')!==-1) throw new Error('still in the bucket it was removed from');
   if(b.indexOf('Laptop stand')!==-1) throw new Error('HOLDOVER: still in the other bucket — this is the bug Dillon reported');
 });

 check('...and it is gone from the ✓ Items card', ()=>{
   seedKeysMD(); ev(`removeSetupLine(__kk,'keys','Laptop stand')`);
   const chips=cardChips(); if(!chips) throw new Error('no card');
   if(chips.indexOf('Laptop stand')!==-1) throw new Error('card still shows the removed line: '+JSON.stringify(chips));
 });

 check('restoring it brings it back to BOTH buckets', ()=>{
   seedKeysMD(); ev(`removeSetupLine(__kk,'keys','Laptop stand'); restoreSetupLine(__kk,'keys','Laptop stand')`);
   const a=linesOf(ev('__kk')), b=linesOf(ev('__mk'));
   if(a.indexOf('Laptop stand')===-1||b.indexOf('Laptop stand')===-1) throw new Error('restore left one bucket suppressed: '+JSON.stringify([a,b]));
 });

 check('a remove never leaks to a DIFFERENT person who has the same line', ()=>{
   seedKeysMD();
   ev(`const ok=stableSetupKey('Other Person','band','keys');
       state.instruments.push({id:'i_k2',label:'Keys 2',assignedTo:'Other Person',pack:'Keys',tag:'Keys'});
       state.setupItems[ok]={selections:{extras:['k_laptop']},customItems:[],seeded:true,items:[]}; rebuildPersonItems(ok,'keys'); window.__ok=ok;
       removeSetupLine(__kk,'keys','Laptop stand');`);
   if(linesOf(ev('__ok')).indexOf('Laptop stand')===-1) throw new Error('removed it from the wrong person');
 });

 console.log('--- an auto-added mic/boom is never stored twice ---');

 check('a bucket that stores the auto mic ALSO as a customItem is repaired on load to one copy', ()=>{
   ev(`state.vocalists=[{id:'v1',name:'Sam Singer',micAssigned:'SM58'}]; state.assignments=['v1',null,null,null,null,null,null,null];
       const vk=stableSetupKey('Sam Singer','vocalist','vocals');
       state.setupItems={}; state.setupItems[vk]={selections:{},customItems:[{id:'si_mic_x',text:'SM58'}],seeded:true,
         items:[{id:'si_mic_x',text:'SM58',doneThisService:false,scopeOneTime:false,kind:'mic',autoAdded:true}],micItemText:'SM58'};
       window.__vk=vk; repairSetupBuckets();`);
   const ci=JSON.parse(ev('JSON.stringify(state.setupItems[__vk].customItems)'));
   if(ci.some(c=>c.text==='SM58')) throw new Error('the auto-added mic is still duplicated as a customItem');
 });

 check('the editor for that vocalist lists the mic once', ()=>{
   const host=doc.createElement('div'); doc.body.appendChild(host);
   ev(`renderPersonSetupEditor(arguments[0], __vk, 'vocals')`.replace('arguments[0]','document.body.lastElementChild'));
   const rows=Array.from(host.querySelectorAll('.sp-line-text')).map(x=>x.textContent.trim());
   if(rows.filter(t=>t==='SM58').length>1) throw new Error('editor shows the mic '+rows.filter(t=>t==='SM58').length+' times');
 });

 console.log('--- legacy |none buckets never render ---');

 check('a stale |band|none bucket for someone on the roster is not enumerated and adds no card', ()=>{
   seedKeysMD();
   ev(`state.setupItems[stableSetupKey('Pat Player','band','')]={selections:{},customItems:[],seeded:true,
        items:[{id:'x1',text:'LEGACY SENTINEL LINE',doneThisService:false,scopeOneTime:false}]};`);
   const rows=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().map(r=>r.stableKey))`));
   if(rows.some(k=>/\\|none$/.test(k))) throw new Error('enumerator produced a |none row: '+JSON.stringify(rows));
   const chips=cardChips();
   if(chips && chips.indexOf('LEGACY SENTINEL LINE')!==-1) throw new Error('legacy bucket leaked onto the card');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
