// A keys player who is the MD gets an auto-added "Boom mic stand". Reported 2026-08-28 as the
// same class of bug as Jack Grubbs' amp line: it can't be removed. Two layers here —
//  (1) ensureBoom writes straight into bucket.items, so the line is not in resolveSetupItems and
//      therefore never appeared in the editor's removable list at all; and
//  (2) ensureBoom re-adds it on EVERY collectChecklistItems() pass, so even an API-level removal
//      came straight back.
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

 const K="stableSetupKey('Santi Reyes','band','keys')";
 // Santi on Keys AND the Music Director — the combination that triggers the boom auto-add.
 const seed=()=>ev(`
   state.setupItems={}; state.config.setupCatalog=null; state.config.setupDefaults={};
   state.vocalists=[]; state.assignments=[]; state.shadows=[]; state.hosts={};
   state.mdSoloName=null;
   state.instruments=[{id:'inst_keys',label:'Keys',tag:'keys',assignedTo:'Santi Reyes',pack:'Keys'}];
   state.musicDirectorId='inst_keys';
   var k=${K};
   seedPersonSetup(k,'keys');
   state.setupItems[k].selections={ source:'k_house', soundsfrom:'k_dante' };
   state.setupItems[k].customItems=[];
   rebuildPersonItems(k,'keys');
   collectChecklistItems();
 `);
 const texts=()=>JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));

 check('the reported state reproduces: an auto "Boom mic stand" is on the keys/MD card', ()=>{
   seed();
   if(texts().indexOf('Boom mic stand')===-1) throw new Error('did not reproduce: '+JSON.stringify(texts()));
 });

 check('the keys implied line (Dante → thunderbolt adapter) is present', ()=>{
   seed();
   if(texts().indexOf('Needs network — thunderbolt adapter')===-1)
     throw new Error('implied keys line missing: '+JSON.stringify(texts()));
 });

 check('the implied keys line is removable and stays gone across a re-enumeration', ()=>{
   seed();
   ev(`removeSetupLine(${K},'keys','Needs network — thunderbolt adapter'); collectChecklistItems();`);
   if(texts().indexOf('Needs network — thunderbolt adapter')!==-1)
     throw new Error('implied keys line came back: '+JSON.stringify(texts()));
 });

 check('LAYER 2: removing the boom mic keeps it gone after collectChecklistItems re-runs', ()=>{
   seed();
   ev(`removeSetupLine(${K},'keys','Boom mic stand'); collectChecklistItems();`);
   if(texts().indexOf('Boom mic stand')!==-1)
     throw new Error('auto boom mic was re-added after removal: '+JSON.stringify(texts()));
 });

 check('restoring the boom mic brings it back', ()=>{
   seed();
   ev(`removeSetupLine(${K},'keys','Boom mic stand'); collectChecklistItems();`);
   ev(`restoreSetupLine(${K},'keys','Boom mic stand'); collectChecklistItems();`);
   if(texts().indexOf('Boom mic stand')===-1) throw new Error('restore failed: '+JSON.stringify(texts()));
 });

 check('removing the boom does NOT disturb the rest of the keys list', ()=>{
   seed();
   ev(`removeSetupLine(${K},'keys','Boom mic stand'); collectChecklistItems();`);
   const t=texts();
   if(t.indexOf('Keyboard — House Keyboard')===-1) throw new Error('lost the source line: '+JSON.stringify(t));
   if(t.indexOf('User computer via Dante')===-1) throw new Error('lost the Dante line: '+JSON.stringify(t));
   if(t.indexOf('Needs network — thunderbolt adapter')===-1) throw new Error('lost the implied line: '+JSON.stringify(t));
 });

 console.log('--- editor UI ---');

 check('LAYER 1: the auto boom mic is LISTED in the editor with a remove control', ()=>{
   seed();
   const host=doc.createElement('div'); host.id='__ed'; doc.body.appendChild(host);
   ev(`renderPersonSetupEditor(document.getElementById('__ed'), ${K}, 'keys');`);
   const labels=[...doc.querySelectorAll('#__ed .sp-line-row .sp-line-text')].map(e=>e.textContent);
   if(labels.indexOf('Boom mic stand')===-1)
     throw new Error('auto boom mic not listed, so it cannot be removed: '+JSON.stringify(labels));
 });

 check('clicking its remove control drops it for good', ()=>{
   seed();
   const host=doc.getElementById('__ed')||doc.body.appendChild(Object.assign(doc.createElement('div'),{id:'__ed'}));
   ev(`renderPersonSetupEditor(document.getElementById('__ed'), ${K}, 'keys');`);
   const row=[...doc.querySelectorAll('#__ed .sp-line-row')]
     .find(r=>(r.querySelector('.sp-line-text')||{}).textContent==='Boom mic stand');
   if(!row) throw new Error('no boom row to click');
   row.querySelector('.sp-line-remove').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
   ev('collectChecklistItems();');
   if(texts().indexOf('Boom mic stand')!==-1) throw new Error('still there after the click');
 });

 check('the assigned vocal mic is NOT given a remove control (the dropdown owns it)', ()=>{
   ev(`state.setupItems={}; state.config.setupDefaults={};
       state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'}];
       state.assignments=['v1',null,null,null,null,null,null,null];
       state.instruments=[]; state.shadows=[]; state.hosts={}; state.musicDirectorId=null;
       collectChecklistItems();`);
   const host=doc.createElement('div'); host.id='__ed2'; doc.body.appendChild(host);
   ev(`renderPersonSetupEditor(document.getElementById('__ed2'), stableSetupKey('Kaeli Hearn','vocalist','vocals'), 'vocals');`);
   const labels=[...doc.querySelectorAll('#__ed2 .sp-line-row .sp-line-text')].map(e=>e.textContent);
   if(labels.indexOf('KMS105')!==-1)
     throw new Error('the mic should be changed with the MIC dropdown, not removed as a line');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
