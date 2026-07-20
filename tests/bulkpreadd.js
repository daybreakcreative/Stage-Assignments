// FEATURE: Bulk pre-add people (Phase 1) — a single-page grid to list people (name + role) and
// pre-fill their setup + mic preferences, writing to the SAME stores the check-off/post-pull use.
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
const rowFor=re=>[].find.call(doc.querySelectorAll('#bulkPreaddModal [data-bulk-row]'), r=>re.test(r.textContent) || re.test((r.querySelector('.bulk-name')||{}).value||''));

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 check('openBulkPreadd builds the modal with add + roster + save controls', ()=>{
   ev('openBulkPreadd();');
   if(!doc.getElementById('bulkPreaddModal')) throw new Error('no #bulkPreaddModal');
   if(!doc.getElementById('bulkAddRow')) throw new Error('no add-person control');
   if(!doc.getElementById('bulkSeedRoster')) throw new Error('no seed-from-roster control');
   if(!doc.getElementById('bulkSave')) throw new Error('no save control');
 });

 check('Add person appends an empty row with a role select (Vocalist + instruments)', ()=>{
   ev('openBulkPreadd();');
   doc.getElementById('bulkAddRow').dispatchEvent(new window.Event('click',{bubbles:true}));
   const rows=doc.querySelectorAll('#bulkPreaddModal [data-bulk-row]');
   if(rows.length!==1) throw new Error('expected 1 row, got '+rows.length);
   const opts=[].map.call(rows[0].querySelectorAll('.bulk-role option'), o=>o.value);
   if(opts.indexOf('vocalist')===-1) throw new Error('role select missing vocalist');
   ['drums','bass','keys','eg','ag'].forEach(k=>{ if(opts.indexOf(k)===-1) throw new Error('role select missing '+k); });
 });

 check('Add everyone on the current plan seeds rows from roster (MD becomes its own row)', ()=>{
   ev(`state.vocalists=[{id:'v1',name:'Ava',micAssigned:''}]; state.assignments=['v1'].concat(new Array(MAX_VOCALISTS-1).fill(null));`);
   ev(`state.instruments=[{id:'ik',label:'Keys',assignedTo:'Pat'},{id:'ib',label:'Bass',assignedTo:'Sam'}]; state.musicDirectorId='ik';`);
   ev('openBulkPreadd(); document.getElementById("bulkSeedRoster").dispatchEvent(new Event("click",{bubbles:true}));');
   const names=[].map.call(doc.querySelectorAll('#bulkPreaddModal .bulk-name'), n=>n.value).sort();
   if(JSON.stringify(names)!==JSON.stringify(['Ava','Pat','Pat','Sam'])) throw new Error('roster seed wrong: '+JSON.stringify(names));
   if(!ev(`bulkPreaddRows.some(r=>r.role==='md' && normFullName(r.name)===normFullName('Pat'))`)) throw new Error('MD person should get a standalone md row');
   if(ev('bulkPreaddRows.some(r=>r.isMD)')) throw new Error('no row should carry isMD anymore');
 });

 check('expanding a band row mounts a setup editor that writes the stable bucket', ()=>{
   ev(`state.setupItems={};`);
   ev('openBulkPreadd(); addBulkRow({name:"Jo",role:"band",typeKey:"bass"}); renderBulkPreadd();');
   rowFor(/Jo/).querySelector('[data-bulk-expand]').dispatchEvent(new window.Event('click',{bubbles:true}));
   const jo=rowFor(/Jo/); // re-query: expand re-renders the list
   const ed=jo.querySelector('.bulk-editor'); if(!ed||!ed.children.length) throw new Error('no editor mounted');
   const cb=jo.querySelector('.bulk-editor input'); if(!cb) throw new Error('no option in the band editor');
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const key=ev(`stableSetupKey('Jo','band','bass')`);
   const n=ev(`(state.setupItems[${JSON.stringify(key)}]&&state.setupItems[${JSON.stringify(key)}].items||[]).length`);
   if(!(n>0)) throw new Error('band setup not written to bucket');
 });

 check('vocalist row: mic select present; Save remembers the mic + marks known', ()=>{
   ev(`state.setupItems={}; state.musicianPreferences={}; state.inventory=[{name:'Beta 58A',wireless:false},{name:'QLX',wireless:true}];`);
   ev('openBulkPreadd(); addBulkRow({name:"Mia",role:"vocalist"}); renderBulkPreadd();');
   rowFor(/Mia/).querySelector('[data-bulk-expand]').dispatchEvent(new window.Event('click',{bubbles:true}));
   const mia=rowFor(/Mia/); // re-query: expand re-renders the list
   const mic=mia.querySelector('.bulk-mic'); if(!mic) throw new Error('no mic select for vocalist');
   if(![].some.call(mic.options, o=>/Beta 58A/.test(o.textContent))) throw new Error('mic options not from inventory');
   mic.value='Beta 58A|wd'; mic.dispatchEvent(new window.Event('change',{bubbles:true}));
   ev('commitBulkPreadd();');
   const remembered=ev(`(micPrefFor('Mia')||{}).remembered`);
   if(!/Beta 58A/.test(remembered||'')) throw new Error('mic not remembered: '+remembered);
   if(!ev(`!!state.musicianPreferences['mia|vocal']`)) throw new Error('vocalist not marked known (mia|vocal)');
 });

 check('a pre-added vocalist is treated as known by buildPostPullSteps (not re-prompted)', ()=>{
   ev(`state.musicianPreferences={'mia|vocal':{askedAt:'x'}}; state.vocalists=[{id:'m',name:'Mia'}]; state.assignments=['m'].concat(new Array(MAX_VOCALISTS-1).fill(null)); state.instruments=[]; state.shadows=[];`);
   const steps=JSON.parse(ev('JSON.stringify(buildPostPullSteps(null))'));
   if(steps.some(s=>s.kind==='pref-vocal'&&s.personName==='Mia')) throw new Error('Mia should not be re-prompted');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
