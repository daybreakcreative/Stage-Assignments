const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const Q=e=>ev(e);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');
 // CUSTOM case
 ev(`startWizard(); state.instruments.__sentinel='ORIG';
     wizardData.customStagePoints=[{x:100,y:300},{x:700,y:300},{x:760,y:150},{x:400,y:70},{x:40,y:150}];
     wizardData.stageCurvature=66; wizardData.stageDepth=90; wizardData.vocalDirection='rtl'; wizardData.vocalistCount=3;
     wizardStepIdx=WIZARD_STEPS.indexOf('stage-layout'); renderWizardStep();`);
 check('stage-layout draws the CUSTOM outline (path = custom polygon)', ()=>{
   const p=document.querySelector('#wizStagePath'); if(!p) throw new Error('no #wizStagePath');
   const got=p.getAttribute('d'); const exp=Q('polygonPathFromPoints(wizardData.customStagePoints)');
   if(got!==exp) throw new Error('path mismatch\n got='+got+'\n exp='+exp);
 });
 check('custom outline stays applied after render (so drag clamps to it)', ()=>{
   if(Q('(state.config.customStagePoints||[]).length')!==5) throw new Error('points not applied');
   const sp=Q('getStageShape().path'); const exp=Q('polygonPathFromPoints(wizardData.customStagePoints)');
   if(sp!==exp) throw new Error('getStageShape not custom');
 });
 check('clampStagePosition follows the custom front edge (apex bulge near y≈70)', ()=>{
   // drag a point toward the audience at center-x; with the custom apex at y=70, it should clamp to ~that, not the slider curve
   const c=JSON.parse(Q('JSON.stringify(clampStagePosition(400,10))'));
   if(typeof c.y!=='number') throw new Error('no y');
   if(c.y < 55 || c.y > 95) throw new Error('center clamp y='+c.y+' not near custom apex ~70');
 });
 check('temp placeholder instruments were restored (sentinel intact)', ()=>{
   if(Q("state.instruments && state.instruments.__sentinel")!=='ORIG') throw new Error('instruments not restored');
 });
 // SLIDER-only case (no custom): shape should also stay applied
 ev(`wizardData.customStagePoints=null; wizardData.stageCurvature=22; wizardData.stageDepth=44; renderWizardStep();`);
 check('slider-only: no custom path, and wizard curvature stays applied for drag', ()=>{
   if(Q('state.config.customStagePoints')!==null) throw new Error('customStagePoints should be null');
   if(Q('state.config.stageCurvature')!==22 || Q('state.config.stageDepth')!==44) throw new Error('slider values not applied');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
