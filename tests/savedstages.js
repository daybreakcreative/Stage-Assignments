const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'Renamed Stage';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const Q=e=>ev(e);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};renderStage=function(){};renderDisplayView=function(){};renderLayoutEditor=function(){};');
 ev('state.savedStages=[];');
 // A) config source
 ev(`state.config.customStagePoints=[{x:100,y:300},{x:700,y:300},{x:700,y:120},{x:400,y:60},{x:100,y:120}];
     state.config.stageCurvature=70; state.config.stageDepth=100; state.config.vocalDirection='ltr';
     state.config.stageFeatures=[{id:'f1',type:'stairs',x:200,y:200,w:60,h:40,rot:0,label:'Stairs'}];`);
 ev(`window.__e1=saveStageToLibrary('Main Stage','config').id;`);
 check('config: saved entry captures shape+arc+fixtures', ()=>{
   const e=JSON.parse(Q('JSON.stringify(state.savedStages.find(s=>s.id===window.__e1))'));
   if(e.name!=='Main Stage') throw new Error('name'); if(!e.points||e.points.length!==5) throw new Error('points');
   if(e.curvature!==70||e.depth!==100) throw new Error('curve/depth'); if(e.vocalDirection!=='ltr') throw new Error('dir');
   if(!e.features||e.features.length!==1) throw new Error('features');
 });
 check('config: persisted to localStorage', ()=>{
   const p=JSON.parse(window.localStorage.getItem(Q('STORAGE_KEY')));
   if(!Array.isArray(p.savedStages)||!p.savedStages.find(s=>s.id===Q('window.__e1'))) throw new Error('not persisted');
 });
 ev(`state.config.customStagePoints=null; state.config.stageCurvature=0; state.config.stageDepth=20; state.config.vocalDirection='rtl'; state.config.stageFeatures=[];`);
 ev(`applySavedStage(window.__e1,'config');`);
 check('config: apply restores shape+arc+fixtures', ()=>{
   if(Q('(state.config.customStagePoints||[]).length')!==5) throw new Error('points');
   if(Q('state.config.stageCurvature')!==70||Q('state.config.stageDepth')!==100) throw new Error('curve/depth');
   if(Q('state.config.vocalDirection')!=='ltr') throw new Error('dir'); if(Q('(state.config.stageFeatures||[]).length')!==1) throw new Error('features');
 });
 check('config: applied fixtures are an independent clone', ()=>{
   ev(`state.config.stageFeatures[0].label='MUTATED';`);
   const e=JSON.parse(Q('JSON.stringify(state.savedStages.find(s=>s.id===window.__e1))'));
   if(e.features[0].label==='MUTATED') throw new Error('shared reference');
 });
 // B) wizard source
 ev(`startWizard(); wizardData.customStagePoints=[{x:50,y:280},{x:750,y:280},{x:750,y:140},{x:50,y:140}]; wizardData.stageCurvature=40; wizardData.stageDepth=80; wizardData.vocalDirection='rtl';
     state.config.stageFeatures=[{id:'a',type:'door',x:1,y:1,w:30,h:30,rot:0},{id:'b',type:'riser',x:2,y:2,w:80,h:40,rot:0}];`);
 ev(`window.__e2=saveStageToLibrary('Wizard Stage','wizard').id;`);
 check('wizard: saved entry uses wizardData shape + config fixtures', ()=>{
   const e=JSON.parse(Q('JSON.stringify(state.savedStages.find(s=>s.id===window.__e2))'));
   if(!e.points||e.points.length!==4) throw new Error('points'); if(e.curvature!==40||e.depth!==80) throw new Error('curve/depth');
   if(e.vocalDirection!=='rtl') throw new Error('dir'); if(!e.features||e.features.length!==2) throw new Error('features');
 });
 ev(`wizardData.customStagePoints=null; wizardData.stageCurvature=10; wizardData.stageDepth=10; wizardData.vocalDirection='ltr'; state.config.stageFeatures=[];`);
 ev(`applySavedStage(window.__e2,'wizard');`);
 check('wizard: apply sets wizardData shape + config fixtures', ()=>{
   if(Q('(wizardData.customStagePoints||[]).length')!==4) throw new Error('points');
   if(Q('wizardData.stageCurvature')!==40||Q('wizardData.stageDepth')!==80) throw new Error('curve/depth');
   if(Q('wizardData.vocalDirection')!=='rtl') throw new Error('dir'); if(Q('(state.config.stageFeatures||[]).length')!==2) throw new Error('fixtures not applied');
 });
 // C) rename / delete
 ev(`renameSavedStage(window.__e1,'Renamed Main');`);
 check('rename works', ()=>{ const e=JSON.parse(Q('JSON.stringify(state.savedStages.find(s=>s.id===window.__e1))')); if(e.name!=='Renamed Main') throw new Error('name '+e.name); });
 const before=Q('state.savedStages.length');
 ev(`deleteSavedStage(window.__e2);`);
 check('delete works', ()=>{ if(Q('state.savedStages.length')!==before-1) throw new Error('len'); if(Q('!!state.savedStages.find(s=>s.id===window.__e2)')) throw new Error('still present'); });
 // E) panel UI
 ev(`state.savedStages=[]; saveStageToLibrary('Existing','config');`);
 const div=document.createElement('div'); div.id='testpanel'; document.body.appendChild(div);
 ev(`window.__chg=0; renderSavedStagesPanel('#testpanel',{source:'config',onChange:function(){window.__chg++;}});`);
 check('panel renders save row + existing entry', ()=>{
   const d=document.querySelector('#testpanel'); if(!d.querySelector('.saved-stage-saverow')) throw new Error('no saverow');
   if(!d.querySelector('.saved-stage-item')) throw new Error('no item'); if(!/Existing/.test(d.querySelector('.ss-name').textContent)) throw new Error('name missing');
 });
 check('panel Save adds an entry and clears input', ()=>{
   let d=document.querySelector('#testpanel'); d.querySelector('.saved-stage-name').value='From Panel'; d.querySelector('[data-ss-save]').click();
   if(Q('state.savedStages.length')!==2) throw new Error('not added: '+Q('state.savedStages.length'));
   d=document.querySelector('#testpanel'); if(d.querySelector('.saved-stage-name').value!=='') throw new Error('input not cleared');
 });
 check('panel Apply triggers onChange', ()=>{ document.querySelector('#testpanel').querySelector('[data-ss-apply]').click(); if(Q('window.__chg')<1) throw new Error('onChange not called'); });
 check('panel Delete removes entry (confirm=true)', ()=>{ const b=Q('state.savedStages.length'); document.querySelector('#testpanel').querySelector('[data-ss-del]').click(); if(Q('state.savedStages.length')!==b-1) throw new Error('not deleted'); });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
