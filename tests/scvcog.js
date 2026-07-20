// ✓ Items per-person cog: each person card carries their setup buckets; a cog opens a per-person
// editor (one section per role); editing writes the person's bucket; church defaults untouched.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

function seedPeople(){
  ev('renderAll=function(){};saveState=function(){};toast=function(){};');
  ev(`
    state.vocalists=[{id:'v1',name:'Ava Chen',leadsSongs:false,isWL:false,micAssigned:''}];
    state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v1';
    state.instruments=[{id:'inst_keys',label:'Keys',pack:'',assignedTo:'Ben Rowe',vocalistPlayer:null}];
    state.musicDirectorId='';
    if(!state.config.setupDefaults) state.config.setupDefaults={};
    state.config.setupDefaults.vocals={selections:{options:['v_stand']},customOptions:[]};
    state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};
    seedPersonSetup(stableSetupKey('Ava Chen','vocalist','vocals'),'vocals');
    seedPersonSetup(stableSetupKey('Ben Rowe','band','keys'),'keys');
  `);
  return JSON.parse(ev('JSON.stringify(collectChecklistItems())'));
}

window.addEventListener('load',()=>setTimeout(()=>{

 check('collectChecklistItems: each person entry carries a buckets[] with stableKey/typeKey/label', ()=>{
   const secs=seedPeople();
   const people=[].concat(...secs.filter(s=>s.key==='vocalists'||s.key==='band').map(s=>s.people||[]));
   if(!people.length) throw new Error('no people rendered');
   people.forEach(p=>{
     if(!Array.isArray(p.buckets)||!p.buckets.length) throw new Error('person '+p.name+' has no buckets');
     const b=p.buckets[0];
     if(!b.stableKey||!('typeKey' in b)||!b.label) throw new Error('bucket missing fields: '+JSON.stringify(b));
   });
   const stage=[].concat(...secs.filter(s=>s.key==='stage').map(s=>s.people||[]));
   stage.forEach(p=>{ if(p.buckets&&p.buckets.length) throw new Error('stage card should have no buckets'); });
 });

 function openChecklist(){
   ev('renderAll=function(){};saveState=function(){};toast=function(){};');
   ev(`
     state.vocalists=[{id:'v1',name:'Ava Chen',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v1';
     state.instruments=[{id:'inst_keys',label:'Keys',pack:'',assignedTo:'Ben Rowe',vocalistPlayer:null}];
     state.musicDirectorId='';
     if(!state.config.setupDefaults) state.config.setupDefaults={};
     state.config.setupDefaults.vocals={selections:{options:['v_stand']},customOptions:[]};
     state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};
     seedPersonSetup(stableSetupKey('Ava Chen','vocalist','vocals'),'vocals');
     seedPersonSetup(stableSetupKey('Ben Rowe','band','keys'),'keys');
   `);
   ev('renderSetupChecklist();');
 }

 check('each person card has a cog; stage cards do not', ()=>{
   openChecklist();
   const cards=[].slice.call(doc.querySelectorAll('#setupChecklistView .si-card'));
   if(!cards.length) throw new Error('no cards');
   cards.forEach(c=>{ if(!c.querySelector('.si-cog')) throw new Error('a person card is missing its cog'); });
 });

 check('clicking the cog opens a per-person editor modal', ()=>{
   openChecklist();
   const cog=doc.querySelector('#setupChecklistView .si-cog');
   cog.dispatchEvent(new window.Event('click',{bubbles:true}));
   const modal=doc.querySelector('.setup-review-modal.show');
   if(!modal) throw new Error('no modal opened');
   if(!modal.querySelector('.sp-groups')) throw new Error('modal should mount a setup editor (.sp-groups)');
 });

 check('editing via the cog grows the person bucket and leaves church defaults untouched', ()=>{
   // A prior check leaves its modal open (it never clicks "Done"); clear it so the
   // upcoming querySelector('.show') can't pick up that stale, earlier modal instead
   // of the one this check opens.
   [].slice.call(doc.querySelectorAll('.setup-review-modal.show')).forEach(m=>m.remove());
   openChecklist();
   const before=ev('JSON.stringify(state.config.setupDefaults||{})');
   const key=ev(`stableSetupKey('Ben Rowe','band','keys')`);
   const n0=ev(`(state.setupItems['${key}'].items||[]).length`);
   const cards=[].slice.call(doc.querySelectorAll('#setupChecklistView .si-card'));
   const benCard=cards.find(c=>/Ben Rowe/.test((c.querySelector('.si-card-name')||{}).textContent||''));
   benCard.querySelector('.si-cog').dispatchEvent(new window.Event('click',{bubbles:true}));
   const modal=doc.querySelector('.setup-review-modal.show');
   const opt=[].slice.call(modal.querySelectorAll('.sp-opt input[type=checkbox]')).find(i=>!i.checked);
   if(!opt) throw new Error('no checkbox option to toggle in the editor');
   opt.checked=true; opt.dispatchEvent(new window.Event('change',{bubbles:true}));
   const n1=ev(`(state.setupItems['${key}'].items||[]).length`);
   if(!(n1>n0)) throw new Error('bucket items should grow after checking an option ('+n0+'→'+n1+')');
   const after=ev('JSON.stringify(state.config.setupDefaults||{})');
   if(after!==before) throw new Error('church setupDefaults must be untouched');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
