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

  console.log('--- stable keys, seed-once, migration ---');
  check('seedPersonSetup seeds once from church defaults, never re-seeds', ()=>{
    ev(`state.config.setupDefaults = { bass:{ selections:{ rig:'b_house', extras:['b_di'] }, customOptions:[] } };`);
    ev(`state.setupItems = {};`);
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    ev(`seedPersonSetup('${k}','bass')`);
    const n1 = ev(`state.setupItems['${k}'].items.length`);
    ev(`state.setupItems['${k}'].items.push({id:'x',text:'manual',doneThisService:false});`);
    ev(`seedPersonSetup('${k}','bass')`);
    const n2 = ev(`state.setupItems['${k}'].items.length`);
    if (n2 !== n1 + 1) throw new Error('re-seed changed items ('+n1+'->'+n2+')');
  });
  check('rebuildPersonItems recomputes items, preserving done-status by text', ()=>{
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    ev(`state.setupItems['${k}'].items.forEach(it=>{ if(it.text==='Needs DI') it.doneThisService=true; });`);
    ev(`state.setupItems['${k}'].selections.extras=['b_di','b_music'];`);
    ev(`rebuildPersonItems('${k}','bass')`);
    const di = ev(`state.setupItems['${k}'].items.find(i=>i.text==='Needs DI')`);
    if (!di || !di.doneThisService) throw new Error('done-status not preserved on rebuild');
    if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Music stand')`)) throw new Error('new selection not added');
  });
  check('migration merges legacy name|instId bucket into stable key, no loss, dedupe', ()=>{
    ev(`state.instruments = [{id:'inst_bass', label:'Bass', tag:'Bass', assignedTo:'Sam Lee'}];`);
    ev(`state.setupItems = { 'sam lee|inst_bass': { items:[{id:'a',text:'Needs DI',doneThisService:true},{id:'b',text:'Needs DI',doneThisService:false}] } };`);
    ev(`migrateLegacySetupBuckets()`);
    if (ev(`!!state.setupItems['sam lee|inst_bass']`)) throw new Error('legacy key not removed');
    const k = ev(`stableSetupKey('Sam Lee','band','bass')`);
    const items = ev(`state.setupItems['${k}'].items`);
    const diCount = items.filter(i=>i.text==='Needs DI').length;
    if (diCount !== 1) throw new Error('dup not merged: '+diCount);
    if (!items.find(i=>i.text==='Needs DI').doneThisService) throw new Error('done-status not preferred');
  });
  check('migration is idempotent (running twice is safe)', ()=>{
    const before = ev(`Object.keys(state.setupItems).length`);
    ev(`migrateLegacySetupBuckets()`);
    const after = ev(`Object.keys(state.setupItems).length`);
    if (after !== before) throw new Error('not idempotent ('+before+'->'+after+')');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
