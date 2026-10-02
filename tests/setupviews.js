// setupviews.js — the three setup surfaces (check-off, manager, go-live checklist)
// all read the stable-key model + share one enumeration (enumerateSetupRoles).
// Verifies: per-role/multi-instance entries, correct specific labels (no "Removed
// instrument"), MD gets the md catalog IN ADDITION to their instrument, onPlan flag,
// renderSetupManager groups by person with role sub-entries, and renderSetupChecklist
// does NOT falsely show "No setup items configured." when buckets have items.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// Cam Lee: on Keys AND Electric 2, in vocalists, and set as MD (musicDirectorId -> Keys).
// Plus a second plain vocalist, Riley Q. Church defaults for keys/eg/vocals/md.
const seed=()=>ev(`
  state.vocalists=[
    {id:'v_cam',name:'Cam Lee',isWL:true,micAssigned:''},
    {id:'v_riley',name:'Riley Q',isWL:false,micAssigned:''}
  ];
  state.shadows=[];
  state.instruments=[
    {id:'inst_keys',label:'Keys',assignedTo:'Cam Lee',vocalistPlayer:null,tag:'Keys'},
    {id:'inst_eg2',label:'Electric 2',assignedTo:'Cam Lee',vocalistPlayer:null,tag:'EG'}
  ];
  state.musicDirectorId='inst_keys';
  state.setupItems={};
`);

