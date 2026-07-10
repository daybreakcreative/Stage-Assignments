const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');
 ev(`state.savedStages=[]; saveStageToLibrary('Test A','config');`);
 ev(`startWizard(); wizardStepIdx=WIZARD_STEPS.indexOf('stage'); renderWizardStep();`);
 check('wizard stage step renders "Add stairs, doors & risers" button', ()=>{ if(!document.querySelector('#wizFeaturesBtn')) throw new Error('no button'); });
 check('wizard stage step renders the saved-stages container', ()=>{ if(!document.querySelector('#wizSavedStages')) throw new Error('no container'); });
 check('saved-stages panel is populated in the wizard (Save row + existing entry)', ()=>{
   const c=document.querySelector('#wizSavedStages');
   if(!c.querySelector('.saved-stage-saverow')) throw new Error('no saverow');
   if(!c.querySelector('.saved-stage-item')) throw new Error('no item');
 });
 // Saved-stages panel moved from the (former single) Display tab to the new Stage tab
 // when the Display settings tab was split into Stage / Instruments & IEMs / Display.
 check('AS Stage editor renders the saved-stages container + panel', ()=>{
   ev('renderStageEditor();');
   const c=document.querySelector('#asSavedStages');
   if(!c) throw new Error('no #asSavedStages'); if(!c.querySelector('.saved-stage-saverow')) throw new Error('panel not rendered');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
},150));
