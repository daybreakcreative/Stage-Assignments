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

  console.log('--- wizard: Enter advances single-field steps ---');

  check('Enter in the church-name field advances to the next step (like clicking Next)', ()=>{
    ev('startWizard()');
    ev('wizardStepIdx = 0; renderWizardStep();');
    const inp = doc.getElementById('wiz_church');
    if (!inp) throw new Error('no #wiz_church on the identity step');
    inp.value = 'Test Church';
    inp.dispatchEvent(new window.Event('input', { bubbles:true }));
    const before = ev('wizardStepIdx');
    if (before !== 0) throw new Error('not on identity step, got ' + before);
    inp.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
    const after = ev('wizardStepIdx');
    if (after !== before + 1) throw new Error('Enter did not advance the step (before='+before+', after='+after+')');
    if (ev('wizardData.churchName') !== 'Test Church') throw new Error('church name not saved: ' + ev('wizardData.churchName'));
  });

  check('Enter in the vocalist-count field also advances', ()=>{
    ev('startWizard()');
    ev('wizardStepIdx = WIZARD_STEPS.indexOf("vocalists"); renderWizardStep();');
    const inp = doc.getElementById('wiz_vox_count');
    if (!inp) throw new Error('no #wiz_vox_count on the vocalists step');
    const before = ev('wizardStepIdx');
    inp.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
    const after = ev('wizardStepIdx');
    if (after !== before + 1) throw new Error('Enter did not advance from vocalists (before='+before+', after='+after+')');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
