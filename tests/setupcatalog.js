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
    ev('state.config.setupCatalog');
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

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
