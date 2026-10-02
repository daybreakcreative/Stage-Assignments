// FEATURE: post-pull popup asks a band member who is ALSO the Music Director for both their
// instrument setup and their MD setup on one card (buildPostPullSteps + renderPostPullStep +
// savePostPullStep). The MD editor binds to the EXISTING md bucket (stableSetupKey(name,'md','md'))
// so edits round-trip to the ✓ Items page. Spec: docs/superpowers/specs/2026-07-16-md-setup-prompt-design.md
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

// Reset to a clean roster with a single band instrument. `mdOn` => that instrument is the MD.
// prefs => a musicianPreferences object (already-asked markers). Returns the pref-band step
// for the person, or null.
function bandStep(instLabel, mdOn, prefs){
 ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
 ev(`state.vocalists=[]; state.assignments=[]; state.shadows=[];`);
 ev(`state.instruments=[{id:'inst_x',label:${JSON.stringify(instLabel)},assignedTo:'Sophia Martinez'}];`);
 ev(`state.musicDirectorId=${mdOn?"'inst_x'":'null'};`);
 ev(`state.musicianPreferences=${JSON.stringify(prefs||{})};`);
 const steps=JSON.parse(ev(`JSON.stringify(buildPostPullSteps(null))`));
 return steps.find(s=>s.kind==='pref-band'&&s.personName==='Sophia Martinez')||null;
}

