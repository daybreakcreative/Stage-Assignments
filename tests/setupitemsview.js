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

 check('syncAssignedMicItem is idempotent for the SAME mic (stable id + done-state, no dupes)', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   // Resolve p ONCE, then drive the helper repeatedly on the SAME assigned mic — reconciling
   // by text must reuse the existing item (stable id, preserved done-state, never duplicated).
   const out=JSON.parse(ev(`JSON.stringify((function(){
     var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1');
     syncAssignedMicItem(p);
     var m=state.setupItems[${JSON.stringify(key)}].items.find(i=>i.kind==='mic');
     var id0=m.id; m.doneThisService=true;           // user checks it off
     syncAssignedMicItem(p); syncAssignedMicItem(p); // repeat renders of the same mic
     var mics=state.setupItems[${JSON.stringify(key)}].items.filter(i=>i.kind==='mic');
     return {id0:id0, count:mics.length, item:mics[0]};
   })())`));
   if(out.count!==1) throw new Error('expected 1 mic item after repeat syncs, got '+out.count);
   if(out.item.id!==out.id0) throw new Error('mic item id should be stable when the mic is unchanged');
   if(out.item.text!=='Beta 58 #1') throw new Error('mic text should be unchanged, got '+out.item.text);
   if(out.item.doneThisService!==true) throw new Error('done-state should be preserved across same-mic syncs');
 });

 check('syncAssignedMicItem replaces the item on a rename (no in-between reconstruct), no dupes', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   // Resolve p ONCE; change the assigned mic, then sync twice. Reconciliation drops the stale
   // text and creates the new one — exactly one item with the new text, no duplicates.
   const out=JSON.parse(ev(`JSON.stringify((function(){
     var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1');
     syncAssignedMicItem(p);
     state.vocalists.find(v=>v.id==='v1').micAssigned='SM7B #9';
     syncAssignedMicItem(p); syncAssignedMicItem(p);
     var items=state.setupItems[${JSON.stringify(key)}].items||[];
     return {oldCount:items.filter(i=>i.text==='Beta 58 #1').length,
             newCount:items.filter(i=>i.text==='SM7B #9').length,
             mics:items.filter(i=>i.kind==='mic').length};
   })())`));
   if(out.oldCount!==0) throw new Error('old mic text should be gone, got '+out.oldCount);
   if(out.newCount!==1) throw new Error('expected exactly 1 item with the new mic text, got '+out.newCount);
   if(out.mics!==1) throw new Error('expected exactly 1 kind===mic item, got '+out.mics);
 });

 check('syncAssignedMicItem removes the mic item when assignment cleared', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   ev(`(function(){var p=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p); state.vocalists.find(v=>v.id==='v1').micAssigned=''; syncAssignedMicItem(p);})()`);
   const n=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).filter(function(i){return i.kind==='mic';}).length`);
   if(n!==0) throw new Error('mic item should be removed, got '+n);
 });

 check('syncAssignedMicItem survives the RENDER FLOW (getStageAreas rebuild) without duplicating', ()=>{
   // v1 (Ava) has a mic and NO catalog selections, so reconstructSetupBucket rebuilds her
   // bucket via newSetupItem on EVERY getStageAreas() call — stripping `kind`/`autoAdded` and
   // regenerating ids. Two render cycles (getStageAreas→sync, ×2) must not produce a duplicate.
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   const out=JSON.parse(ev(`JSON.stringify((function(){
     var p1=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p1);
     var p2=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p2);
     var items=state.setupItems[${JSON.stringify(key)}].items||[];
     var mic=items.filter(function(i){return i.text==='Beta 58 #1';});
     return {micCount:mic.length, kind:(mic[0]||{}).kind};
   })())`));
   if(out.micCount!==1) throw new Error('expected exactly 1 item with the mic text after 2 render cycles, got '+out.micCount);
   if(out.kind!=='mic') throw new Error('mic item should be re-tagged kind===mic after final sync, got '+out.kind);
 });

 check('syncAssignedMicItem renames through the render flow (old text gone, one new item)', ()=>{
   seed();
   const key=ev(`stableSetupKey('Ava Chen','vocalist','vocals')`);
   const out=JSON.parse(ev(`JSON.stringify((function(){
     var p1=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p1);
     state.vocalists.find(v=>v.id==='v1').micAssigned='SM7B #9';
     var p2=getStageAreas().find(a=>a.id==='area_vocals').people.find(x=>x.vocId==='v1'); syncAssignedMicItem(p2);
     var items=state.setupItems[${JSON.stringify(key)}].items||[];
     return {oldCount:items.filter(function(i){return i.text==='Beta 58 #1';}).length,
             newCount:items.filter(function(i){return i.text==='SM7B #9';}).length,
             newKind:(items.find(function(i){return i.text==='SM7B #9';})||{}).kind};
   })())`));
   if(out.oldCount!==0) throw new Error('old mic text should be gone, got '+out.oldCount);
   if(out.newCount!==1) throw new Error('expected exactly 1 item with the new mic text, got '+out.newCount);
   if(out.newKind!=='mic') throw new Error('renamed mic item should be kind===mic, got '+out.newKind);
 });

 console.log('--- render: chip cards ---');
 function renderItems(){ seed(); ev(`state.viewMode='setup-items'; renderSetupItemsView();`); }

 check('renders a card grid with one card per person', ()=>{
   renderItems();
   if(!doc.querySelector('#si_content .si-grid')) throw new Error('no .si-grid');
   const cards=doc.querySelectorAll('#si_content .si-card');
   // 5 cards: 3 vocalists + Pat (Keys area) + Pat again (separate MD area). getStageAreas
   // surfaces an MD who plays a non-'md' instrument in BOTH its instrument area AND an MD area.
   if(cards.length!==5) throw new Error('expected 5 cards (3 vocals + Pat/Keys + Pat/MD), got '+cards.length);
 });

 check('vocalist card shows Vocal N and a checkable mic chip; band MD shows · MD', ()=>{
   renderItems();
   var ava=[].find.call(doc.querySelectorAll('.si-card'),c=>/Ava Chen/.test(c.textContent));
   if(!/Vocal 1/.test(ava.querySelector('.si-card-role').textContent)) throw new Error('Ava should be Vocal 1');
   var micChip=ava.querySelector('.si-chip.mic');
   if(!micChip) throw new Error('Ava should have a mic chip');
   if(!/Beta 58 #1/.test(micChip.textContent)) throw new Error('mic chip text wrong');
   if(!micChip.querySelector('input[data-action="toggle-item"]')) throw new Error('mic chip should be checkable');
   var pat=[].find.call(doc.querySelectorAll('.si-card'),c=>/Pat Reed/.test(c.textContent));
   if(!/· MD/.test(pat.querySelector('.si-card-role').textContent)) throw new Error('Pat should be · MD');
 });

 check('IEM shows as a note, not a chip and not counted', ()=>{
   renderItems();
   var ava=[].find.call(doc.querySelectorAll('.si-card'),c=>/Ava Chen/.test(c.textContent));
   var note=ava.querySelector('.si-iem-note');
   if(!note||!/Pack A/.test(note.textContent)) throw new Error('Ava IEM note missing');
   // the note must NOT be a toggle-item
   if(note.querySelector('[data-action="toggle-item"]')) throw new Error('IEM note must not be checkable');
 });

 check('person with no items shows the No setup needed state', ()=>{
   seed();
   ev(`state.vocalists.find(v=>v.id==='v3').micAssigned='';`); // Mia: no mic, no items
   ev(`state.viewMode='setup-items'; renderSetupItemsView();`);
   var mia=[].find.call(doc.querySelectorAll('.si-card'),c=>/Mia Torres/.test(c.textContent));
   if(!mia.querySelector('.si-none')) throw new Error('Mia should show .si-none');
   if(mia.querySelector('.si-chip')) throw new Error('Mia should have no chips');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
