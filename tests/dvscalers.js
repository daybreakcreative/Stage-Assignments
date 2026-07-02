// Per-section display-view font-scalers + removal of TV/Computer mode.
// Standard jsdom harness (see tests/display.js).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const HTML_PATH=process.env.SA_HTML||require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(HTML_PATH,'utf8');
const errs=[];
function mkdom(){
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
  return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
    w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
    w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
    w.scrollTo=()=>{};
    w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
    w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
  }});
}
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

const dom=mkdom();const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
const varOf=n=>doc.documentElement.style.getPropertyValue(n);

window.addEventListener('load',()=>setTimeout(()=>{
  ev('renderAll=function(){}');
  ev('state.viewMode="display"; renderDisplayView();');

  // ---- TV/Computer mode fully gone ----
  check('body never has tv-mode class after rendering the display view', ()=>{
    if(doc.body.classList.contains('tv-mode')) throw new Error('body has tv-mode');
  });
  check('Settings Display editor has NO tvMode radio', ()=>{
    ev('renderLayoutEditor()');
    if(doc.querySelector('[data-cfg-tvmode]')) throw new Error('data-cfg-tvmode radio still present');
    if(doc.querySelector('input[name="tvMode"]')) throw new Error('tvMode radio still present');
  });
  check('no body.tv-mode CSS rules remain in the stylesheet', ()=>{
    if(/body\.tv-mode\b/.test(html)) throw new Error('body.tv-mode CSS rule still present');
  });
  check('no document.body.classList toggling of tv-mode in JS', ()=>{
    if(/classList\.(add|remove|toggle)\(\s*['"]tv-mode['"]/.test(html)) throw new Error('tv-mode class toggle still in JS');
  });

  // ---- Four hover-tab scalers exist, one per section ----
  check('four section scaler hover-tabs exist (title / stage / vocals / service order)', ()=>{
    const ids=['dvTitleScaleTab','dvStageScaleTab','dvVocScaleTab','dvRsScaleTabDv'];
    ids.forEach(id=>{ if(!doc.getElementById(id)) throw new Error('missing hover-tab #'+id); });
  });

  // ---- Setters apply + persist to CSS vars ----
  check('title scaler setter applies --dv-title-scale', ()=>{
    ev('setDisplaySectionScale("title", 1.4)');
    if(varOf('--dv-title-scale').trim()!=='1.4') throw new Error('got '+varOf('--dv-title-scale'));
  });
  check('stage-text scaler setter applies --dv-stage-text-scale (MISC-5 regression guard)', ()=>{
    ev('setDisplaySectionScale("stageText", 1.3)');
    if(varOf('--dv-stage-text-scale').trim()!=='1.3') throw new Error('got '+varOf('--dv-stage-text-scale'));
  });
  check('vocals scaler setter applies --dv-voc-scale', ()=>{
    ev('setDisplaySectionScale("voc", 0.85)');
    if(varOf('--dv-voc-scale').trim()!=='0.85') throw new Error('got '+varOf('--dv-voc-scale'));
  });
  check('service-order scaler setter applies --rs-scale', ()=>{
    ev('setDisplaySectionScale("runSheet", 1.25)');
    if(varOf('--rs-scale').trim()!=='1.25') throw new Error('got '+varOf('--rs-scale'));
  });

  // ---- No clamp: arbitrarily small / large sticks ----
  check('no lower clamp: 0.5 (below old 70%) sticks for run sheet', ()=>{
    ev('setDisplaySectionScale("runSheet", 0.5)');
    if(varOf('--rs-scale').trim()!=='0.5') throw new Error('run sheet clamped, got '+varOf('--rs-scale'));
  });
  check('no upper clamp: 2.5 sticks for stage text', ()=>{
    ev('setDisplaySectionScale("stageText", 2.5)');
    if(varOf('--dv-stage-text-scale').trim()!=='2.5') throw new Error('stage clamped, got '+varOf('--dv-stage-text-scale'));
  });

  // ---- Persistence: values are written to the per-device store ----
  check('scales persist to localStorage', ()=>{
    ev('setDisplaySectionScale("title", 1.6); setDisplaySectionScale("voc", 0.7); setDisplaySectionScale("stageText", 1.1); setDisplaySectionScale("runSheet", 0.9)');
    const raw=window.localStorage.getItem('stageAssign.v3.displayScales');
    if(!raw) throw new Error('no displayScales key in localStorage');
    const p=JSON.parse(raw);
    if(p.title!==1.6||p.voc!==0.7||p.stageText!==1.1||p.runSheet!==0.9) throw new Error('stored values wrong: '+raw);
  });

  console.log('\n=== Phase 1 (same-DOM) done ===');

  // ---- Reload restores from localStorage ----
  // Capture the store, then boot a fresh DOM whose localStorage already carries it.
  const stored=window.localStorage.getItem('stageAssign.v3.displayScales');

  const dom2=mkdom();const w2=dom2.window;const d2=w2.document;const varOf2=n=>d2.documentElement.style.getPropertyValue(n);
  w2.addEventListener('load',()=>setTimeout(()=>{
    // Seed the per-device store the way a returning device would have it, then re-apply.
    w2.localStorage.setItem('stageAssign.v3.displayScales', stored);
    w2.eval('applyDisplaySectionScales()');
    check('reload restores --dv-title-scale', ()=>{ if(varOf2('--dv-title-scale').trim()!=='1.6') throw new Error('got '+varOf2('--dv-title-scale')); });
    check('reload restores --dv-voc-scale', ()=>{ if(varOf2('--dv-voc-scale').trim()!=='0.7') throw new Error('got '+varOf2('--dv-voc-scale')); });
    check('reload restores --dv-stage-text-scale', ()=>{ if(varOf2('--dv-stage-text-scale').trim()!=='1.1') throw new Error('got '+varOf2('--dv-stage-text-scale')); });
    check('reload restores --rs-scale', ()=>{ if(varOf2('--rs-scale').trim()!=='0.9') throw new Error('got '+varOf2('--rs-scale')); });

    console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
    if(errs.length) console.log(errs.join('\n'));
    process.exitCode=errs.length?1:0;
  },200));
},200));
