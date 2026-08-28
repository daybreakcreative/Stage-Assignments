// The vocal mic (capsule) must be EDITABLE from the per-person setup editor AND from the
// ✓ Items card — reported 2026-08-27: "their set up items 'set up' page allows changing
// everything except the mic capsule i want them on ... its read only in both places."
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

 const seed=()=>ev(`
   state.serviceOrder=[];
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'},
                    {id:'v2',name:'Marcus Donalson',micAssigned:'D:Facto'}];
   state.assignments=['v1','v2',null,null,null,null,null,null];
   state.instruments=[{id:'i1',label:'Bass',assignedTo:'Evan Forniss',pack:'Bass'}];
   state.shadows=[]; state.hosts={}; state.mdSoloName=null; state.musicDirectorId=null;
 `);

 console.log('--- setter ---');

 check('setVocalistMicByName sets micAssigned and reports the change', ()=>{
   seed();
   const changed=ev("setVocalistMicByName('Kaeli Hearn','SE V7')");
   if(changed!==true) throw new Error('expected true, got '+changed);
   if(ev("state.vocalists.find(v=>v.id==='v1').micAssigned")!=='SE V7') throw new Error('micAssigned not set');
 });

 check('setVocalistMicByName can CLEAR the mic', ()=>{
   seed();
   ev("setVocalistMicByName('Kaeli Hearn','')");
   if(ev("state.vocalists.find(v=>v.id==='v1').micAssigned")!=='') throw new Error('mic not cleared');
 });

 check('setVocalistMicByName is a no-op for an unknown name', ()=>{
   seed();
   if(ev("setVocalistMicByName('Nobody At All','SE V7')")!==false) throw new Error('should return false');
 });

 console.log('--- per-person setup editor ---');

 check('the vocals setup editor renders a mic select preset to the current mic', ()=>{
   seed();
   const host=doc.createElement('div'); host.id='__ed'; doc.body.appendChild(host);
   ev("renderPersonSetupEditor(document.getElementById('__ed'), stableSetupKey('Kaeli Hearn','vocalist','vocals'), 'vocals');");
   const sel=doc.querySelector('#__ed .sp-mic-select');
   if(!sel) throw new Error('no mic select in the vocals setup editor');
   if(sel.value!=='KMS105') throw new Error('select not preset to current mic, got '+sel.value);
 });

 check('changing that select writes micAssigned', ()=>{
   seed();
   const host=doc.getElementById('__ed')||doc.body.appendChild(Object.assign(doc.createElement('div'),{id:'__ed'}));
   ev("renderPersonSetupEditor(document.getElementById('__ed'), stableSetupKey('Kaeli Hearn','vocalist','vocals'), 'vocals');");
   const sel=doc.querySelector('#__ed .sp-mic-select');
   sel.value='KSM9'; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev("state.vocalists.find(v=>v.id==='v1').micAssigned")!=='KSM9') throw new Error('mic not written from editor');
 });

 check('a BAND setup editor renders NO mic select (mics are a vocal concern)', ()=>{
   seed();
   const host=doc.createElement('div'); host.id='__ed2'; doc.body.appendChild(host);
   ev("renderPersonSetupEditor(document.getElementById('__ed2'), stableSetupKey('Evan Forniss','band','bass'), 'bass');");
   if(doc.querySelector('#__ed2 .sp-mic-select')) throw new Error('band editor should not offer a vocal mic');
 });

 console.log('--- ✓ Items card ---');

 check('the ✓ Items vocalist card renders an editable mic select', ()=>{
   seed();
   ev("renderSetupChecklist();");
   const sel=doc.querySelector('#setupChecklistView .si-mic-select');
   if(!sel) throw new Error('no mic select on the ✓ Items card');
   if(sel.value!=='KMS105' && sel.value!=='D:Facto') throw new Error('unexpected preset value '+sel.value);
 });

 check('changing the ✓ Items mic select writes micAssigned', ()=>{
   seed();
   ev("renderSetupChecklist();");
   const sel=doc.querySelector('#setupChecklistView .si-mic-select[data-voc-name="Kaeli Hearn"]');
   if(!sel) throw new Error('no mic select for Kaeli');
   sel.value='Beta 58'; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev("state.vocalists.find(v=>v.id==='v1').micAssigned")!=='Beta 58') throw new Error('mic not written from ✓ Items');
 });

 check('a mic at capacity is disabled for OTHER people but selectable for its owner', ()=>{
   seed();
   // KSM11 total:1 — give it to Marcus, then Kaeli must see it disabled.
   ev("setVocalistMicByName('Marcus Donalson','KSM11');");
   const host=doc.createElement('div'); host.id='__ed3'; doc.body.appendChild(host);
   ev("renderPersonSetupEditor(document.getElementById('__ed3'), stableSetupKey('Kaeli Hearn','vocalist','vocals'), 'vocals');");
   const opt=[...doc.querySelectorAll('#__ed3 .sp-mic-select option')].find(o=>o.value==='KSM11');
   if(!opt) throw new Error('KSM11 option missing');
   if(!opt.disabled) throw new Error('a mic at capacity should be disabled for someone else');
   // and for Marcus himself it must remain selectable
   const host4=doc.createElement('div'); host4.id='__ed4'; doc.body.appendChild(host4);
   ev("renderPersonSetupEditor(document.getElementById('__ed4'), stableSetupKey('Marcus Donalson','vocalist','vocals'), 'vocals');");
   const own=[...doc.querySelectorAll('#__ed4 .sp-mic-select option')].find(o=>o.value==='KSM11');
   if(own.disabled) throw new Error("the owner's own mic must stay selectable");
 });

 check('the mic chip on the card follows the new mic', ()=>{
   seed();
   ev("setVocalistMicByName('Kaeli Hearn','Beta 87'); renderSetupChecklist();");
   const txt=doc.getElementById('setupChecklistView').textContent;
   if(txt.indexOf('Beta 87')===-1) throw new Error('chip did not follow the mic change');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
