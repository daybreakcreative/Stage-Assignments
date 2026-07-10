// FIX #6 — editing a setup item's text must survive the next rebuildPersonItems().
// Before the fix both inline edit paths wrote only to the DERIVED bucket.items[].text, which
// resolveSetupItems/rebuildPersonItems regenerate from selections + customItems — so the edit
// silently reverted on the next group toggle / add / PCO re-pull. The fix routes edits to the
// source of truth: custom items edited in place; catalog/preset lines recorded as a `replaces`
// override on customItems (rendered by resolveSetupItems, original skipped — no duplicate).
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

const KEY = 'Test Player|band|eg';
// Re-seed a fresh eg bucket: a stereo rig (catalog line 'Stereo guitar rig' + its addItems) plus
// one real custom item. Returns the resolved item texts after a clean rebuild.
function seed() {
  ev(`state.setupItems = state.setupItems || {};
      state.setupItems['${KEY}'] = { selections:{ rig:'eg_stereo' }, customItems:[{ id:'c1', text:'Custom pedalboard power' }], items:[], seeded:true, needsReview:false };
      rebuildPersonItems('${KEY}','eg');`);
}
const texts = () => ev(`state.setupItems['${KEY}'].items.map(i=>i.text)`);
const count = (arr, t) => arr.filter(x => x === t).length;

window.addEventListener('load', ()=>setTimeout(()=>{
  console.log('--- FIX #6: setup item text edits survive rebuild ---');

  check('baseline: rig line + its addItems + custom all resolve', ()=>{
    seed();
    const t = texts();
    if (!t.includes('Stereo guitar rig')) throw new Error('no rig line: '+t.join('|'));
    if (!t.includes('Custom pedalboard power')) throw new Error('no custom: '+t.join('|'));
  });

  check('6a) editing a CUSTOM item survives a later rebuild (no revert, no dup)', ()=>{
    seed();
    const changed = ev(`editSetupItemText('${KEY}','eg','Custom pedalboard power','Custom pedalboard AC')`);
    if (!changed) throw new Error('editSetupItemText returned false');
    ev(`rebuildPersonItems('${KEY}','eg')`);           // simulate a later rebuild (the bug trigger)
    const t = texts();
    if (!t.includes('Custom pedalboard AC')) throw new Error('edit reverted: '+t.join('|'));
    if (t.includes('Custom pedalboard power')) throw new Error('old text still present: '+t.join('|'));
    if (count(t,'Custom pedalboard AC') !== 1) throw new Error('duplicated: '+t.join('|'));
    // edited IN PLACE on the existing custom entry (no spurious replaces override)
    const ci = ev(`JSON.stringify(state.setupItems['${KEY}'].customItems)`);
    if (!/Custom pedalboard AC/.test(ci) || /replaces/.test(ci)) throw new Error('custom not edited in place: '+ci);
  });

  check('6b) editing a PRESET/catalog line survives rebuild with NO duplicate', ()=>{
    seed();
    const changed = ev(`editSetupItemText('${KEY}','eg','Stereo guitar rig','Stereo rig (SL)')`);
    if (!changed) throw new Error('editSetupItemText returned false');
    ev(`rebuildPersonItems('${KEY}','eg')`);
    const t = texts();
    if (!t.includes('Stereo rig (SL)')) throw new Error('preset edit reverted: '+t.join('|'));
    if (t.includes('Stereo guitar rig')) throw new Error('original catalog line NOT skipped (duplicate): '+t.join('|'));
    if (count(t,'Stereo rig (SL)') !== 1) throw new Error('duplicated: '+t.join('|'));
    // recorded as a replaces-override pointing at the original catalog text
    const ci = ev(`JSON.stringify(state.setupItems['${KEY}'].customItems)`);
    if (!/"replaces":"Stereo guitar rig"/.test(ci)) throw new Error('no replaces override recorded: '+ci);
  });

  check('6c) re-editing the same preset updates in place (no stacked overrides)', ()=>{
    seed();
    ev(`editSetupItemText('${KEY}','eg','Stereo guitar rig','Stereo rig (SL)')`);
    ev(`editSetupItemText('${KEY}','eg','Stereo rig (SL)','Stereo rig (stage left)')`);
    ev(`rebuildPersonItems('${KEY}','eg')`);
    const t = texts();
    if (!t.includes('Stereo rig (stage left)')) throw new Error('second edit lost: '+t.join('|'));
    if (t.includes('Stereo rig (SL)')) throw new Error('intermediate text leaked: '+t.join('|'));
    if (t.includes('Stereo guitar rig')) throw new Error('original leaked: '+t.join('|'));
    const overrides = ev(`state.setupItems['${KEY}'].customItems.filter(ci=>ci.replaces==='Stereo guitar rig').length`);
    if (overrides !== 1) throw new Error('expected exactly 1 override, got '+overrides);
  });

  check('6d) editing the preset keeps its addItems (renames the header line only)', ()=>{
    seed();
    ev(`editSetupItemText('${KEY}','eg','Stereo guitar rig','Stereo rig (SL)')`);
    ev(`rebuildPersonItems('${KEY}','eg')`);
    const t = texts();
    // 'Stereo DI box' is an addItem of the stereo rig option — it must still resolve
    if (!t.includes('Stereo DI box')) throw new Error('addItems dropped when header reworded: '+t.join('|'));
  });

  check('6e) backward compatible: customItems with no `replaces` behave exactly as before', ()=>{
    const lines = ev(`resolveSetupItems('bass', {}, [{text:'X'}]).map(i=>i.text).join(',')`);
    if (lines !== 'X') throw new Error('legacy resolve changed: '+lines);
    // a replaces override skips only its own original, nothing else
    const l2 = ev(`resolveSetupItems('eg', { rig:'eg_stereo' }, [{ text:'Renamed', replaces:'Stereo guitar rig' }]).map(i=>i.text)`);
    if (l2.includes('Stereo guitar rig')) throw new Error('original not skipped: '+l2.join('|'));
    if (!l2.includes('Renamed')) throw new Error('override text missing: '+l2.join('|'));
    if (!l2.includes('Stereo DI box')) throw new Error('unrelated addItem wrongly skipped: '+l2.join('|'));
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