// 2026-10-01 (Dillon: one checklist per person for every MD-assigned position): the MD role now FOLDS into the instrument bucket (selections.md); a separate md|md exists only for a solo MD or an instrument with no preset type.
window.addEventListener('load',()=>setTimeout(()=>{
 // don't let the check-off renderer or full re-render fire during manager/checklist tests
 ev('renderAll=function(){}; renderStage=function(){}; renderBand=function(){}; renderDisplayView=function(){}; toast=function(){};');

 check('enumerateSetupRoles: Cam Lee yields 3 role entries (keys+MD folded, eg, vocals) w/ specific labels', ()=>{
   seed();
   const rows=JSON.parse(ev('JSON.stringify(enumerateSetupRoles())'));
   const cam=rows.filter(r=>r.name==='Cam Lee');
   if(cam.length!==3) throw new Error('expected 3 Cam Lee entries, got '+cam.length+' -> '+JSON.stringify(cam));
   const keys=cam.find(r=>r.role==='band'&&r.typeKey==='keys');
   const eg=cam.find(r=>r.role==='band'&&r.typeKey==='eg');
   const voc=cam.find(r=>r.role==='vocalist'&&r.typeKey==='vocals');
   if(!keys||keys.label!=='Keys'||!keys.mdFolded) throw new Error('keys entry should carry the folded MD: '+JSON.stringify(keys));
   if(!eg||eg.label!=='Electric 2') throw new Error('eg entry/label wrong: '+JSON.stringify(eg));
   if(!voc||voc.label!=='Vocals') throw new Error('vocals entry/label wrong: '+JSON.stringify(voc));
   if(cam.some(r=>r.role==='md')) throw new Error('a separate md row was emitted');
   if(rows.some(r=>/removed instrument/i.test(r.label||''))) throw new Error('a label says Removed instrument');
   // stableKeys must match the helper
   const wantK=ev(`stableSetupKey('Cam Lee','band','keys')`);
   if(keys.stableKey!==wantK) throw new Error('keys stableKey mismatch');
 });

 check('enumerateSetupRoles: onPlan true for people in current roster', ()=>{
   seed();
   const rows=JSON.parse(ev('JSON.stringify(enumerateSetupRoles())'));
   if(!rows.length) throw new Error('no rows');
   if(!rows.every(r=>r.onPlan===true)) throw new Error('every enumerated entry should be onPlan');
   const riley=rows.find(r=>r.name==='Riley Q');
   if(!riley||riley.onPlan!==true) throw new Error('Riley Q not flagged onPlan');
 });

 check('renderSetupManager: Cam Lee shown once with 3 role sub-entries (Keys · MD), no "Removed instrument"', ()=>{
   seed();
   // give each bucket at least one item so buckets are non-empty and persist
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); var b=state.setupItems[r.stableKey]; if(!b.items.length) b.items.push({id:'x'+Math.random(),text:'Seed line',doneThisService:false,scopeOneTime:false}); });`);
   ev(`openSettings && openSettings('setups')`);
   ev('renderSetupManager()');
   const list=doc.getElementById('setupMgrList');
   if(!list) throw new Error('no setupMgrList');
   const camGroups=[...doc.querySelectorAll('#setupMgrList .setup-person-name')].filter(n=>/Cam Lee/.test(n.textContent));
   if(camGroups.length!==1) throw new Error('Cam Lee should appear as ONE person group, got '+camGroups.length);
   const txt=list.textContent;
   if(/removed instrument/i.test(txt)) throw new Error('"Removed instrument" present in manager');
   // Cam Lee's group should show all four role labels
   const camPerson=camGroups[0].closest('.setup-person');
   const scopes=[...camPerson.querySelectorAll('.setup-bucket-scope')].map(s=>s.textContent);
   ['Keys','Electric 2','Vocals','MD'].forEach(l=>{ if(!scopes.some(s=>s.indexOf(l)!==-1)) throw new Error('missing scope label '+l+' -> '+JSON.stringify(scopes)); });
 });

 check('renderSetupManager: the Keys · MD sub-entry resolves the md catalog (an md option text appears)', ()=>{
   seed();
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); reconstructSetupBucket(r.stableKey,r.typeKey); });`);
   // put an md-catalog pick on the FOLDED keys bucket so a distinctive md line resolves
   const keysKey=ev(`stableSetupKey('Cam Lee','band','keys')`);
   ev(`(function(){var b=state.setupItems[${JSON.stringify(keysKey)}]; b.selections.md={rig:['md_tracks']}; rebuildPersonItems(${JSON.stringify(keysKey)},'keys');})()`);
   ev('renderSetupManager()');
   // Resolved lines render as editable <input value>, so read values (textContent excludes them).
   const inps=[...doc.querySelectorAll(`#setupMgrList .setup-item-input[data-key="${keysKey}"]`)];
   if(!inps.length) throw new Error('no keys bucket inputs rendered');
   if(!inps.some(i=>/House tracks computer/i.test(i.value))) throw new Error('md catalog line not shown on the keys entry: '+JSON.stringify(inps.map(i=>i.value)));
   const bucketEl=inps[0].closest('.setup-bucket');
   const scope=bucketEl.querySelector('.setup-bucket-scope').textContent;
   if(!/Keys/.test(scope)||!/MD/.test(scope)) throw new Error('bucket not labeled Keys · MD: '+scope);
   if(doc.querySelector(`#setupMgrList .setup-item-input[data-key="${ev(`stableSetupKey('Cam Lee','md','md')`)}"]`)) throw new Error('a separate MD sub-entry still renders');
 });

 check('renderSetupChecklist: NOT "No setup items configured" when buckets have items', ()=>{
   seed();
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); var b=state.setupItems[r.stableKey]; b.items=[{id:'i'+Math.random(),text:'Line for '+r.label,doneThisService:false,scopeOneTime:false}]; });`);
   ev('renderSetupChecklist()');
   const view=doc.getElementById('setupChecklistView');
   if(!view) throw new Error('no setupChecklistView');
   if(/No setup items configured/i.test(view.textContent)) throw new Error('false empty message shown');
   // ✓ Items view renders items as .si-chip cards now (redesign); behavior unchanged.
   const items=view.querySelectorAll('.si-chip[data-item-key]');
   if(items.length<4) throw new Error('expected >=4 checklist items, got '+items.length);
   // person label should reflect the specific instrument/role label, never Removed instrument
   if(/removed instrument/i.test(view.textContent)) throw new Error('Removed instrument in checklist');
   const txt=view.textContent;
   ['Keys','Electric 2','Vocals','MD'].forEach(l=>{ if(txt.indexOf(l)===-1) throw new Error('checklist missing label '+l); });
 });

 check('renderSetupChecklist: still shows "No setup items configured" when genuinely empty', ()=>{
   ev(`state.vocalists=[]; state.instruments=[]; state.shadows=[]; state.musicDirectorId=null; state.setupItems={}; state.config.stageFeatures=[];`);
   ev('renderSetupChecklist()');
   const view=doc.getElementById('setupChecklistView');
   if(!/No setup items configured/i.test(view.textContent)) throw new Error('expected empty message when nothing configured');
 });

 check('checklist keys are stable per (stableKey,itemId) — a checkbox click persists', ()=>{
   seed();
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); var b=state.setupItems[r.stableKey]; b.items=[{id:'onlyid',text:'Line for '+r.label,doneThisService:false,scopeOneTime:false}]; });`);
   ev('renderSetupChecklist()');
   const view=doc.getElementById('setupChecklistView');
   const first=view.querySelector('.si-chip[data-item-key]');
   if(!first) throw new Error('no item to click');
   first.click();
   const cs=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   const k=first.getAttribute('data-item-key');
   if(!cs[k]) throw new Error('click did not persist under key '+k);
 });

 // Bug #13: opening the Setup Items settings must land on a REAL tab (setups), not a
 // non-existent 'templates' tab that leaves the sheet blank. (The old ✓ Items ⚙ button was
 // removed with the legacy view 2026-07-18; the live entry point is openSettings('setups'),
 // used by the checklist's empty-state "+ Set up items" action.)
 check("openSettings('setups') opens Settings on the Setup Items tab", ()=>{
   ev('closeSettings && closeSettings()');
   ev("openSettings('setups')");
   const ov=doc.getElementById('settingsOverlay');
   if(!ov || !ov.classList.contains('show')) throw new Error('settings overlay not shown');
   const activeTab=doc.querySelector('.tab.active');
   if(!activeTab || activeTab.dataset.tab!=='setups') throw new Error('active tab is '+(activeTab&&activeTab.dataset.tab)+', expected setups');
   const panel=doc.getElementById('tab-setups');
   if(!panel || !panel.classList.contains('active')) throw new Error('tab-setups panel not active (blank sheet)');
   ev('closeSettings && closeSettings()');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
