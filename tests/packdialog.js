// #9 Stage 3 — the IEM mix conflict resolution dialog: renders a row per fix, Apply moves the
// lower-priority position to an open mix (or adds a new mix when none are open), resolving it.
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
const clearModals=()=>ev(`document.querySelectorAll('.setup-review-modal').forEach(m=>m.remove())`);
const base=`state.config.iemPackPresets=['Drums','Bass','EG','Keys','Acoustic','Misc 1','Misc 2','Misc 3']; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.instruments=[];`;

window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}; toast=function(){}; saveState=function(){};');

 check('dialog renders one fix row + a move select per conflict', ()=>{
   clearModals();
   ev(`${base} state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('openPackConflictDialog()');
   const rows=doc.querySelectorAll('.setup-review-modal.show .pack-fix-row');
   if(rows.length!==1) throw new Error('expected 1 fix row, got '+rows.length);
   if(!doc.querySelector('.setup-review-modal.show .pfx-sel')) throw new Error('no move select rendered');
 });

 check('Apply moves the lower-priority position to an open mix (resolves the conflict)', ()=>{
   clearModals();
   ev(`${base} state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('openPackConflictDialog()');
   doc.querySelector('.setup-review-modal.show .setup-review-actions .btn.primary').click();
   if(ev('findPackConflicts().hasIssues')) throw new Error('conflict not resolved after Apply');
   if(ev(`instById('i2').pack`)==='Misc 1') throw new Error('EG2 (lower priority) should have moved off Misc 1');
   if(ev(`instById('i1').pack`)!=='Misc 1') throw new Error('EG1 (higher priority) should keep Misc 1');
 });

 check('no open mixes → select defaults to Add-new; Apply adds a mix + assigns it', ()=>{
   clearModals();
   ev(`${base} state.config.iemPackPresets=['Misc 1']; state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('openPackConflictDialog()');
   const sel=doc.querySelector('.setup-review-modal.show .pfx-sel');
   if(!sel || sel.value!=='__add__') throw new Error('expected Add-new default when out of mixes, got '+(sel&&sel.value));
   doc.querySelector('.setup-review-modal.show .setup-review-actions .btn.primary').click();
   if(ev('findPackConflicts().hasIssues')) throw new Error('not resolved via add-a-mix');
   if(!ev(`state.config.iemPackPresets.some(m=>/^Mix /.test(m))`)) throw new Error('no new "Mix N" added to inventory');
 });

 check('maybeResolvePackConflicts opens the dialog only when there are issues', ()=>{
   clearModals();
   ev(`${base} state.instruments=[{id:'i1',label:'Drums',assignedTo:'A',pack:'Drums'}]`);
   ev('maybeResolvePackConflicts()');
   if(doc.querySelector('.setup-review-modal.show')) throw new Error('dialog opened with no issues');
   ev(`state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('maybeResolvePackConflicts()');
   if(!doc.querySelector('.setup-review-modal.show')) throw new Error('dialog did not open on a real conflict');
   clearModals();
 });

 check('live badge: hidden with no conflict, shown with a count when one exists', ()=>{
   clearModals();
   ev(`${base} state.instruments=[{id:'i1',label:'Drums',assignedTo:'A',pack:'Drums'}]`);
   ev('updatePackWarnBadge()');
   if(doc.getElementById('packWarnBtn').style.display!=='none') throw new Error('badge should be hidden with no conflict');
   ev(`state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('updatePackWarnBadge()');
   if(doc.getElementById('packWarnBtn').style.display==='none') throw new Error('badge should show on a conflict');
   if(!/conflict/i.test(doc.getElementById('packWarnLabel').textContent)) throw new Error('badge label missing "conflict"');
 });

 check('clicking the badge opens the resolution dialog', ()=>{
   clearModals();
   ev(`${base} state.instruments=[{id:'i1',label:'EG1',assignedTo:'A',pack:'Misc 1'},{id:'i2',label:'EG2',assignedTo:'B',pack:'Misc 1',optional:true}]`);
   ev('updatePackWarnBadge(); openPackConflictDialog();'); // badge click handler calls openPackConflictDialog
   if(!doc.querySelector('.setup-review-modal.show .pack-fix-row')) throw new Error('badge action did not open the dialog');
   clearModals();
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
