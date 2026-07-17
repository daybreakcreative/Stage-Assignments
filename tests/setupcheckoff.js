const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const Q=e=>ev(e);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 console.log('--- check-off view uses stable keys, no duplicates ---');
 check('two renders with re-minted inst ids do not duplicate a person bucket', ()=>{
   ev(`state.config.setupDefaults={ bass:{selections:{rig:'b_house'},customOptions:[]} };`);
   ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[];`);
   ev(`state.instruments=[{id:'inst_bass_1',label:'Bass',tag:'Bass',assignedTo:'Sam Lee'}];`);
   ev(`getStageAreas();`);
   ev(`state.instruments=[{id:'inst_bass_2',label:'Bass',tag:'Bass',assignedTo:'Sam Lee'}];`); // id changed
   ev(`getStageAreas();`);
   const keys = ev(`Object.keys(state.setupItems).filter(x=>/sam lee/.test(x))`);
   if (keys.length !== 1) throw new Error('duplicate buckets: '+JSON.stringify(keys));
   if (!/\|band\|bass$/.test(keys[0])) throw new Error('not a stable key: '+keys[0]);
 });
 check('editor and check-off share one bucket (edit shows in stats)', ()=>{
   const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
   // simulate an editor edit: select an extra item, rebuild
   ev(`state.setupItems['${k}'].selections.extras=['b_di']; rebuildPersonItems('${k}','bass');`);
   const s = ev(`JSON.stringify(setupCompletionStats('${k}'))`);
   if (!/"total"/.test(s)) throw new Error('no stats for stable key: '+s);
   const total = ev(`setupCompletionStats('${k}').total`);
   if (total < 1) throw new Error('stable bucket has no items after edit');
 });

 console.log('\n--- checklist check-off preserves scroll (updates in place, no full rebuild) ---');
 check('clicking a checklist item does NOT rebuild the view (row node survives)', ()=>{
   ev(`state.checklistState={}; state.setupItems={}; state.shadows=[]; state.instruments=[];`);
   ev(`state.vocalists=[{id:'v1',name:'Amelia',isWL:true,micAssigned:''}]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v1';`);
   const k = ev(`stableSetupKey('Amelia','vocalist','vocals')`);
   ev(`state.setupItems['${k}']={seeded:true,selections:{},customItems:[],items:[{id:'i1',text:'Straight mic stand',doneThisService:false},{id:'i2',text:'Music stand',doneThisService:false}]};`);
   ev(`renderSetupChecklist();`);
   // ✓ Items view now renders items as .si-chip cards (was .scv-item rows); behavior (in-place
   // toggle, node survives, gets a done marker) is unchanged. Selector updated per redesign.
   const rows = ev(`document.querySelectorAll('#setupChecklistView .si-chip[data-item-key]').length`);
   if (rows < 2) throw new Error('expected >=2 checklist rows, got '+rows);
   ev(`window.__row0 = document.querySelector('#setupChecklistView .si-chip[data-item-key]');`);
   ev(`window.__row0.click();`);
   if (!ev(`document.getElementById('setupChecklistView').contains(window.__row0)`))
     throw new Error('row node detached → full re-render happened (scroll would jump to top)');
   if (!ev(`window.__row0.classList.contains('done')`))
     throw new Error('clicked row did not get the done class in place');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
