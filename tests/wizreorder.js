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

 const EXPECTED=['identity','vocalists','instruments','mics','stage','stage-layout','look','display-layout','iems','setup-intro'];

 check('WIZARD_STEPS equals the new order', ()=>{
   const got=JSON.parse(ev('JSON.stringify(WIZARD_STEPS)'));
   if(JSON.stringify(got)!==JSON.stringify(EXPECTED)) throw new Error('got '+JSON.stringify(got));
 });
 check('iems comes after display-layout', ()=>{
   if(!(ev("WIZARD_STEPS.indexOf('iems')") > ev("WIZARD_STEPS.indexOf('display-layout')"))) throw new Error('iems not after display-layout');
 });
 check('setup-intro is last', ()=>{
   if(ev("WIZARD_STEPS[WIZARD_STEPS.length-1]")!=='setup-intro') throw new Error('last is '+ev("WIZARD_STEPS[WIZARD_STEPS.length-1]"));
 });

 // Walking the wizard by name still works — each step renders without throwing.
 ev('startWizard();');
 const N=ev('WIZARD_STEPS.length');
 check('every step renders with no jsdom error + progress dots reflect new length', ()=>{
   for(let i=0;i<N;i++){
     const before=errs.length;
     ev(`wizardStepIdx=${i}; renderWizardStep();`);
     if(errs.length>before) throw new Error('step '+i+' ('+ev('WIZARD_STEPS['+i+']')+') threw');
     const dots=document.querySelectorAll('#wizardSteps .wizard-step');
     if(dots.length!==N) throw new Error('dot count '+dots.length+' != '+N);
     const current=document.querySelectorAll('#wizardSteps .wizard-step.current');
     if(current.length!==1) throw new Error('expected exactly one current dot, got '+current.length);
   }
 });
 check('Back hidden on first step, Next says Finish on last step', ()=>{
   ev('wizardStepIdx=0; renderWizardStep();');
   if(document.getElementById('wizardBackBtn').style.display!=='none') throw new Error('back should be hidden on step 0');
   ev(`wizardStepIdx=${N-1}; renderWizardStep();`);
   if(!/Finish/.test(document.getElementById('wizardNextBtn').textContent)) throw new Error('next should say Finish on last step');
 });

 // ---- Band roster: hide empty optional slots, offer add affordance ----
 ev(`document.getElementById('wizardOverlay').classList.remove('show'); exitWizard&&exitWizard(false);`);
 ev(`
   state.vocalists=[];
   state.assignments=[];
   state.instruments=[
     {id:'inst_drums',label:'Drums',pack:'Drum Pack',placeholder:'Drummer',tag:'Drums',assignedTo:'Danny',vocalistPlayer:null,optional:false},
     {id:'inst_eg1',label:'Electric 1',pack:'EG Pack',placeholder:'EG1',tag:'EG',assignedTo:'',vocalistPlayer:null,optional:false},
     {id:'inst_eg2',label:'Electric 2',pack:'Misc 1 Pack',placeholder:'EG2',tag:'EG',assignedTo:'',vocalistPlayer:null,optional:true},
     {id:'inst_ag',label:'Acoustic',pack:'Acoustic Pack',placeholder:'AG',tag:'AG',assignedTo:'',vocalistPlayer:null,optional:true}
   ];
   state.musicDirectorId='inst_eg1';
 `);
 ev('renderBand();');

 check('empty optional slot (Electric 2) input is NOT rendered', ()=>{
   if(document.querySelector('#bandGrid input[data-inst-id="inst_eg2"]')) throw new Error('eg2 input present but should be hidden');
   if(document.querySelector('#bandGrid input[data-inst-id="inst_ag"]')) throw new Error('ag input present but should be hidden');
 });
 check('non-optional empty slot (Electric 1) IS rendered', ()=>{
   if(!document.querySelector('#bandGrid input[data-inst-id="inst_eg1"]')) throw new Error('eg1 (non-optional) should show');
 });
 check('a reveal/add affordance for hidden optional slots IS present', ()=>{
   const adders=document.querySelectorAll('#bandGrid [data-add-inst]');
   if(adders.length!==2) throw new Error('expected 2 add buttons (eg2 + ag), got '+adders.length);
   const ids=[...adders].map(b=>b.getAttribute('data-add-inst')).sort();
   if(JSON.stringify(ids)!==JSON.stringify(['inst_ag','inst_eg2'])) throw new Error('add buttons target wrong ids: '+JSON.stringify(ids));
 });
 check('clicking the add affordance reveals the optional slot input', ()=>{
   const btn=document.querySelector('#bandGrid [data-add-inst="inst_eg2"]');
   btn.dispatchEvent(new window.Event('click',{bubbles:true}));
   if(!document.querySelector('#bandGrid input[data-inst-id="inst_eg2"]')) throw new Error('eg2 input not revealed after click');
 });
 check('optional slot WITH assignedTo auto-appears (no add button for it)', ()=>{
   ev(`instById('inst_ag').assignedTo='Greg'; renderBand();`);
   if(!document.querySelector('#bandGrid input[data-inst-id="inst_ag"]')) throw new Error('ag should show once assigned');
   if(document.querySelector('#bandGrid [data-add-inst="inst_ag"]')) throw new Error('ag should not have an add button once assigned');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
