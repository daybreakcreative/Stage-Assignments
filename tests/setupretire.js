// Regression guard for the flat-setup-UI retirement.
// The person card is grouped-only now; the flat "Quick add" preset chips,
// "Edit presets", "+ Default setup", "+ Template", and "Save…" affordances were
// removed. "Add item" writes a custom item (bucket.customItems) and rebuilds —
// it must NOT be wiped when the grouped editor regenerates items. This asserts
// (a) the retired symbols/markup are gone and (b) the data-loss repro is fixed.
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
    window.confirm = window.confirm || (()=>true);
    window.prompt = window.prompt || (()=>null);
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{
  ev('toast=function(){};');

  check('(a1) retired flat-setup globals are undefined', ()=>{
    for (const sym of ['SETUP_ITEM_PRESETS','getSetupPresets','renderPresetEditor','openSaveOptionsMenu','openTemplateMenu','applyTemplateToPerson','saveCurrentItemsAsTemplate','renderTemplatesEditor','maybeAutoLoadPersonDefaults']){
      if (ev(`typeof ${sym}`) !== 'undefined') throw new Error(sym+' is still defined');
    }
  });

  // Render a live person card and inspect its markup for the removed affordances.
  ev(`state.instruments.find(i=>i.id==='inst_keys').assignedTo='Jordan Kim';
      state.setupItems={}; renderSetupItemsView();`);
  check('(a2) person card markup has no flat-setup affordances', ()=>{
    const root = doc.getElementById('setupItemsView');
    if (!root) throw new Error('setupItemsView not rendered');
    const html = root.innerHTML;
    for (const bad of ['data-action="edit-presets"','data-action="apply-template"','data-action="save-options"','data-preset-idx','data-preset-defaults','si-preset-btn','data-add-onetime']){
      if (html.indexOf(bad) !== -1) throw new Error('flat affordance still present: '+bad);
    }
    // The grouped editor + check-off + add-item must survive.
    if (html.indexOf('data-action="edit-setup"') === -1) throw new Error('grouped "Edit setup" button missing');
    if (html.indexOf('data-action="add-item"') === -1) throw new Error('add-item affordance missing');
  });

  // ---- (b) data-loss repro: church default + custom item survives rebuild ----
  // Seed a keys player from a church default, add a custom item via the customItems
  // path, then run rebuildPersonItems (what the grouped editor does on any change).
  check('(b) custom item survives rebuildPersonItems (no data loss)', ()=>{
    ev(`state.config.setupDefaults = { keys:{ selections:{ source:'k_house', inputs:'k_in2', cabling:['k_di'], extras:[] }, customOptions:[] } };`);
    const k = ev(`stableSetupKey('Casey Byrd','band','keys')`);
    ev(`state.setupItems={}; seedPersonSetup('${k}','keys');`);
    // A church-default line should be present after seeding.
    const seeded = ev(`state.setupItems['${k}'].items.map(i=>i.text)`);
    if (!seeded.length) throw new Error('seed produced no items');
    // Add a custom item through the retained model path (customItems + rebuild).
    ev(`(state.setupItems['${k}'].customItems=state.setupItems['${k}'].customItems||[]).push({id:'ci1',text:'Bring gaff tape'});`);
    ev(`rebuildPersonItems('${k}','keys');`);
    const after = ev(`state.setupItems['${k}'].items.map(i=>i.text)`);
    if (!after.includes('Bring gaff tape')) throw new Error('custom item wiped by rebuild: '+after.join('|'));
    // The church-default lines must also still be present (grouped selections intact).
    if (!after.some(t=>seeded.includes(t))) throw new Error('church-default lines lost after rebuild: '+after.join('|'));
  });

  check('(b2) addItemForPerson writes a custom item that survives a later rebuild', ()=>{
    const k = ev(`stableSetupKey('Casey Byrd','band','keys')`);
    // Simulate the card's add-item flow: put text in the add input, then call the handler.
    ev(`(function(){
      var root=document.getElementById('setupItemsView');
      // Ensure the card exists for this player.
      state.instruments.find(i=>i.id==='inst_keys').assignedTo='Casey Byrd';
      renderSetupItemsView();
      var inp=document.querySelector('[data-add-input="'+cssEscape('${k}')+'"]');
      if(!inp) throw new Error('no add input for card');
      inp.value='Extra XLR';
      addItemForPerson('${k}','keys');
    })();`);
    if (!ev(`(state.setupItems['${k}'].customItems||[]).some(c=>c.text==='Extra XLR')`)) throw new Error('add did not write to customItems');
    ev(`rebuildPersonItems('${k}','keys');`);
    if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Extra XLR')`)) throw new Error('added item lost after rebuild');
  });

  console.log('\n=== RESULT:', errors.length?(errors.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
  if (errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 150));
