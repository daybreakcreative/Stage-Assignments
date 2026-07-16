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

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
