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

 check('Add person appends a person CARD (no role dropdown)', ()=>{
   ev('openBulkPreadd();');
   ev('addBulkPerson(); renderBulkPreadd();');
   const cards=doc.querySelectorAll('#bulkPreaddModal .bulk-person');
   if(cards.length!==1) throw new Error('expected 1 person card, got '+cards.length);
   if(doc.querySelector('#bulkPreaddModal .bulk-role')) throw new Error('the per-row role dropdown should be gone');
   if(!cards[0].querySelector('.bulk-addpos-select')) throw new Error('card should have a "+ add position" picker');
 });

 check('add a position via the card picker appends a read-only .bulk-pos chip', ()=>{
   ev('openBulkPreadd();');
   ev(`var pid=addBulkPerson({name:'Jo Vane'}); addBulkRow({pid,name:'Jo Vane',role:'band',typeKey:'bass',open:true}); renderBulkPreadd();`);
   const card=doc.querySelector('#bulkPreaddModal .bulk-person');
   const chips=card.querySelectorAll('.bulk-pos');
   if(chips.length!==1) throw new Error('expected 1 position chip, got '+chips.length);
   const label=chips[0].querySelector('.bulk-pos-label').textContent;
   if(!/Bass/i.test(label)) throw new Error('chip label should read Bass, got: '+label);
 });

 check('Add everyone on the current plan seeds rows from roster (MD becomes its own row)', ()=>{
   ev(`state.vocalists=[{id:'v1',name:'Ava',micAssigned:''}]; state.assignments=['v1'].concat(new Array(MAX_VOCALISTS-1).fill(null));`);
   ev(`state.instruments=[{id:'ik',label:'Keys',assignedTo:'Pat'},{id:'ib',label:'Bass',assignedTo:'Sam'}]; state.musicDirectorId='ik';`);
   ev('openBulkPreadd(); document.getElementById("bulkSeedRoster").dispatchEvent(new Event("click",{bubbles:true}));');
   const names=[].map.call(doc.querySelectorAll('#bulkPreaddModal .bulk-name'), n=>n.value).sort();
   if(JSON.stringify(names)!==JSON.stringify(['Ava','Pat','Sam'])) throw new Error('roster seed wrong: '+JSON.stringify(names));
   if(!ev(`bulkPreaddRows.some(r=>r.role==='md' && normFullName(r.name)===normFullName('Pat'))`)) throw new Error('MD person should get a standalone md row');
   if(!ev(`bulkPreaddRows.some(r=>r.role==='band' && r.typeKey==='keys' && normFullName(r.name)===normFullName('Pat'))`)) throw new Error('Pat should still have a band/keys row too (same card, two chips)');
   if(ev('bulkPreaddRows.some(r=>r.isMD)')) throw new Error('no row should carry isMD anymore');
 });

 check('expanding a band position mounts a setup editor that writes the stable bucket', ()=>{
   ev(`state.setupItems={};`);
   ev(`openBulkPreadd(); var pid=addBulkPerson({name:'Jo'}); addBulkRow({pid,name:'Jo',role:'band',typeKey:'bass'}); renderBulkPreadd();`);
   let card=doc.querySelector('#bulkPreaddModal .bulk-person');
   card.querySelector('.bulk-pos [data-bulk-expand]').dispatchEvent(new window.Event('click',{bubbles:true}));
   card=doc.querySelector('#bulkPreaddModal .bulk-person'); // re-query: expand re-renders the list
   const ed=card.querySelector('.bulk-pos .bulk-editor'); if(!ed||!ed.children.length) throw new Error('no editor mounted');
   const cb=card.querySelector('.bulk-pos .bulk-editor input'); if(!cb) throw new Error('no option in the band editor');
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const key=ev(`stableSetupKey('Jo','band','bass')`);
   const n=ev(`(state.setupItems[${JSON.stringify(key)}]&&state.setupItems[${JSON.stringify(key)}].items||[]).length`);
   if(!(n>0)) throw new Error('band setup not written to bucket');
 });

 check('vocalist position: mic select present; Save remembers the mic + marks known', ()=>{
   ev(`state.setupItems={}; state.musicianPreferences={}; state.inventory=[{name:'Beta 58A',wireless:false},{name:'QLX',wireless:true}];`);
   ev('openBulkPreadd();');
   ev(`var pid=addBulkPerson({name:'Mia'}); addBulkRow({pid,name:'Mia',role:'vocalist',open:true}); renderBulkPreadd();`);
   const mic=doc.querySelector('#bulkPreaddModal .bulk-pos .bulk-mic'); if(!mic) throw new Error('no mic select for vocalist');
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
