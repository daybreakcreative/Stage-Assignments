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

  console.log('--- SETUP_TEMPLATES catalog ---');
  check('all 8 instrument keys present', ()=>{
    const keys = ev('Object.keys(SETUP_TEMPLATES).sort().join(",")');
    if (keys !== 'ag,bass,drums,eg,keys,md,strings,vocals') throw new Error('keys: '+keys);
  });
  check('every group is well-formed (id, name, type radio|check, unique option ids)', ()=>{
    const bad = ev(`(function(){
      const errs=[];
      for (const k in SETUP_TEMPLATES){
        const t=SETUP_TEMPLATES[k];
        if(!t.label) errs.push(k+':no label');
        (t.groups||[]).forEach(g=>{
          if(!g.id||!g.name) errs.push(k+':group missing id/name');
          if(g.type!=='radio'&&g.type!=='check') errs.push(k+'/'+g.id+':bad type');
          const ids=(g.options||[]).map(o=>o.id);
          if(ids.some(x=>!x)) errs.push(k+'/'+g.id+':option missing id');
          if(new Set(ids).size!==ids.length) errs.push(k+'/'+g.id+':dup option ids');
          (g.options||[]).forEach(o=>{ if(!o.text) errs.push(k+'/'+g.id+':option missing text'); });
        });
      }
      return errs.join('|');
    })()`);
    if (bad) throw new Error(bad);
  });
  check('no built-in defaults (defaults come from church config)', ()=>{
    const hasDefault = ev(`Object.values(SETUP_TEMPLATES).some(t=>(t.groups||[]).some(g=>(g.options||[]).some(o=>o.default)))`);
    if (hasDefault) throw new Error('a catalog option has a built-in default');
  });
  check('bass rig is radio; bass inputs is check; eg stereo option carries addItems', ()=>{
    const bassRig = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='rig').type`);
    if (bassRig !== 'radio') throw new Error('bass rig not radio');
    const bassInputs = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='inputs').type`);
    if (bassInputs !== 'check') throw new Error('bass inputs not check');
    const egStereo = ev(`SETUP_TEMPLATES.eg.groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_stereo').addItems.length`);
    if (egStereo !== 3) throw new Error('eg stereo addItems wrong');
  });
  check('drums has House snare + House cymbals options', ()=>{
    const texts = ev(`SETUP_TEMPLATES.drums.groups.find(g=>g.id==='options').options.map(o=>o.text)`);
    if (!texts.includes('House snare') || !texts.includes('House cymbals')) throw new Error('drums missing house items: '+texts.join('|'));
  });
  check('keys source = keyboard provisioning; separate "Keys Sounds from" routing group', ()=>{
    const src = ev(`SETUP_TEMPLATES.keys.groups.find(g=>g.id==='source').options.map(o=>o.id).join(',')`);
    if (src !== 'k_house,k_user_kbd') throw new Error('keys source options wrong: '+src);
    const sf = ev(`SETUP_TEMPLATES.keys.groups.find(g=>g.id==='soundsfrom')`);
    if (!sf) throw new Error('keys soundsfrom group missing');
    const sfIds = ev(`SETUP_TEMPLATES.keys.groups.find(g=>g.id==='soundsfrom').options.map(o=>o.id).join(',')`);
    if (sfIds !== 'k_analog,k_dante,k_iface') throw new Error('soundsfrom options wrong: '+sfIds);
    const dante = ev(`SETUP_TEMPLATES.keys.groups.find(g=>g.id==='soundsfrom').options.find(o=>o.id==='k_dante').addItems.length`);
    if (dante !== 1) throw new Error('dante addItems wrong');
  });

  console.log('--- setupCatalog overlay (Task 1: editable setup catalog) ---');
  ev('toast=function(){};');

  check('config has setupCatalog(null-ish) and setupTypeRules(array) defaults', ()=>{
    if(ev('typeof state.config.setupTypeRules')!=='object' || !ev('Array.isArray(state.config.setupTypeRules)')) throw new Error('setupTypeRules not an array');
    const cat=ev('state.config.setupCatalog');
    if(cat!==null) throw new Error('setupCatalog default not null, got '+JSON.stringify(cat));
    const rules=JSON.parse(ev('JSON.stringify(state.config.setupTypeRules)'));
    if(rules.length!==0) throw new Error('setupTypeRules default not [], got '+JSON.stringify(rules));
  });

  check('setupCatalogFor returns the built-in when no overlay', ()=>{
    ev('state.config.setupCatalog=null;');
    const g=JSON.parse(ev("JSON.stringify(setupCatalogFor('eg').groups.map(x=>x.id))"));
    if(!g.includes('rig')) throw new Error('built-in eg catalog missing rig group');
  });

  check('setupCatalogFor prefers the overlay entry when present', ()=>{
    ev("state.config.setupCatalog={ eg:{ label:'Electric', groups:[{id:'rig',name:'Rig',type:'radio',options:[{id:'x1',text:'Helix'}]}] } };");
    const t=ev("setupCatalogFor('eg').groups[0].options[0].text");
    if(t!=='Helix') throw new Error('overlay not used, got '+t);
    ev('state.config.setupCatalog=null;');
  });

  check('allSetupKeys = 8 built-ins, plus any custom overlay keys', ()=>{
    ev('state.config.setupCatalog=null;');
    const base=JSON.parse(ev('JSON.stringify(allSetupKeys())'));
    ['drums','bass','ag','eg','keys','md','strings','vocals'].forEach(k=>{ if(!base.includes(k)) throw new Error('missing '+k); });
    ev("state.config.setupCatalog={ custom_perc:{ label:'Percussion', groups:[] } };");
    const withCustom=JSON.parse(ev('JSON.stringify(allSetupKeys())'));
    if(!withCustom.includes('custom_perc')) throw new Error('custom key not enumerated');
    ev('state.config.setupCatalog=null;');
  });

  check('isCustomSetupKey true only for non-built-in keys', ()=>{
    if(ev("isCustomSetupKey('eg')")) throw new Error('eg flagged custom');
    if(!ev("isCustomSetupKey('custom_perc')")) throw new Error('custom_perc not flagged custom');
  });

  check('loadState coerces a malformed setupCatalog/rules to safe shapes', ()=>{
    ev("localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),{config:Object.assign({},state.config,{setupCatalog:'garbage',setupTypeRules:[{keyword:'x'},{keyword:'p',key:'eg'},null]})})));");
    const s2=ev('(function(){var s=loadState(); return JSON.stringify({cat:s.config.setupCatalog, rules:s.config.setupTypeRules});})()');
    const o=JSON.parse(s2);
    if(o.cat!==null && typeof o.cat!=='object') throw new Error('setupCatalog not coerced, got '+o.cat);
    if(!Array.isArray(o.rules)) throw new Error('rules not array');
    if(o.rules.some(r=>!r||!r.keyword||!r.key)) throw new Error('malformed rule survived: '+JSON.stringify(o.rules));
  });

  check('loadState coerces a well-formed-but-all-entries-malformed setupCatalog object to null', ()=>{
    ev("localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),{config:Object.assign({},state.config,{setupCatalog:{ eg:{ label:'Electric' } }, setupTypeRules:[]})})));");
    const s2=ev('(function(){var s=loadState(); return JSON.stringify({cat:s.config.setupCatalog});})()');
    const o=JSON.parse(s2);
    if(o.cat!==null) throw new Error('all-entries-malformed setupCatalog not coerced to null, got '+JSON.stringify(o.cat));
  });

  check('loadState coerces a literal {} setupCatalog to null', ()=>{
    ev("localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),{config:Object.assign({},state.config,{setupCatalog:{}, setupTypeRules:[]})})));");
    const s2=ev('(function(){var s=loadState(); return JSON.stringify({cat:s.config.setupCatalog});})()');
    const o=JSON.parse(s2);
    if(o.cat!==null) throw new Error('empty-object setupCatalog not coerced to null, got '+JSON.stringify(o.cat));
  });

  console.log('--- catalog edit operations (Task 2: pure catalog-edit ops) ---');
  const freshEg=()=>ev("state.config.setupCatalog=null; catalogMaterialize('eg');");

  check('catalogMaterialize deep-copies the built-in into the overlay', ()=>{
    ev('state.config.setupCatalog=null;');
    ev("catalogMaterialize('eg');");
    if(!ev("!!(state.config.setupCatalog && state.config.setupCatalog.eg)")) throw new Error('overlay eg not created');
    ev("state.config.setupCatalog.eg.groups[0].options[0].text='ZZZ';");
    if(ev("SETUP_TEMPLATES.eg.groups[0].options[0].text")==='ZZZ') throw new Error('overlay aliased the factory');
  });

  check('catalogMaterialize on a non-built-in key returns a blank {label,groups:[]} shape', ()=>{
    ev("state.config.setupCatalog=null;");
    const c=JSON.parse(ev("JSON.stringify(catalogMaterialize('customwidget'))"));
    if(c.label!=='customwidget') throw new Error('label not set to key, got '+JSON.stringify(c.label));
    if(!Array.isArray(c.groups)||c.groups.length!==0) throw new Error('groups not blank, got '+JSON.stringify(c.groups));
  });

  check('mutating ops actually persist to localStorage (saveState is called, not just in-memory)', ()=>{
    freshEg();
    ev("localStorage.removeItem(STORAGE_KEY);");
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    ev(`catalogAddOption('eg','${gid}','Persisted option');`);
    const raw=ev("localStorage.getItem(STORAGE_KEY)");
    if(!raw) throw new Error('no localStorage write after catalogAddOption');
    const saved=JSON.parse(raw);
    const opts=(((saved.config||{}).setupCatalog||{}).eg||{}).groups||[];
    const found=opts.some(g=>g.id===gid && g.options.some(o=>o.text==='Persisted option'));
    if(!found) throw new Error('persisted state does not contain the new option');
  });

  check('catalogRenameOption keeps the id, changes the text', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
    ev(`catalogRenameOption('eg','${gid}','${oid}','Helix');`);
    const o=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options[0])`));
    if(o.text!=='Helix') throw new Error('text not renamed');
    if(o.id!==oid) throw new Error('id changed on rename');
  });

  check('catalogAddOption appends a new option with a fresh id', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const before=ev(`setupCatalogFor('eg').groups[0].options.length`);
    const newId=ev(`catalogAddOption('eg','${gid}','Second rig')`);
    const after=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options)`));
    if(after.length!==before+1) throw new Error('option not added');
    if(after[after.length-1].text!=='Second rig') throw new Error('wrong text');
    if(!after.some(o=>o.id===newId)) throw new Error('returned id not present');
  });

  check('catalogRemoveOption drops it', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
    ev(`catalogRemoveOption('eg','${gid}','${oid}');`);
    if(ev(`setupCatalogFor('eg').groups[0].options.some(o=>o.id==='${oid}')`)) throw new Error('option not removed');
  });

  check('catalogMoveOption reorders within the group', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const first=ev("setupCatalogFor('eg').groups[0].options[0].id");
    ev(`catalogMoveOption('eg','${gid}','${first}',1);`);
    if(ev(`setupCatalogFor('eg').groups[0].options[1].id`)!==first) throw new Error('option not moved down');
  });

  check('catalogMoveOption is bounds-safe at both edges (no throw, no change)', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const before=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options.map(o=>o.id))`));
    const firstId=before[0], lastId=before[before.length-1];
    ev(`catalogMoveOption('eg','${gid}','${firstId}',-1);`);
    ev(`catalogMoveOption('eg','${gid}','${lastId}',1);`);
    const after=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups[0].options.map(o=>o.id))`));
    if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('out-of-range move mutated order: '+after.join(','));
  });

  check('catalogMoveGroup is bounds-safe at both edges (no throw, no change)', ()=>{
    freshEg();
    const before=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups.map(g=>g.id))`));
    const firstId=before[0], lastId=before[before.length-1];
    ev(`catalogMoveGroup('eg','${firstId}',-1);`);
    ev(`catalogMoveGroup('eg','${lastId}',1);`);
    const after=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups.map(g=>g.id))`));
    if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('out-of-range move mutated order: '+after.join(','));
  });

  check('catalogAddGroup / RenameGroup / SetGroupType / RemoveGroup / MoveGroup', ()=>{
    freshEg();
    const gid=ev("catalogAddGroup('eg','New Section','check')");
    if(!ev(`setupCatalogFor('eg').groups.some(g=>g.id==='${gid}' && g.type==='check')`)) throw new Error('group not added');
    ev(`catalogRenameGroup('eg','${gid}','Renamed');`);
    if(ev(`setupCatalogFor('eg').groups.find(g=>g.id==='${gid}').name`)!=='Renamed') throw new Error('group not renamed');
    ev(`catalogSetGroupType('eg','${gid}','radio');`);
    if(ev(`setupCatalogFor('eg').groups.find(g=>g.id==='${gid}').type`)!=='radio') throw new Error('type not set');
    ev(`catalogMoveGroup('eg','${gid}',-1);`);
    ev(`catalogRemoveGroup('eg','${gid}');`);
    if(ev(`setupCatalogFor('eg').groups.some(g=>g.id==='${gid}')`)) throw new Error('group not removed');
  });

  check('catalogResetKey (built-in) drops the overlay entry', ()=>{
    freshEg();
    ev("catalogResetKey('eg');");
    if(ev("!!(state.config.setupCatalog && state.config.setupCatalog.eg)")) throw new Error('overlay eg still present after reset');
  });

  check('renaming an option preserves a rebuilt checklist (id-based resolve)', ()=>{
    freshEg();
    const gid=ev("setupCatalogFor('eg').groups[0].id");
    const oid=ev("setupCatalogFor('eg').groups[0].options[0].id");
    const sel=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{'${gid}':'${oid}'},[]).map(x=>x.text))`));
    ev(`catalogRenameOption('eg','${gid}','${oid}','Helix');`);
    const sel2=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{'${gid}':'${oid}'},[]).map(x=>x.text))`));
    if(!sel2.includes('Helix')) throw new Error('rebuilt items do not show renamed text: '+sel2.join(','));
    if(sel.length!==sel2.length) throw new Error('item count changed on rename');
  });

  console.log('--- catalog editor UI (Task 3: inline structural editor) ---');
  check('renderCatalogEditor renders a row per option and add-section + reset controls', ()=>{
    ev('state.config.setupCatalog=null;');
    const host=doc.createElement('div'); host.id='__catEdit'; doc.body.appendChild(host);
    ev("renderCatalogEditor(document.getElementById('__catEdit'),'eg');");
    const opts=doc.querySelectorAll('#__catEdit .cat-opt-row');
    if(opts.length < 3) throw new Error('expected EG option rows, got '+opts.length);
    if(!doc.querySelector('#__catEdit .cat-add-group')) throw new Error('no add-section control');
    if(!doc.querySelector('#__catEdit .cat-reset')) throw new Error('no reset control');
  });

  check('editing an option text input writes through to the overlay', ()=>{
    ev('state.config.setupCatalog=null;');
    const host=doc.getElementById('__catEdit')||doc.body.appendChild(Object.assign(doc.createElement('div'),{id:'__catEdit'}));
    ev("renderCatalogEditor(document.getElementById('__catEdit'),'eg');");
    const inp=doc.querySelector('#__catEdit .cat-opt-input');
    inp.value='Helix'; inp.dispatchEvent(new window.Event('input',{bubbles:true}));
    if(!ev("JSON.stringify(state.config.setupCatalog.eg).includes('Helix')")) throw new Error('overlay not updated from input');
  });

  console.log('--- catalog editor mount location (critical: Advanced Settings only, wizard untouched) ---');
  // The wizard setup-intro card ALSO exposes the "Edit questions" editor (added by user request
  // 2026-07-30 — was previously settings-only). Deeper lazy-mount + write-through behavior is
  // covered in tests/setupwizard.js; here we just lock that the disclosure is present.
  check('wizard setup-intro card exposes the cat-edit-disclosure (parity with settings)', ()=>{
    ev(`state.config.setupDefaults=null; startWizard(); wizardData.instruments=[{key:'eg',selected:true,label:'Electric Guitar'}]; wizardData.useSetupChecklist=true;`);
    ev(`wizardStepIdx = WIZARD_STEPS.indexOf('setup-intro'); renderWizardStep();`);
    const card = doc.querySelector('#wizardBody .wiz-setup-inst[data-inst-key="eg"]');
    if (!card) throw new Error('eg wizard card not rendered');
    if (!card.querySelector('.cat-edit-disclosure')) throw new Error('wizard card should now have the catalog-editor disclosure');
  });

  check('Advanced Settings card has cat-edit-disclosure; editor renders lazily on first open', ()=>{
    ev(`state.config.setupDefaults={}; state.config.setupCatalog=null;`);
    ev(`renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
    const card = doc.querySelector('#setupDefaultsEditor .wiz-setup-inst[data-def-key="eg"]');
    if (!card) throw new Error('eg settings card not rendered');
    const disc = card.querySelector('.cat-edit-disclosure');
    if (!disc) throw new Error('settings card missing cat-edit-disclosure');
    const mount = disc.querySelector('.cat-edit-mount');
    if (!mount) throw new Error('missing cat-edit-mount');
    if (mount.querySelector('.cat-opt-row')) throw new Error('editor should not be rendered before first open');
    disc.open = true; disc.dispatchEvent(new window.Event('toggle'));
    if (!mount.querySelector('.cat-opt-row')) throw new Error('editor did not lazily render on first open');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
