const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}; renderStage=function(){}; renderBand=function(){}; renderDisplayView=function(){}; toast=function(){};');

 check('vocalist rename moves their check-offs to the new name (old key gone)', ()=>{
   ev(`
     state.vocalists=[{id:'vx',name:'Grayson',isWL:true,setupItems:['Tune in-ears','Set monitor mix']}];
     state.instruments=[]; state.pcoConfig.selectedPlanId='PLANX';
     var cs=getChecklistState(); cs['Grayson|Tune in-ears|v0']=true; cs['Grayson|Set monitor mix|v1']=true;
     updateVocName('vx','Grayson Kredit'); finalizeVocName('vx','Grayson');
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Grayson|Tune in-ears|v0']) throw new Error('old key remains');
   if(!o['Grayson Kredit|Tune in-ears|v0']) throw new Error('item0 not migrated');
   if(!o['Grayson Kredit|Set monitor mix|v1']) throw new Error('item1 not migrated');
 });

 check('migration covers every plan, not just the current one', ()=>{
   ev(`
     state.vocalists=[{id:'vy',name:'Ella',setupItems:['Soundcheck']}]; state.instruments=[];
     state.checklistState={}; 
     state.checklistState['PLAN_A']={'Ella|Soundcheck|v0':true};
     state.checklistState['PLAN_B']={'Ella|Soundcheck|v0':true};
     state.pcoConfig.selectedPlanId='PLAN_A';
     updateVocName('vy','Ella M'); finalizeVocName('vy','Ella');
   `);
   const a=JSON.parse(ev("JSON.stringify(state.checklistState['PLAN_A'])"));
   const b=JSON.parse(ev("JSON.stringify(state.checklistState['PLAN_B'])"));
   if(!a['Ella M|Soundcheck|v0']||a['Ella|Soundcheck|v0']) throw new Error('plan A not migrated');
   if(!b['Ella M|Soundcheck|v0']||b['Ella|Soundcheck|v0']) throw new Error('plan B not migrated');
 });

 check('renaming a vocalist who PLAYS an instrument also moves the band-row check-off', ()=>{
   ev(`
     state.vocalists=[{id:'vz',name:'Grayson',setupItems:[]}];
     state.instruments=[{id:'inst_ag',label:'Acoustic',pack:'Acoustic Pack',placeholder:'AG',tag:'AG',assignedTo:'',vocalistPlayer:'vz',optional:true,setupItems:['Plug in DI']}];
     state.pcoConfig.selectedPlanId='P';
     var cs=getChecklistState(); cs['Acoustic|Grayson|Plug in DI|b0']=true;
     updateVocName('vz','Grayson Kredit'); finalizeVocName('vz','Grayson');
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Acoustic|Grayson|Plug in DI|b0']) throw new Error('old band-player key remains');
   if(!o['Acoustic|Grayson Kredit|Plug in DI|b0']) throw new Error('band-player key not migrated');
 });

 check('band member rename moves their check-offs (helper path)', ()=>{
   ev(`
     state.instruments=[{id:'inst_drums',label:'Drums',pack:'Drum Pack',placeholder:'Drummer',tag:'Drums',assignedTo:'Danny',vocalistPlayer:null,optional:false,setupItems:['Check kick mic']}];
     state.pcoConfig.selectedPlanId='P2';
     var cs=getChecklistState(); cs['Drums|Danny|Check kick mic|b0']=true;
     var inst=instById('inst_drums'); inst.assignedTo='Danny Barragan';
     remapChecklistKeys(checklistPairsForBandRename(inst,'Danny','Danny Barragan'));
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Drums|Danny|Check kick mic|b0']) throw new Error('old band key remains');
   if(!o['Drums|Danny Barragan|Check kick mic|b0']) throw new Error('band item not migrated');
 });

 check('no-op when name is unchanged or prevName missing (no crash, no loss)', ()=>{
   ev(`
     state.vocalists=[{id:'vq',name:'Mo',setupItems:['X']}]; state.instruments=[];
     state.pcoConfig.selectedPlanId='P3'; var cs=getChecklistState(); cs['Mo|X|v0']=true;
     finalizeVocName('vq','Mo');         // same name
     finalizeVocName('vq', undefined);   // missing prevName
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(!o['Mo|X|v0']) throw new Error('check-off lost on no-op rename');
 });

 // ---- MD setup items surface in the checklist -------------------------------------
 // Give the church a real MD default so the seeded md bucket has an item.
 const seedMdDefault = () => ev(`
   if(!state.config.setupDefaults) state.config.setupDefaults={};
   state.config.setupDefaults.md={selections:{rig:['md_tracks','md_talk']},customOptions:[]};
 `);

 check('scheduled MD who plays Keys gets an MD role row with md items', ()=>{
   ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[];`);
   seedMdDefault();
   ev(`state.instruments=[{id:'inst_k',label:'Keys',tag:'Keys',assignedTo:'Pat Reed'}]; state.musicDirectorId='inst_k';`);
   const rows=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().map(r=>({name:r.name,role:r.role,typeKey:r.typeKey,label:r.label})))`));
   const md=rows.find(r=>r.name==='Pat Reed' && r.typeKey==='md' && r.role==='md');
   if(!md) throw new Error('no MD role row: '+JSON.stringify(rows));
   if(md.label!=='MD') throw new Error('MD row label not MD: '+md.label);
   const secs=JSON.parse(ev(`JSON.stringify(collectChecklistItems())`));
   const band=secs.find(s=>s.key==='band');
   if(!band) throw new Error('no band section');
   const flatTexts=band.items.map(i=>i.itemText).join(' | ');
   if(!/House tracks computer/.test(flatTexts)) throw new Error('md item text missing from checklist: '+flatTexts);
 });

 check('MD who also plays Keys: ONE merged card with BOTH Keys and MD items', ()=>{
   // Updated for #4 (2026-07-06): a person in two roles now merges into a single card
   // (roleLabel "Keys · MD") carrying every item, instead of two separate cards.
   ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[];`);
   seedMdDefault();
   ev(`if(!state.config.setupDefaults) state.config.setupDefaults={}; state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};`);
   ev(`state.instruments=[{id:'inst_k2',label:'Keys',tag:'Keys',assignedTo:'Dave Lee'}]; state.musicDirectorId='inst_k2';`);
   const secs=JSON.parse(ev(`JSON.stringify(collectChecklistItems())`));
   const band=secs.find(s=>s.key==='band');
   const daveGroups=(band.people||[]).filter(p=>p.name==='Dave Lee');
   if(daveGroups.length!==1) throw new Error('MD who plays Keys should be ONE merged card now, got '+daveGroups.length+': '+JSON.stringify(daveGroups));
   const dave=daveGroups[0];
   if(!/Keys/.test(dave.roleLabel)||!/MD/.test(dave.roleLabel)) throw new Error('merged roleLabel should mention Keys + MD: '+dave.roleLabel);
   if(!dave.items.some(i=>/Keyboard — House Keyboard/.test(i.itemText))) throw new Error('keys item missing: '+JSON.stringify(dave.items));
   if(!dave.items.some(i=>/House tracks computer/.test(i.itemText))) throw new Error('md item missing: '+JSON.stringify(dave.items));
 });

 // ---- Grouped-by-person rendering --------------------------------------------------
 check('renderSetupChecklist groups items into per-person cards (not one flat list)', ()=>{
   ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[];`);
   seedMdDefault();
   ev(`state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};`);
   ev(`state.config.setupDefaults.vocals={selections:{options:['v_stand']},customOptions:[]};`);
   ev(`state.vocalists=[{id:'vv',name:'Grace',isWL:false}];`);
   ev(`state.instruments=[{id:'inst_k3',label:'Keys',tag:'Keys',assignedTo:'Dave Lee'}]; state.musicDirectorId='inst_k3';`);
   ev(`openSetupChecklistView();`);
   const view=window.document.getElementById('setupChecklistView');
   // ✓ Items view redesigned into .si-card person cards with .si-chip items (was .scv-person/.scv-item).
   const persons=view.querySelectorAll('.si-card');
   if(persons.length<2) throw new Error('expected >=2 person cards, got '+persons.length);
   // Each card must have a name header and its own item chips.
   const graceCard=Array.from(persons).find(c=>{const h=c.querySelector('.si-card-name'); return h && h.textContent==='Grace';});
   if(!graceCard) throw new Error('no Grace person card');
   if(!graceCard.querySelector('.si-card-role')) throw new Error('Grace card missing role subheading');
   if(graceCard.querySelectorAll('.si-chip[data-item-key]').length<1) throw new Error('Grace card has no check chips');
 });

 // ---- Check state persists across re-render ---------------------------------------
 check('toggling an item persists in checklist state and survives a re-render', ()=>{
   ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[]; state.pcoConfig.selectedPlanId='PLANMD';`);
   seedMdDefault();
   ev(`state.instruments=[{id:'inst_k4',label:'Keys',tag:'Keys',assignedTo:'Pat Reed'}]; state.musicDirectorId='inst_k4';`);
   ev(`openSetupChecklistView();`);
   const view=window.document.getElementById('setupChecklistView');
   const first=view.querySelector('.si-chip[data-item-key]');
   if(!first) throw new Error('no items rendered');
   const key=first.dataset.itemKey;
   first.click(); // toggles in place + persists
   const cs=JSON.parse(ev(`JSON.stringify(getChecklistState())`));
   if(!cs[key]) throw new Error('check state not stored after click');
   // re-render and confirm the same key shows done (chips mark done with the `ck` class)
   ev(`renderSetupChecklist();`);
   const again=window.document.querySelector('.si-chip[data-item-key="'+key.replace(/"/g,'\\"')+'"]');
   if(!again || !again.classList.contains('ck')) throw new Error('done state lost after re-render');
 });

 // ---- Lock-screen count still works ----------------------------------------------
 check('collectChecklistItems flat shape intact + lock-screen count sane', ()=>{
   ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[];`);
   seedMdDefault();
   ev(`state.instruments=[{id:'inst_k5',label:'Keys',tag:'Keys',assignedTo:'Pat Reed'}]; state.musicDirectorId='inst_k5';`);
   const secs=JSON.parse(ev(`JSON.stringify(collectChecklistItems())`));
   let total=0; secs.forEach(s=>{ if(!Array.isArray(s.items)) throw new Error('section lost flat items array: '+s.key); total+=s.items.length; });
   if(total<1) throw new Error('expected some flat items, got '+total);
   // showSetupLockScreen must not throw and must report remaining
   ev(`openSetupChecklistView();`); // ensure planKey exists / view mounted
   ev(`showSetupLockScreen();`);
   const sub=window.document.getElementById('lockSubtitle');
   if(!sub || !/item/.test(sub.textContent)) throw new Error('lock subtitle not populated: '+(sub&&sub.textContent));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
