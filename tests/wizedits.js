const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'http://localhost/',
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

  console.log('--- edit 3: off-stage placement (canvas-bounded only) ---');
  check('clampStagePosition no longer clamps to the stage outline (off-stage allowed)', ()=>{
    // y=355 is below the default stage back edge; old clamp would have pulled it up, new keeps it.
    const p = ev('clampStagePosition(400, 355)');
    if (p.y !== 355) throw new Error('y was clamped to the outline, got '+p.y);
    const hi = ev('clampStagePosition(400, 20)');   // above the front edge — off stage, but on canvas
    if (hi.y !== 20) throw new Error('front clamp still active, got '+hi.y);
  });
  check('clampStagePosition still keeps positions inside the visible canvas', ()=>{
    const a = ev('clampStagePosition(900, 500)');
    if (a.x !== 760 || a.y !== 368) throw new Error('max bound wrong: '+JSON.stringify(a));
    const b = ev('clampStagePosition(-50, -50)');
    if (b.x !== 40 || b.y !== 12) throw new Error('min bound wrong: '+JSON.stringify(b));
  });

  console.log('--- edit 1: wizard custom items seed onto each player ---');
  check('seedPersonSetup carries church customOptions into the player as items', ()=>{
    ev(`state.config.setupDefaults = { bass:{ selections:{}, customOptions:[{id:'x',text:'Bring spare cable'}] } };`);
    ev(`state.setupItems = {};`);
    const k = ev(`stableSetupKey('Test Player','band','bass')`);
    ev(`seedPersonSetup('${k}','bass')`);
    if (!ev(`state.setupItems['${k}'].customItems.some(c=>c.text==='Bring spare cable')`)) throw new Error('church custom not seeded to customItems');
    if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Bring spare cable')`)) throw new Error('church custom not in resolved items');
  });
  check('wizard card exposes a per-instrument custom add row', ()=>{
    ev(`state.config.setupDefaults=null;`);
    ev(`startWizard(); wizardData.instruments=[{key:'keys',selected:true,label:'Keys'}]; wizardData.useSetupChecklist=true;`);
    ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
    const card = doc.querySelector('.wiz-setup-inst[data-inst-key="keys"]');
    if (!card) throw new Error('keys card missing');
    const input = card.querySelector('.wiz-setup-custom-input');
    const add = card.querySelector('.wiz-setup-custom-add');
    if (!input || !add) throw new Error('custom add row missing');
    input.value = 'Extra sustain pedal'; add.click();
    if (ev(`(state.config.setupDefaults.keys.customOptions||[]).some(o=>o.text==='Extra sustain pedal')`) !== true) throw new Error('custom option not saved to church defaults');
  });

  console.log('--- edit 2: Reset shape to defaults clears the custom shape ---');
  check('wizard "Reset shape to defaults" clears customStagePoints; Remove-custom button gone', ()=>{
    ev(`startWizard();`);
    ev(`wizardStepIdx = WIZARD_STEPS.indexOf('stage'); renderWizardStep();`);
    ev(`wizardData.customStagePoints = [{x:20,y:60},{x:780,y:60},{x:780,y:300},{x:20,y:300}]; renderWizardStep();`);
    if (doc.getElementById('wizDrawClearSaved')) throw new Error('Remove custom shape button still present');
    const reset = doc.getElementById('wiz_curv_reset');
    if (!reset) throw new Error('Reset shape to defaults button missing');
    reset.click();
    if (ev('wizardData.customStagePoints') !== null) throw new Error('custom shape not cleared by reset');
  });
  check('settings "Reset shape to defaults" also clears the custom outline', ()=>{
    if (!/Reset to defaults also clears any custom outline/.test(html)) throw new Error('settings reset does not clear custom outline');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