// 2026-10-01 (Dillon: one checklist per person for every MD-assigned position): the MD role now FOLDS into the instrument bucket (selections.md); a separate md|md exists only for a solo MD or an instrument with no preset type.
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};');

 console.log('--- step-building: MD flags on the pref-band step ---');
 check('function exists', ()=>{ if(ev('typeof buildPostPullSteps')!=='function') throw new Error('not a function'); });

 check('MD + new on instrument -> one card asking BOTH sections', ()=>{
   const s=bandStep('Bass', true, {});
   if(!s) throw new Error('no pref-band step');
   if(s.showInstrument!==true) throw new Error('showInstrument should be true');
   if(s.showMD!==true) throw new Error('showMD should be true');
   if(s.isMD!==true) throw new Error('isMD should be true');
   if(!/\|md$/.test(s.mdPrefKey)) throw new Error('mdPrefKey should end in |md: '+s.mdPrefKey);
 });

 check('promoted player (instrument known, newly MD) -> MD-only card', ()=>{
   const s=bandStep('Bass', true, {'sophia martinez|bass':{askedAt:'x'}});
   if(!s) throw new Error('expected an MD-only step, got none');
   if(s.showInstrument!==false) throw new Error('showInstrument should be false');
   if(s.showMD!==true) throw new Error('showMD should be true');
 });

 check('both prefs already known -> no step', ()=>{
   const s=bandStep('Bass', true, {'sophia martinez|bass':{askedAt:'x'},'sophia martinez|md':{askedAt:'x'}});
   if(s) throw new Error('should produce no step, got '+JSON.stringify(s));
 });

 check('non-MD band player -> no MD section', ()=>{
   const s=bandStep('Bass', false, {});
   if(!s) throw new Error('no pref-band step');
   if(s.showMD!==false) throw new Error('showMD should be false for non-MD');
   if(s.isMD!==false) throw new Error('isMD should be false');
 });

 check('MD whose instrument IS the MD/tracks preset -> no duplicate MD section', ()=>{
   const s=bandStep('Tracks', true, {});   // detectPresetKey('Tracks') === 'md'
   if(!s) throw new Error('no pref-band step');
   if(s.isMD!==true) throw new Error('isMD should be true');
   if(s.showMD!==false) throw new Error('showMD should be false (instrument already IS md)');
   if(s.showInstrument!==true) throw new Error('showInstrument should be true');
 });

 console.log('--- render: the card shows the right sections ---');
 // Render a pref-band step directly by seeding postPullState, then inspect #postPullContent.
 function renderBandStep(step){
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.setupItems={}; state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}]; state.musicDirectorId=${step.isMD?"'inst_x'":'null'};`);
   ev(`postPullState={steps:[${JSON.stringify(step)}],idx:0,onClose:null};`);
   ev(`renderPostPullStep();`);
 }

 check('render: MD + new instrument shows ONE editor that carries the MD block (no second editor)', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   const ed=doc.querySelector('#pp_setup_editor');
   if(!ed) throw new Error('instrument editor missing');
   if(doc.querySelector('#pp_md_setup_editor')) throw new Error('a second MD editor still renders');
   if(!ed.querySelector('.sp-md-block')) throw new Error('the one editor has no MD block');
   if(!ed.querySelector('input[value="md_tracks"]')) throw new Error('MD options not in the editor');
   if(!/Music Director/.test(ed.closest('.pp-row').querySelector('.pp-row-label').textContent)) throw new Error('row label does not say the MD role is included');
 });

 check('render: non-MD player shows NO MD editor', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:false,showMD:false,mdPrefKey:'sophia martinez|md'});
   if(!doc.querySelector('#pp_setup_editor')) throw new Error('instrument editor missing');
   if(doc.querySelector('#pp_md_setup_editor')) throw new Error('MD editor should NOT be present');
   if(doc.querySelector('#pp_setup_editor .sp-md-block')) throw new Error('MD block on a non-MD');
 });

 check('render: newly-MD card (instrument already known) shows the folded editor with the MD block', ()=>{
   renderBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:false,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   const ed=doc.querySelector('#pp_setup_editor');
   if(!ed) throw new Error('folded editor missing');
   if(doc.querySelector('#pp_md_setup_editor')) throw new Error('separate MD editor should NOT be present');
   if(!ed.querySelector('.sp-md-block')) throw new Error('MD block missing');
 });

 check('bucket consistency: the popup editor and the items layer share the ONE folded keys bucket', ()=>{
   ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
   ev(`state.instruments=[{id:'inst_k',label:'Keys',assignedTo:'Sky Fox'}];`);
   ev(`state.musicDirectorId='inst_k';`);
   const keysKey = ev(`stableSetupKey('Sky Fox','band','keys')`);
   const entry = ev(`getStageAreas().reduce((f,a)=>f||a.people.find(p=>p.mdFolded)||null,null)`);
   if(!entry||entry.key!==keysKey) throw new Error('items layer has no folded keys entry: '+JSON.stringify(entry));
   if(ev(`getStageAreas().some(a=>a.id==='area_md')`)) throw new Error('separate MD area still emitted');
   ev(`state.setupItems={};`); // clear so we can prove the popup seeds the SHARED bucket
   ev(`postPullState={steps:[{kind:'pref-band',personName:'Sky Fox',instLabel:'Keys',instId:'inst_k',prefKey:'sky fox|keys',showInstrument:true,isMD:true,showMD:true,mdPrefKey:'sky fox|md'}],idx:0,onClose:null};`);
   ev(`renderPostPullStep();`);
   if(!doc.querySelector('#pp_setup_editor .sp-md-block')) throw new Error('MD block missing from the popup editor');
   if(!ev(`!!(state.setupItems[${JSON.stringify(keysKey)}]&&state.setupItems[${JSON.stringify(keysKey)}].selections.md)`)) throw new Error('popup did not seed the MD half onto '+keysKey);
   if(ev(`!!state.setupItems[stableSetupKey('Sky Fox','md','md')]`)) throw new Error('popup minted a separate md|md bucket');
 });

 console.log('--- save: advancing marks both prefs asked so neither re-prompts ---');
 function saveBandStep(step){
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}];`);
   ev(`state.musicianPreferences={};`);
   ev(`postPullState={steps:[${JSON.stringify(step)}],idx:0,onClose:null};`);
   ev(`renderPostPullStep(); savePostPullStep();`);
   return JSON.parse(ev(`JSON.stringify(state.musicianPreferences)`));
 }

 check('save: MD + new instrument marks BOTH instrument and md asked', ()=>{
   const prefs=saveBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:true,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'});
   if(!prefs['sophia martinez|bass']) throw new Error('instrument pref not marked');
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked');
 });

 check('save: MD whose instrument IS md-type still marks md asked (isMD, not showMD)', ()=>{
   const prefs=saveBandStep({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Tracks',instId:'inst_x',prefKey:'sophia martinez|tracks',showInstrument:true,isMD:true,showMD:false,mdPrefKey:'sophia martinez|md'});
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked when instrument is md-type');
 });

 check('save: MD-only card does NOT overwrite the known instrument pref', ()=>{
   ev(`toast=function(){};renderAll=function(){};saveState=function(){};refreshSetupItemsUI=function(){};`);
   ev(`state.instruments=[{id:'inst_x',label:'Bass',assignedTo:'Sophia Martinez'}];`);
   ev(`state.musicianPreferences={'sophia martinez|bass':{askedAt:'ORIGINAL'}};`);
   ev(`postPullState={steps:[${JSON.stringify({kind:'pref-band',personName:'Sophia Martinez',instLabel:'Bass',instId:'inst_x',prefKey:'sophia martinez|bass',showInstrument:false,isMD:true,showMD:true,mdPrefKey:'sophia martinez|md'})}],idx:0,onClose:null};`);
   ev(`renderPostPullStep(); savePostPullStep();`);
   const prefs=JSON.parse(ev(`JSON.stringify(state.musicianPreferences)`));
   if(prefs['sophia martinez|bass'].askedAt!=='ORIGINAL') throw new Error('instrument pref was overwritten');
   if(!prefs['sophia martinez|md']) throw new Error('md pref not marked');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
