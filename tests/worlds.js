// Display Worlds — Phase 0 regression suite (added 2026-07-08).
// Asserts the world engine that replaced the 11 color moods: the WORLDS registry,
// setWorld/applyWorld, worldSwatchHtml, DEFAULT_STATE.world + loadState migration,
// the Settings + wizard world pickers, and the renderDisplayView dispatcher seam.
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

// Boot a FRESH, isolated jsdom with `seed` already in localStorage BEFORE the script runs, so the
// top-level `let state = loadState()` runs with that save present. This is the only way to exercise
// the boot-time path where the WORLDS const is still in its temporal dead zone — an eval'd
// loadState() after load can't, because WORLDS is fully initialized by then. Returns the boot state.
function bootWithSeed(seed) {
  return new Promise((resolve, reject) => {
    const d = new JSDOM(html, {runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
      w.localStorage.setItem('stageAssign.v3', JSON.stringify(seed));
      w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
      w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
      w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
      w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
      w.confirm=()=>true;w.prompt=()=>'';
    }});
    d.window.addEventListener('load',()=>setTimeout(()=>{
      try { resolve(d.window.eval('JSON.parse(JSON.stringify({ world:state.world, service:state.service, firstRun:!!state._firstRun, vocalists:state.vocalists }))')); }
      catch(e){ reject(e); }
    },150));
  });
}

