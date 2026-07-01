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

  console.log('--- post-pull popup: grouped setup per new person ---');

  // A brand-new vocalist and a brand-new bass player, no recorded preferences yet.
  ev(`
    state.config.setupDefaults = {
      vocals: { selections:{ options:['v_stand'] }, customOptions:[] },
      bass:   { selections:{ rig:'b_house' },       customOptions:[] }
    };
    state.musicianPreferences = {};
    state.shadowPreferences = state.shadowPreferences || {};
    state.setupItems = {};
    state.vocalists = [{ id:'vv', name:'Val Singer', isWL:false, leadsSongs:false, micAssigned:'' }];
    state.assignments = new Array(MAX_VOCALISTS).fill(null);
    state.shadows = [];
    var b = instById('inst_bass'); if (b) { b.assignedTo = 'Baz Player'; b.vocalistPlayer = null; }
    else { state.instruments.push({ id:'inst_bass', label:'Bass', tag:'Bass', assignedTo:'Baz Player', vocalistPlayer:null }); }
  `);
  ev(`openPostPullPopup({})`);

  check('vocalist step: "No mic" option removed; grouped Vocals setup shown', ()=>{
    const sel = doc.getElementById('pp_mic_select');
    if (!sel) throw new Error('no mic select on vocalist step');
    if (/__nomic__/.test(sel.innerHTML)) throw new Error('"No mic" option still present');
    const ed = doc.getElementById('pp_setup_editor');
    if (!ed) throw new Error('no setup editor on vocalist step');
    if (!ed.querySelector('input[value="v_stand"]')) throw new Error('vocals setup option (v_stand) not shown');
  });

  check('advancing to the band step shows grouped instrument setup with church default pre-checked', ()=>{
    // click Next (saves vocal step, advances)
    doc.getElementById('postPullNext').click();
    const tag = doc.querySelector('.pp-step-person-tag');
    if (!/Bass/i.test(tag ? tag.textContent : '')) throw new Error('did not advance to the bass step: '+(tag&&tag.textContent));
    const ed = doc.getElementById('pp_setup_editor');
    if (!ed) throw new Error('no setup editor on band step');
    const houseRadio = ed.querySelector('input[type=radio][value="b_house"]');
    if (!houseRadio) throw new Error('bass rig options not shown');
    if (!houseRadio.checked) throw new Error('church default (b_house) not pre-checked');
    // no free-text legacy list anymore
    if (doc.getElementById('pp_setup_list')) throw new Error('old free-text setup list still present');
  });

  check('the band setup persists to the person stable bucket', ()=>{
    const k = ev(`stableSetupKey('Baz Player','band','bass')`);
    if (!ev(`state.setupItems['${k}']`)) throw new Error('stable bucket not created');
    if (ev(`state.setupItems['${k}'].selections.rig`) !== 'b_house') throw new Error('church default not seeded into stable bucket');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
