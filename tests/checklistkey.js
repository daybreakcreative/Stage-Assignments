// FIX #1 — go-live checklist check-offs must survive a setup rebuild.
// Before the fix collectChecklistItems keyed each item `stableKey|item.id`, and item.id is
// re-minted by newSetupItem on every rebuildPersonItems (toggle a selection, add/remove a custom
// item, PCO re-pull). So a check-off stored under the old id no longer matched the new key and the
// box reset itself. The fix keys by text (`stableKey|text`) — stable across rebuilds, mirroring how
// the editor's doneThisService already survives by text. This test inserts a rebuild BETWEEN the
// check-off and the re-read (the step tests/checklist.js's "toggling persists" case omits, which is
// why that one passed while the bug shipped).
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
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }

// Seed a reliable scenario that produces real band checklist items (mirrors tests/checklist.js).
function setup(){
  ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[]; state.pcoConfig.selectedPlanId='PLANK';`);
  ev(`if(!state.config.setupDefaults) state.config.setupDefaults={};
      state.config.setupDefaults.md={selections:{rig:['md_tracks','md_talk']},customOptions:[]};
      state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};`);
  ev(`state.instruments=[{id:'inst_k',label:'Keys',tag:'Keys',assignedTo:'Dave Lee'}]; state.musicDirectorId='inst_k';`);
}
// Re-mint every setup item's id, exactly as a selection toggle / add / PCO re-pull would.
function rebuildAll(){
  ev(`Object.keys(state.setupItems).forEach(function(k){ var t=k.split('|')[2]; rebuildPersonItems(k, (t&&t!=='none')?t:null); });`);
}
// From collectChecklistItems, the first band item's {key, itemText}.
function firstBandItem(){
  return ev(`(function(){var secs=collectChecklistItems();var band=secs.find(s=>s.key==='band');if(!band||!band.items.length)return null;return {key:band.items[0].key, text:band.items[0].itemText};})()`);
}
// The key for a band item matching a given text (post-rebuild lookup — match by text, not index).
function bandKeyForText(t){
  return ev(`(function(){var secs=collectChecklistItems();var band=secs.find(s=>s.key==='band');if(!band)return null;var it=band.items.find(i=>i.itemText===${JSON.stringify(t)});return it?it.key:null;})()`);
}

window.addEventListener('load', ()=>setTimeout(()=>{
  console.log('--- FIX #1: go-live checklist check-offs survive a rebuild ---');

  check('precondition: a band checklist item exists', ()=>{
    setup();
    const it = firstBandItem();
    if (!it || !it.key) throw new Error('no band checklist item produced by setup');
  });

  check('1) an item key is STABLE across rebuildPersonItems (no id churn)', ()=>{
    setup();
    const before = firstBandItem();
    rebuildAll();                       // re-mints ids — the bug trigger
    const after = bandKeyForText(before.text);
    if (after === null) throw new Error('item vanished after rebuild: '+before.text);
    if (after !== before.key) throw new Error('key changed across rebuild:\n  before='+before.key+'\n  after ='+after);
  });

  check('2) a check-off SURVIVES a rebuild (the regression)', ()=>{
    setup();
    const it = firstBandItem();
    ev(`getChecklistState()[${JSON.stringify(it.key)}]=true;`);   // check it off
    rebuildAll();
    const newKey = bandKeyForText(it.text);
    const done = ev(`!!getChecklistState()[${JSON.stringify(newKey)}]`);
    if (!done) throw new Error('check-off lost after rebuild (key '+it.key+' -> '+newKey+')');
  });

  check('3) two items with different text get distinct, stable keys', ()=>{
    setup();
    const secs = ev(`(function(){var s=collectChecklistItems().find(x=>x.key==='band');return s?s.items.map(i=>({t:i.itemText,k:i.key})):[];})()`);
    if (secs.length < 2) { console.log('     (only '+secs.length+' band item(s); distinctness trivially holds)'); return; }
    const keys = secs.map(x=>x.k);
    if (new Set(keys).size !== keys.length) throw new Error('duplicate keys across distinct items: '+JSON.stringify(secs));
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 140));