window.addEventListener('load',()=>(async()=>{await new Promise(r=>setTimeout(r,150));

 check('WORLDS registry: 6 worlds in order, each with fonts + swatch', () => {
   const order = ev('WORLD_ORDER');
   if (!Array.isArray(order) || order.length !== 6) throw new Error('expected 6 worlds, got '+(order&&order.length));
   const expected = ['molten','concrete','corporate','terra','orbit','atomic'];
   if (order.join(',') !== expected.join(',')) throw new Error('order mismatch: '+order.join(','));
   order.forEach(id => {
     const w = ev(`WORLDS['${id}']`);
     if (!w || !w.fonts || !w.fonts.display || !w.fonts.body) throw new Error(id+' missing fonts');
     if (!Array.isArray(w.swatch) || w.swatch.length !== 3) throw new Error(id+' missing swatch');
   });
 });
 check('world CSS: [data-world="molten"] block exists with fonts', () => {
   const css = ev("document.querySelector('style').textContent");
   if (!/\[data-world="molten"\]/.test(css)) throw new Error('no [data-world="molten"] rule');
   if (!/\[data-world="concrete"\]/.test(css)) throw new Error('no [data-world="concrete"] rule');
 });

 check('setWorld sets data-world + state.world + loads the world font link', () => {
   ev("setWorld('orbit')");
   if (ev("document.documentElement.getAttribute('data-world')") !== 'orbit') throw new Error('data-world not orbit');
   if (ev('state.world') !== 'orbit') throw new Error('state.world not orbit');
   if (!ev("!!document.getElementById('brand-font-Unbounded')")) throw new Error('orbit display font link not added');
   // legacy attrs gone
   if (ev("document.documentElement.getAttribute('data-look')")) throw new Error('data-look should be cleared');
   if (ev("document.documentElement.getAttribute('data-mood')")) throw new Error('data-mood should be cleared');
 });
 check('setWorld falls back to DEFAULT_WORLD on a bad id', () => {
   ev("setWorld('nonsense')");
   if (ev('state.world') !== 'molten') throw new Error('bad id should fall back to molten');
 });

 check('worldSwatchHtml renders a labeled, selectable tile per world', () => {
   const html = ev("worldSwatchHtml('atomic', true)");
   if (!/data-world-opt="atomic"/.test(html)) throw new Error('missing data-world-opt');
   if (!/Atomic/.test(html)) throw new Error('missing label');
   if (!/\bsel\b/.test(html)) throw new Error('selected class not applied');
 });

 check('DEFAULT_STATE.world is molten; legacy look/mood migrate to a world', () => {
   if (ev('DEFAULT_STATE.world') !== 'molten') throw new Error('default world not molten');
   // simulate a legacy save (v3 mood era) and reload state via loadState
   ev("localStorage.setItem('stageAssign.v3', JSON.stringify({ look:'aurora', auroraMood:'nebula', service:{name:'x'} }))");
   ev('state = loadState()');
   if (ev('state.world') !== 'molten') throw new Error('legacy save should migrate to DEFAULT_WORLD molten, got '+ev('state.world'));
 });

 // A save written by THIS build carries a `world` key. `let state = loadState()` runs at top level
 // thousands of lines before `const WORLDS = {…}`, so a `typeof WORLDS` in the migration hits the
 // temporal dead zone and THROWS ReferenceError (it does NOT return 'undefined'); loadState's catch
 // swallows it and returns a fresh first-run state, wiping the user's data. We can only exercise that
 // boot-time path by booting a fresh jsdom with the save pre-seeded (an eval'd loadState() after load
 // sees WORLDS already initialized, so it can't reproduce the bug).
 let bootErr=null, boot=null;
 try { boot = await bootWithSeed({ world:'orbit', service:{name:'KEEPME'}, vocalists:[{id:'v1',name:'Amy'}] }); }
 catch(e){ bootErr = e; }
 check('boot loadState survives a save with a world key (no TDZ throw → no data loss)', () => {
   if (bootErr) throw new Error('boot threw: '+bootErr.message);
   if (boot.world !== 'orbit') throw new Error('saved world not preserved, got '+boot.world);
   if (!boot.service || boot.service.name !== 'KEEPME') throw new Error('service wiped on boot, got '+(boot.service&&boot.service.name));
   if (boot.firstRun) throw new Error('boot fell back to a fresh first-run state (data loss)');
   if (!Array.isArray(boot.vocalists) || boot.vocalists.length !== 1) throw new Error('vocalists wiped, got '+(boot.vocalists&&boot.vocalists.length));
 });

 check('Settings Display tab renders world swatches and applies on click', () => {
   // Stub the live re-render so the click handler doesn't do a full display paint, but SAVE +
   // RESTORE the real renderDisplayView (it's a window-level function-declaration binding, so a
   // bare reassignment would shadow the real one for every later check — e.g. the dispatcher test).
   ev('toast=function(){};saveState=function(){};window.__origRDV=renderDisplayView;renderDisplayView=function(){};renderLayoutEditor()');
   const picker = doc.querySelector('#layoutEdit .world-picker');
   if (!picker) { ev('renderDisplayView=window.__origRDV'); throw new Error('no .world-picker in Display tab'); }
   const tiles = picker.querySelectorAll('[data-world-opt]');
   if (tiles.length !== 6) { ev('renderDisplayView=window.__origRDV'); throw new Error('expected 6 world tiles, got '+tiles.length); }
   const orbit = picker.querySelector('[data-world-opt="orbit"]');
   orbit.click();
   const w = ev('state.world');
   ev('renderDisplayView=window.__origRDV');   // restore the real renderer for later checks
   if (w !== 'orbit') throw new Error('clicking a tile did not setWorld');
 });

 check('wizard look step renders world swatches', () => {
   // renderWizardStep for the "look" step should emit .world-picker with 6 tiles.
   ev("startWizard(); wizardStepIdx = WIZARD_STEPS.indexOf('look'); renderWizardStep();");
   const picker = doc.querySelector('#wizardBody .world-picker, .wizard-body .world-picker, .world-picker');
   if (!picker) throw new Error('wizard look step has no .world-picker');
   if (picker.querySelectorAll('[data-world-opt]').length !== 6) throw new Error('expected 6 world tiles in wizard');
 });

 check('renderDisplayView delegates to a world renderer when present', () => {
   ev("window.__ran=null; WORLDS.molten.renderDisplay = function(){ window.__ran='molten'; };");
   ev("state.world='molten'; renderDisplayView();");
   const ran = ev('window.__ran');
   ev("delete WORLDS.molten.renderDisplay;");   // clean up so the default path is restored
   if (ran !== 'molten') throw new Error('dispatcher did not call WORLDS.molten.renderDisplay');
 });
 check('renderDisplayView runs the default layout without throwing when no world renderer', () => {
   ev("state.world='molten'; renderDisplayView();");  // must not throw
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
})());
