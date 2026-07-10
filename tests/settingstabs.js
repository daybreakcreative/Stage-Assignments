// settingstabs.js — the former single "Display" settings tab was split into three:
// Stage · Instruments & IEMs · Display. Verifies the tab buttons + panels exist, that
// openSettings() activates each panel and its editor renders ITS OWN controls, and that
// the slimmed Display tab no longer carries the instruments roster but still carries a
// display-view control (name-format). Also confirms the ✓ Items block-Display toggle
// relocated to the Setup Items tab.
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

window.addEventListener('load',()=>setTimeout(()=>{
 // Quiet the heavy full re-render + display render so these are pure settings-tab checks.
 ev('renderAll=function(){}; renderStage=function(){}; renderDisplayView=function(){}; renderBand=function(){}; toast=function(){};');

 check('three tab buttons exist: stage, instruments, layout', ()=>{
   ['stage','instruments','layout'].forEach(k=>{
     const btn=doc.querySelector(`.tab[data-tab="${k}"]`);
     if(!btn) throw new Error('missing tab button for '+k);
   });
   // Tab order: Mics · Stage · Instruments & IEMs · Display · Setup Items · …
   const order=[...doc.querySelectorAll('.tabs .tab')].map(b=>b.dataset.tab);
   const iM=order.indexOf('inventory'), iS=order.indexOf('stage'), iI=order.indexOf('instruments'), iL=order.indexOf('layout'), iSet=order.indexOf('setups');
   if(!(iM<iS && iS<iI && iI<iL && iL<iSet)) throw new Error('tab order wrong: '+JSON.stringify(order));
 });

 check('three panels exist: #tab-stage/#stageEdit, #tab-instruments/#instrumentsEdit, #tab-layout/#layoutEdit', ()=>{
   ['tab-stage','tab-instruments','tab-layout'].forEach(id=>{ if(!doc.getElementById(id)) throw new Error('missing panel '+id); });
   ['stageEdit','instrumentsEdit','layoutEdit'].forEach(id=>{ if(!doc.getElementById(id)) throw new Error('missing container '+id); });
 });

 check("openSettings('stage') activates #tab-stage and #stageEdit has the curve-depth control", ()=>{
   ev("openSettings('stage')");
   const active=doc.querySelector('.tab.active');
   if(!active||active.dataset.tab!=='stage') throw new Error('active tab is '+(active&&active.dataset.tab));
   const panel=doc.getElementById('tab-stage');
   if(!panel||!panel.classList.contains('active')) throw new Error('#tab-stage panel not active');
   const stageEdit=doc.getElementById('stageEdit');
   // curve-depth slider is the defining Stage control
   if(!stageEdit.querySelector('#layoutCurvatureSlider')) throw new Error('stage editor missing curve-depth slider');
   if(!/Curve depth/i.test(stageEdit.textContent)) throw new Error('stage editor missing "Curve depth" label');
   // Vocal arrangement lives here too
   if(!stageEdit.querySelector('[data-voc-dir]')) throw new Error('stage editor missing vocal-direction buttons');
 });

 check("openSettings('instruments') activates #tab-instruments and #instrumentsEdit has the instruments list", ()=>{
   ev("openSettings('instruments')");
   const active=doc.querySelector('.tab.active');
   if(!active||active.dataset.tab!=='instruments') throw new Error('active tab is '+(active&&active.dataset.tab));
   const panel=doc.getElementById('tab-instruments');
   if(!panel||!panel.classList.contains('active')) throw new Error('#tab-instruments panel not active');
   const instEdit=doc.getElementById('instrumentsEdit');
   if(!instEdit.querySelector('#instEditor')) throw new Error('instruments editor missing #instEditor list');
   if(!instEdit.querySelector('#addInstrumentBtn')) throw new Error('instruments editor missing add button');
   // IEM packs + shadow default pack live here too
   if(!instEdit.querySelector('#iemPresetList')) throw new Error('instruments editor missing IEM preset list');
   if(!instEdit.querySelector('[data-shadow-pack]')) throw new Error('instruments editor missing shadow pack input');
 });

 check('slimmed #layoutEdit no longer contains the instruments list, but DOES contain a display control (name-format)', ()=>{
   ev("openSettings('layout')");
   const layoutEdit=doc.getElementById('layoutEdit');
   if(layoutEdit.querySelector('#instEditor')) throw new Error('#instEditor should NOT be in the Display tab anymore');
   if(layoutEdit.querySelector('#addInstrumentBtn')) throw new Error('add-instrument button should NOT be in the Display tab');
   if(layoutEdit.querySelector('#layoutCurvatureSlider')) throw new Error('curve slider should NOT be in the Display tab');
   if(layoutEdit.querySelector('[data-shadow-pack]')) throw new Error('shadow pack input should NOT be in the Display tab');
   if(layoutEdit.querySelector('#asSavedStages')) throw new Error('saved-stages panel should NOT be in the Display tab');
   // Display-view controls remain
   if(layoutEdit.querySelectorAll('[data-name-fmt]').length!==4) throw new Error('Display tab lost its 4 name-format cards');
   if(!layoutEdit.querySelector('#sideOrderList')) throw new Error('Display tab lost the side-panel order list');
 });

 check('editors wire only their own controls (no orphaned listeners): stage curve slider updates state', ()=>{
   ev("openSettings('stage')");
   ev('state.config.stageCurvature=10; state.config.customStagePoints=null;');
   ev('renderStageEditor();');
   const sl=doc.getElementById('layoutCurvatureSlider');
   if(!sl) throw new Error('no curve slider');
   sl.value='42';
   sl.dispatchEvent(new window.Event('input',{bubbles:true}));
   if(ev('state.config.stageCurvature')!==42) throw new Error('curve slider input did not update state, got '+ev('state.config.stageCurvature'));
 });

 check('instruments add-button wired in its own panel (adds an instrument)', ()=>{
   ev('state.instruments=[{id:"inst_keys",label:"Keys",assignedTo:"",vocalistPlayer:null,tag:"Keys",pack:"Keys"}];');
   ev("openSettings('instruments')");
   const before=ev('state.instruments.length');
   doc.getElementById('addInstrumentBtn').click();
   const after=ev('state.instruments.length');
   if(after!==before+1) throw new Error('add-instrument did not grow roster: '+before+' -> '+after);
 });

 check('✓ Items block-Display toggle relocated to the Setup Items tab', ()=>{
   ev("openSettings('setups')");
   const setupsEdit=doc.getElementById('setupsEdit');
   const toggle=setupsEdit.querySelector('[data-cfg-blockdisplay]');
   if(!toggle) throw new Error('block-Display toggle not found in Setup Items tab');
   // and it is NOT in the Display tab anymore
   ev("openSettings('layout')");
   if(doc.getElementById('layoutEdit').querySelector('[data-cfg-blockdisplay]')) throw new Error('block-Display toggle should NOT be in the Display tab');
 });

 check('block-Display toggle in Setup Items persists to state.config.blockDisplayUntilSetup', ()=>{
   ev("openSettings('setups')");
   const toggle=doc.getElementById('setupsEdit').querySelector('[data-cfg-blockdisplay]');
   toggle.checked=false;
   toggle.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev('state.config.blockDisplayUntilSetup')!==false) throw new Error('toggle did not persist false');
   toggle.checked=true;
   toggle.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev('state.config.blockDisplayUntilSetup')!==true) throw new Error('toggle did not persist true');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
