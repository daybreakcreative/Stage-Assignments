// FEATURE: the LIVE ✓ Items page (renderSetupChecklist / #setupChecklistView, opened by the
// ✓ Items nav button) is redesigned into grouped rich cards: a responsive grid of per-person
// cards with role badge (vocalists = "Vocal N"), a progress ring, setup items as click-to-toggle
// chips, the assigned vocal mic as a highlighted chip, IEM as an uncounted note, and a
// "No setup needed" empty state. Reuses the .si-* card CSS. Done-state = getChecklistState().
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

function seedAndRender(){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};`);
 ev(`state.setupItems={}; state.checklistState={}; state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[];`);
 ev(`state.config.voxIemPacks=['Pack A','Pack B','Pack C','Pack D','Pack E','Pack F','Pack G','Pack H'];`);
 ev(`state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Reed'}];`);
 ev(`state.musicDirectorId='i_keys';`);
 ev(`state.vocalists=[{id:'v1',name:'Ava Chen',isWL:true,micAssigned:'Beta 58 #1'},{id:'v2',name:'Noah Brooks',micAssigned:''}];`);
 ev(`state.assignments=['v1','v2'].concat(new Array(MAX_VOCALISTS-2).fill(null));`);
 ev(`state.service={name:'Sunday Service',date:'2026-07-19'};`);
 ev(`renderSetupChecklist();`);
}
function card(nameRe){ return [].find.call(doc.querySelectorAll('#setupChecklistView .si-card'), c=>nameRe.test(c.textContent)); }

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};');

 check('checklist renders a .si-grid of .si-card person cards', ()=>{
   seedAndRender();
   if(!doc.querySelector('#setupChecklistView .si-grid')) throw new Error('no .si-grid in checklist view');
   if(doc.querySelectorAll('#setupChecklistView .si-card').length < 1) throw new Error('no .si-card cards');
   // old markup should be gone
   if(doc.querySelector('#setupChecklistView .scv-person')) throw new Error('legacy .scv-person still rendered');
 });

 check('vocalist card shows Vocal N and a highlighted mic chip; IEM as a note', ()=>{
   seedAndRender();
   const ava=card(/Ava Chen/);
   if(!ava) throw new Error('no Ava card');
   if(!/Vocal 1/.test(ava.querySelector('.si-card-role').textContent)) throw new Error('Ava role not "Vocal 1": '+ava.querySelector('.si-card-role').textContent);
   const mic=ava.querySelector('.si-chip.mic');
   if(!mic||!/Beta 58 #1/.test(mic.textContent)) throw new Error('Ava mic chip missing');
   const note=ava.querySelector('.si-iem-note');
   if(!note||!/Pack A/.test(note.textContent)) throw new Error('Ava IEM note missing');
   if(note.hasAttribute('data-item-key')) throw new Error('IEM note must not be checkable');
 });

 check('clicking a chip toggles checklist state and updates the card count', ()=>{
   seedAndRender();
   const ava=card(/Ava Chen/);
   const chip=ava.querySelector('.si-chip[data-item-key]');
   const key=chip.getAttribute('data-item-key');
   chip.dispatchEvent(new window.Event('click',{bubbles:true}));
   const on=ev(`(getChecklistState()[${JSON.stringify(key)}]===true)`);
   if(!on) throw new Error('checklist state not toggled on for '+key);
   if(!chip.classList.contains('ck')) throw new Error('chip did not get ck class');
 });

 check('the whole-view empty state still works when nothing is configured', ()=>{
   // Live-view behavior preserved: people with zero items are omitted; if NOTHING is configured
   // the friendly "No setup items configured yet" empty state shows (not a grid).
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};`);
   ev(`state.setupItems={}; state.checklistState={}; state.shadows=[]; state.config.stageFeatures=[];`);
   ev(`state.instruments=[]; state.musicDirectorId=null; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null);`);
   ev(`state.service={name:'S',date:'2026-07-19'};`);
   ev(`renderSetupChecklist();`);
   if(doc.querySelector('#setupChecklistView .si-card')) throw new Error('should be no cards when nothing configured');
   if(!/No setup items configured/i.test(doc.getElementById('setupChecklistView').textContent)) throw new Error('missing whole-view empty state');
 });

 check('MD gets an auto "Boom mic stand" chip on their instrument card', ()=>{
   seedAndRender(); // Pat Reed = MD on Keys
   const pat=card(/Pat Reed/);
   if(!pat) throw new Error('no Pat card (MD boom should give him an item)');
   if(!/Boom mic stand/.test(pat.textContent)) throw new Error('MD boom-mic chip missing');
 });

 check('a band position with no assigned pack shows NO IEM note (no "IEM Drums")', ()=>{
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};updateSetupProgressBadge=function(){};`);
   ev(`state.setupItems={}; state.checklistState={}; state.shadows=[]; state.config.stageFeatures=[]; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.musicDirectorId=null;`);
   ev(`state.instruments=[{id:'i_dr',label:'Drums',assignedTo:'Marcus Lee'}];`); // no .pack
   ev(`state.service={name:'S',date:'2026-07-19'};`);
   const k=ev(`stableSetupKey('Marcus Lee','band','drums')`);
   ev(`(function(){seedPersonSetup(${JSON.stringify(k)},'drums'); var b=state.setupItems[${JSON.stringify(k)}]; b.items=[{id:'d1',text:'House kit',doneThisService:false}];})();`);
   ev(`renderSetupChecklist();`);
   const marcus=card(/Marcus Lee/);
   if(!marcus) throw new Error('no Marcus card');
   if(marcus.querySelector('.si-iem-note')) throw new Error('drummer with no pack should have NO IEM note');
   // but WITH a pack, it should show
   ev(`state.instruments[0].pack='Aviom 4'; renderSetupChecklist();`);
   const marcus2=card(/Marcus Lee/);
   if(!marcus2.querySelector('.si-iem-note')||!/Aviom 4/.test(marcus2.querySelector('.si-iem-note').textContent)) throw new Error('assigned pack should show as IEM note');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
