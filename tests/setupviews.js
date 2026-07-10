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

window.addEventListener('load',()=>setTimeout(()=>{
 // don't let the check-off renderer or full re-render fire during manager/checklist tests
 ev('renderSetupItemsView=function(){}; renderAll=function(){}; renderStage=function(){}; renderBand=function(){}; renderDisplayView=function(){}; toast=function(){};');

 check('enumerateSetupRoles: Cam Lee yields 4 role entries (keys/eg band, vocals, md) w/ specific labels', ()=>{
   seed();
   const rows=JSON.parse(ev('JSON.stringify(enumerateSetupRoles())'));
   const cam=rows.filter(r=>r.name==='Cam Lee');
   if(cam.length!==4) throw new Error('expected 4 Cam Lee entries, got '+cam.length+' -> '+JSON.stringify(cam));
   const keys=cam.find(r=>r.role==='band'&&r.typeKey==='keys');
   const eg=cam.find(r=>r.role==='band'&&r.typeKey==='eg');
   const voc=cam.find(r=>r.role==='vocalist'&&r.typeKey==='vocals');
   const md=cam.find(r=>r.role==='md'&&r.typeKey==='md');
   if(!keys||keys.label!=='Keys') throw new Error('keys entry/label wrong: '+JSON.stringify(keys));
   if(!eg||eg.label!=='Electric 2') throw new Error('eg entry/label wrong: '+JSON.stringify(eg));
   if(!voc||voc.label!=='Vocals') throw new Error('vocals entry/label wrong: '+JSON.stringify(voc));
   if(!md||md.label!=='MD') throw new Error('md entry/label wrong: '+JSON.stringify(md));
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

 check('renderSetupManager: Cam Lee shown once with 4 role sub-entries, no "Removed instrument"', ()=>{
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

 check('renderSetupManager: MD sub-entry uses the md catalog (an md option text appears)', ()=>{
   seed();
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); reconstructSetupBucket(r.stableKey,r.typeKey); });`);
   // put an md-catalog selection on the MD bucket so a distinctive md line resolves
   const mdKey=ev(`stableSetupKey('Cam Lee','md','md')`);
   ev(`(function(){var b=state.setupItems[${JSON.stringify(mdKey)}]; b.selections={rig:['md_tracks']}; rebuildPersonItems(${JSON.stringify(mdKey)},'md');})()`);
   ev('renderSetupManager()');
   // The MD bucket's resolved md-catalog line renders as an editable <input value>,
   // so read the input value (not textContent, which excludes input values).
   const inp=doc.querySelector(`#setupMgrList .setup-item-input[data-key="${mdKey}"]`);
   if(!inp) throw new Error('no md bucket input rendered');
   if(!/House tracks computer/i.test(inp.value)) throw new Error('md catalog line not shown for MD entry: '+inp.value);
   // and the sub-entry is labeled MD
   const mdBucket=inp.closest('.setup-bucket');
   if(!/MD/.test(mdBucket.querySelector('.setup-bucket-scope').textContent)) throw new Error('md bucket not labeled MD');
 });

 check('renderSetupChecklist: NOT "No setup items configured" when buckets have items', ()=>{
   seed();
   ev(`enumerateSetupRoles().forEach(r=>{ seedPersonSetup(r.stableKey,r.typeKey); var b=state.setupItems[r.stableKey]; b.items=[{id:'i'+Math.random(),text:'Line for '+r.label,doneThisService:false,scopeOneTime:false}]; });`);
   ev('renderSetupChecklist()');
   const view=doc.getElementById('setupChecklistView');
   if(!view) throw new Error('no setupChecklistView');
   if(/No setup items configured/i.test(view.textContent)) throw new Error('false empty message shown');
   const items=view.querySelectorAll('.scv-item');
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
   const first=view.querySelector('.scv-item');
   if(!first) throw new Error('no item to click');
   first.click();
   const cs=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   const k=first.getAttribute('data-item-key');
   if(!cs[k]) throw new Error('click did not persist under key '+k);
 });

 // Bug #13: the ✓ Items page ⚙ button must open a REAL Settings tab (setups),
 // not a non-existent 'templates' tab that leaves the sheet blank.
 check('✓ Items ⚙ (siSettingsBtn) opens Settings on the Setup Items tab', ()=>{
   ev('closeSettings && closeSettings()');
   const btn=doc.getElementById('siSettingsBtn');
   if(!btn) throw new Error('no siSettingsBtn');
   btn.click();
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
