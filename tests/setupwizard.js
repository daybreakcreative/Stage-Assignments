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
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');

 console.log('--- wizard sets church defaults per instrument ---');
 check('ticking a wizard option writes state.config.setupDefaults', ()=>{
   ev(`state.config.setupDefaults=null;`);
   ev(`startWizard(); wizardData.instruments=[{key:'keys',selected:true,label:'Keys'}]; wizardData.useSetupChecklist=true;`);
   ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
   const body = doc.getElementById('wizardBody');
   const card = body.querySelector('.wiz-setup-inst[data-inst-key="keys"]');
   if (!card) throw new Error('keys card not rendered');
   const houseRadio = card.querySelector('input[type=radio][value="k_house"]');
   if (!houseRadio) throw new Error('keys options not mounted');
   if (houseRadio.checked) throw new Error('option should NOT be pre-checked (no built-in defaults)');
   houseRadio.checked = true; houseRadio.dispatchEvent(new window.Event('change',{bubbles:true}));
   if (ev(`(state.config.setupDefaults&&state.config.setupDefaults.keys&&state.config.setupDefaults.keys.selections.source)`) !== 'k_house') throw new Error('default not written');
 });

 check('unknown instrument (synth) renders no card; yes/no toggle still works', ()=>{
   ev(`state.config.setupDefaults=null;`);
   ev(`startWizard(); wizardData.instruments=[{key:'synth',selected:true,label:'Synth'},{key:'drums',selected:true,label:'Drums'}]; wizardData.useSetupChecklist=true;`);
   ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
   const body = doc.getElementById('wizardBody');
   if (body.querySelector('.wiz-setup-inst[data-inst-key="synth"]')) throw new Error('synth should be skipped (no catalog key)');
   if (!body.querySelector('.wiz-setup-inst[data-inst-key="drums"]')) throw new Error('drums card missing');
   // toggle to Skip -> cards gone
   const skipBtn = body.querySelector('[data-wsetup="no"]');
   if (!skipBtn) throw new Error('skip toggle missing');
   skipBtn.click();
   if (ev(`wizardData.useSetupChecklist`) !== false) throw new Error('toggle did not set useSetupChecklist=false');
   const body2 = doc.getElementById('wizardBody');
   if (body2.querySelector('.wiz-setup-inst')) throw new Error('cards should be hidden when skipped');
 });

 check('non-catalog .key mapped via detectPresetKey (Strings -> strings)', ()=>{
   ev(`state.config.setupDefaults=null;`);
   ev(`startWizard(); wizardData.instruments=[{key:'strings',selected:true,label:'Strings'}]; wizardData.useSetupChecklist=true;`);
   ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
   const body = doc.getElementById('wizardBody');
   const card = body.querySelector('.wiz-setup-inst[data-inst-key="strings"]');
   if (!card) throw new Error('strings card not rendered');
   const houseRadio = card.querySelector('input[type=radio][value="s_house"]');
   if (!houseRadio) throw new Error('strings options not mounted');
   houseRadio.checked = true; houseRadio.dispatchEvent(new window.Event('change',{bubbles:true}));
   if (ev(`(state.config.setupDefaults&&state.config.setupDefaults.strings&&state.config.setupDefaults.strings.selections.pickup)`) !== 's_house') throw new Error('strings default not written');
 });

 console.log('--- wizard exposes Edit questions (catalog editor) per instrument ---');
 check('wizard setup card has a lazy Edit-questions disclosure that mounts the catalog editor', ()=>{
   ev(`state.config.setupCatalog=null; state.config.setupDefaults=null;`);
   ev(`startWizard(); wizardData.instruments=[{key:'eg',selected:true,label:'Electric'}]; wizardData.useSetupChecklist=true;`);
   ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
   const body = doc.getElementById('wizardBody');
   const card = body.querySelector('.wiz-setup-inst[data-inst-key="eg"]');
   if(!card) throw new Error('eg wizard card missing');
   const disc = card.querySelector('.cat-edit-disclosure');
   const mount = card.querySelector('.cat-edit-mount');
   if(!disc || !mount) throw new Error('no Edit-questions disclosure in wizard card');
   if(mount.querySelector('.cat-opt-row')) throw new Error('editor should be lazy (not rendered before open)');
   disc.open = true; disc.dispatchEvent(new window.Event('toggle',{bubbles:true}));
   if(!mount.querySelector('.cat-opt-row')) throw new Error('catalog editor did not mount on open');
 });

 check('editing a wizard option text writes through to the setupCatalog overlay', ()=>{
   ev(`state.config.setupCatalog=null;`);
   ev(`startWizard(); wizardData.instruments=[{key:'eg',selected:true,label:'Electric'}]; wizardData.useSetupChecklist=true;`);
   ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
   const body = doc.getElementById('wizardBody');
   const card = body.querySelector('.wiz-setup-inst[data-inst-key="eg"]');
   const disc = card.querySelector('.cat-edit-disclosure');
   disc.open = true; disc.dispatchEvent(new window.Event('toggle',{bubbles:true}));
   const inp = card.querySelector('.cat-opt-input');
   inp.value='Helix'; inp.dispatchEvent(new window.Event('input',{bubbles:true}));
   if(!ev("JSON.stringify(state.config.setupCatalog.eg).includes('Helix')")) throw new Error('overlay not updated from wizard editor');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
