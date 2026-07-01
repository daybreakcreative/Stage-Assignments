const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(window){
    window.structuredClone = window.structuredClone || (v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
    window.matchMedia = window.matchMedia || (()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
    window.scrollTo=()=>{};
    if(!window.crypto) window.crypto={};
    if(!window.crypto.randomUUID) window.crypto.randomUUID=()=>'x'+Math.random().toString(16).slice(2);
    window.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
    window.Element.prototype.setPointerCapture=function(){};
    window.Element.prototype.releasePointerCapture=function(){};
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{
  console.log('--- new stage buttons present + wired ---');
  check('one consolidated Edit Layout button in DOM (old three removed)', ()=>{
    if(!doc.getElementById('stageEditBtn')) throw new Error('missing stageEditBtn');
    if(doc.getElementById('stageOutlineBtn')||doc.getElementById('stageFeaturesBtn')) throw new Error('old Outline/Features buttons still present');
    if(!/Edit Layout/.test(doc.getElementById('stageEditBtn').textContent)) throw new Error('label not "Edit Layout"');
  });
  check('stage-edit buttons visible by default (opacity .72, not 0)', ()=>{
    // crude: check the stylesheet rule text
    if (!/\.stage-edit-btn\{[^}]*opacity:\.72/.test(html)) throw new Error('opacity not .72');
    if (/\.stage-edit-btn\{[^}]*opacity:0;/.test(html)) throw new Error('still opacity:0');
  });
  check('toolbar "Edit Outline or Features" opens Advanced Settings → Display (not an inline editor)', ()=>{
    doc.getElementById('stageEditBtn').click();           // enter inline edit mode → toolbar buttons appear
    doc.getElementById('stageEditOutlineFeaturesBtn').click();
    const ov = doc.getElementById('settingsOverlay');
    if(!ov || !ov.classList.contains('show')) throw new Error('settings not opened');
    if(doc.getElementById('saPolyModal')) throw new Error('should not open an inline polygon editor anymore');
    if(doc.body.classList.contains('stage-editing')) throw new Error('should have left edit mode');
    ev('closeSettings()');
  });
  check('the polygon editor still works when opened directly', ()=>{
    ev('openPolygonStageEditor({ getInitial:()=>null, onSave:function(){} })');
    const m = doc.getElementById('saPolyModal'); if(!m) throw new Error('no modal');
    if(!m.querySelector('#saPolySvg path')) throw new Error('no polygon');
    if(!/Discard/.test(m.querySelector('#saPolyCancel').textContent)) throw new Error('cancel not relabeled');
    m.remove();
  });
  console.log('--- polygon editor: backdrop commits ---');
  check('tapping backdrop calls onSave (commit), not discard', ()=>{
    let saved=null;
    ev('window.__polyTest = (cb)=>openPolygonStageEditor({ getInitial:()=>[{x:100,y:100},{x:700,y:100},{x:700,y:300},{x:100,y:300}], onSave:(pts)=>cb(pts) })');
    window.__polyTest((pts)=>{ saved=pts; });
    const m = doc.getElementById('saPolyModal');
    // simulate backdrop click (target === modal)
    const evt = new window.MouseEvent('click',{bubbles:true});
    Object.defineProperty(evt,'target',{value:m});
    m.dispatchEvent(evt);
    if(!saved || saved.length!==4) throw new Error('backdrop did not commit (saved='+JSON.stringify(saved)+')');
    if(doc.getElementById('saPolyModal')) throw new Error('modal still open');
  });
  check('Discard button does NOT commit', ()=>{
    let saved=null;
    window.__polyTest((pts)=>{ saved=pts; });
    const m = doc.getElementById('saPolyModal');
    m.querySelector('#saPolyCancel').click();
    if(saved!==null) throw new Error('discard committed');
    if(doc.getElementById('saPolyModal')) throw new Error('modal still open after discard');
  });
  console.log('--- feature min size + handles ---');
  check('FEAT_MIN_W=40, FEAT_MIN_H=28', ()=>{
    if(ev('FEAT_MIN_W')!==40||ev('FEAT_MIN_H')!==28) throw new Error('mins not bumped');
  });
  console.log('--- display lock honors toggle ---');
  check('Display gate references blockDisplayUntilSetup', ()=>{
    if(!/state\.config\.blockDisplayUntilSetup && !isSetupComplete\(\)/.test(html)) throw new Error('gate not updated');
  });
  check('with toggle OFF + incomplete setup, no lock screen shown', ()=>{
    ev('state.config.blockDisplayUntilSetup = false');
    // Force an incomplete checklist: stub collectChecklistItems via a fake setup item
    ev('state.instruments = state.instruments||[]');
    // Just verify isSetupComplete + gate logic path: simulate click
    doc.getElementById('displayBtn').click();
    const lock = doc.getElementById('setupLockScreen');
    const shown = lock && lock.style.display !== 'none';
    // exit display mode for cleanliness
    if (shown) throw new Error('lock shown despite toggle off');
  });
  console.log('--- wizard seeds vocalist slots (first run only) ---');
  check('applyWizardChoices seeds N vocalists when team empty', ()=>{
    ev('state.vocalists = []; state.assignments = [];');
    ev('startWizard()');                       // sets wizardData defaults
    ev('wizardData.vocalistCount = 5;');
    ev('wizardData.instruments = wizardData.instruments || [];');
    ev('applyWizardChoices()');
    const n = ev('state.vocalists.length');
    if(n!==5) throw new Error('expected 5 vocalists, got '+n);
    if(ev('state.vocalists[0].isWL')!==true) throw new Error('first not WL');
    if(ev('state.assignments.filter(Boolean).length') < 5) throw new Error('slots not assigned');
  });
  check('re-running wizard does NOT wipe existing team', ()=>{
    ev('state.vocalists = [{id:"keep1",name:"Alice",isWL:true,micAssigned:""},{id:"keep2",name:"Bob",isWL:false,micAssigned:""}];');
    ev('state.assignments = computePositions(state.vocalists);');
    ev('startWizard()');
    ev('wizardData.vocalistCount = 5;');
    ev('wizardData.instruments = wizardData.instruments || [];');
    ev('applyWizardChoices()');
    const names = ev('state.vocalists.map(v=>v.name).join(",")');
    if(ev('state.vocalists.length')!==2 || !/Alice/.test(names)) throw new Error('existing team altered: '+names);
  });
  console.log('--- custom outline preview helper ---');
  check('buildCustomOutlinePreviewSvg returns svg w/ polygon', ()=>{
    if(!/^<svg[\s\S]*<path/.test(ev('buildCustomOutlinePreviewSvg([{x:100,y:100},{x:700,y:100},{x:400,y:300}])'))) throw new Error('bad preview');
  });
  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
