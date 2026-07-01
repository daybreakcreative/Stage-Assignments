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

  console.log('--- per-person grouped editor ---');
  ev(`state.config.setupDefaults = { keys:{ selections:{ source:'k_house', inputs:'k_in2', cabling:['k_di'], extras:[] }, customOptions:[] } };`);
  const k = ev(`stableSetupKey('Jordan Kim','band','keys')`);
  ev(`state.setupItems={}; seedPersonSetup('${k}','keys');`);
  ev(`var wrap=document.createElement('div'); wrap.id='__ed'; document.body.appendChild(wrap); renderPersonSetupEditor(wrap,'${k}','keys');`);

  check('editor renders radio + check groups reflecting seeded church defaults', ()=>{
    const wrap = doc.getElementById('__ed');
    const src = wrap.querySelector('input[type=radio][value="k_house"]');
    if (!src || !src.checked) throw new Error('house source radio not checked');
    const di = wrap.querySelector('input[type=checkbox][value="k_di"]');
    if (!di || !di.checked) throw new Error('DI checkbox not checked');
  });
  check('changing a radio swaps selection + rebuilds items (done preserved by text)', ()=>{
    const wrap = doc.getElementById('__ed');
    ev(`state.setupItems['${k}'].items.forEach(it=>{ if(it.text==='Stereo DI/DIs & 1/4\\" cables') it.doneThisService=true; });`);
    const dante = wrap.querySelector('input[type=radio][value="k_dante"]');
    dante.checked = true; dante.dispatchEvent(new window.Event('change',{bubbles:true}));
    if (ev(`state.setupItems['${k}'].selections.source`) !== 'k_dante') throw new Error('source not updated');
    const texts = ev(`state.setupItems['${k}'].items.map(i=>i.text)`);
    if (!texts.includes('Needs network — thunderbolt adapter')) throw new Error('dante addItem missing');
    if (texts.includes('House keys rig')) throw new Error('old source line lingered');
  });
  check('adding a custom item appends and persists into items', ()=>{
    const wrap = doc.getElementById('__ed');
    const inp = wrap.querySelector('.sp-custom-input'); const btn = wrap.querySelector('.sp-custom-add');
    inp.value = 'Bring extra sustain pedal'; btn.click();
    if (!ev(`state.setupItems['${k}'].customItems.some(c=>c.text==='Bring extra sustain pedal')`)) throw new Error('custom not saved');
    if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Bring extra sustain pedal')`)) throw new Error('custom not in items');
  });
  check('reconstruct: a migrated bucket (items, empty selections) becomes editable without loss', ()=>{
    ev(`state.setupItems['recon|band|eg']={ selections:{}, customItems:[], items:[{id:'a',text:'Stereo guitar rig',doneThisService:true},{id:'b',text:'Stereo DI box',doneThisService:false},{id:'c',text:'Bring my own cab',doneThisService:false}], seeded:true, needsReview:false };`);
    ev(`reconstructSetupBucket('recon|band|eg','eg')`);
    const sel = ev(`JSON.stringify(state.setupItems['recon|band|eg'].selections)`);
    if (!/eg_stereo/.test(sel)) throw new Error('stereo rig not reconstructed into selections: '+sel);
    if (!ev(`state.setupItems['recon|band|eg'].customItems.some(c=>c.text==='Bring my own cab')`)) throw new Error('unmatched item not moved to custom');
    // rebuild from reconstructed selections should still include the stereo lines and the custom
    ev(`rebuildPersonItems('recon|band|eg','eg')`);
    const t = ev(`state.setupItems['recon|band|eg'].items.map(i=>i.text)`);
    if (!t.includes('Stereo DI box') || !t.includes('Bring my own cab')) throw new Error('lost items after reconstruct+rebuild: '+t.join('|'));
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
