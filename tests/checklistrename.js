// FIX #1 follow-up — renaming a person must move their go-live checklist check-offs.
// Go-live check-offs are keyed `${normFullName}|role|typeKey|itemText` (FIX #1). setPreferredName()
// re-keys the per-person stores on a rename (setupItems, musicianPreferences, micPrefs) but OMITTED
// checklistState, so a rename orphaned the check-offs. (The old remapChecklistKeys used a dead
// display-name format that never matched the real keys.) setPreferredName now re-keys checklistState
// too, across every plan. This test renames a person who has a checked-off item and asserts it follows.
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

// A band person (Keys) with real checklist items — same reliable seed as tests/checklistkey.js.
function setup(){
  ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[]; state.config.stageFeatures=[]; state.pcoConfig.selectedPlanId='PLANK'; state.nameAliases={};`);
  ev(`if(!state.config.setupDefaults) state.config.setupDefaults={};
      state.config.setupDefaults.md={selections:{rig:['md_tracks','md_talk']},customOptions:[]};
      state.config.setupDefaults.keys={selections:{source:'k_house'},customOptions:[]};`);
  ev(`state.instruments=[{id:'inst_k',label:'Keys',tag:'Keys',assignedTo:'Dave Lee'}]; state.musicDirectorId='inst_k';`);
}
function firstBandItem(){
  return ev(`(function(){var b=collectChecklistItems().find(s=>s.key==='band');if(!b||!b.items.length)return null;return {key:b.items[0].key, text:b.items[0].itemText};})()`);
}
function bandKeyForText(t){
  return ev(`(function(){var b=collectChecklistItems().find(s=>s.key==='band');if(!b)return null;var it=b.items.find(i=>i.itemText===${JSON.stringify(t)});return it?it.key:null;})()`);
}

window.addEventListener('load', ()=>setTimeout(()=>{
  console.log('--- FIX #1 follow-up: rename moves go-live check-offs ---');

  check('precondition: band item exists and its key is normName-prefixed', ()=>{
    setup();
    const it = firstBandItem();
    if (!it || !it.key) throw new Error('no band item');
    if (it.key.indexOf('dave lee|') !== 0) throw new Error('key not normName-prefixed: '+it.key);
  });

  check('renaming a band member moves their checked-off item to the new key', ()=>{
    setup();
    const it = firstBandItem();
    ev(`getChecklistState()[${JSON.stringify(it.key)}]=true;`);
    ev(`setPreferredName('Dave Lee','David Lee');`);              // the rename
    // person is now David Lee; find the same item text and confirm the check-off followed
    const newKey = bandKeyForText(it.text);
    if (newKey === null) throw new Error('item vanished after rename: '+it.text);
    if (newKey.indexOf('david lee|') !== 0) throw new Error('new key not re-based to David Lee: '+newKey);
    const done = ev(`!!getChecklistState()[${JSON.stringify(newKey)}]`);
    if (!done) throw new Error('check-off did NOT follow the rename (new key '+newKey+')');
    // and the old key is gone (moved, not copied)
    const oldStillThere = ev(`!!getChecklistState()[${JSON.stringify(it.key)}]`);
    if (oldStillThere) throw new Error('old key left behind (copied not moved): '+it.key);
  });

  check('rename moves check-offs across ALL plans, not just the current one', ()=>{
    setup();
    const it = firstBandItem();
    // stamp the same check-off into a second, non-current plan
    ev(`state.checklistState['PLAN_OTHER']={}; state.checklistState['PLAN_OTHER'][${JSON.stringify(it.key)}]=true;`);
    ev(`getChecklistState()[${JSON.stringify(it.key)}]=true;`);
    ev(`setPreferredName('Dave Lee','David Lee');`);
    const newKey = bandKeyForText(it.text);
    const other = ev(`!!state.checklistState['PLAN_OTHER'][${JSON.stringify(newKey)}]`);
    if (!other) throw new Error('other-plan check-off not remapped');
    const otherOld = ev(`!!state.checklistState['PLAN_OTHER'][${JSON.stringify(it.key)}]`);
    if (otherOld) throw new Error('other-plan old key left behind');
  });

  check('a case-only rename does not lose the check-off', ()=>{
    setup();
    const it = firstBandItem();
    ev(`getChecklistState()[${JSON.stringify(it.key)}]=true;`);
    ev(`setPreferredName('Dave Lee','dave lee');`);   // normFullName unchanged → no-op rekey
    const done = ev(`!!getChecklistState()[${JSON.stringify(it.key)}]`);
    if (!done) throw new Error('case-only rename dropped the check-off');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 140));
