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

  console.log('--- resolveSetupItems / church defaults ---');
  check('resolve turns selections into ordered lines incl addItems + customs', ()=>{
    const sel = JSON.stringify({ rig:'eg_stereo', stand:'eg_single', extras:['eg_10'] });
    const lines = ev(`resolveSetupItems('eg', ${sel}, [{text:'Custom pedalboard power'}]).map(i=>i.text)`);
    if (!lines.includes('Stereo guitar rig')) throw new Error('missing rig label: '+lines.join('|'));
    if (!lines.includes('Stereo DI box') || !lines.includes('2 XLRs for player EG rig')) throw new Error('missing addItems');
    if (!lines.includes('Single guitar stand')) throw new Error('missing stand');
    if (lines[lines.length-1] !== 'Custom pedalboard power') throw new Error('custom not last');
  });
  check('empty selections resolve to just customs', ()=>{
    const lines = ev(`resolveSetupItems('bass', {}, [{text:'X'}]).map(i=>i.text).join(",")`);
    if (lines !== 'X') throw new Error('got: '+lines);
  });
  check('churchSetupDefaults reads state.config.setupDefaults', ()=>{
    ev(`state.config.setupDefaults = { bass:{ selections:{ rig:'b_house', extras:['b_di'] }, customOptions:[] } };`);
    const d = ev(`JSON.stringify(churchSetupDefaults('bass').selections)`);
    if (!/b_house/.test(d)) throw new Error('defaults not read: '+d);
    ev(`state.config.setupDefaults = null;`);
    const empty = ev(`JSON.stringify(churchSetupDefaults('bass'))`);
    if (empty !== '{"selections":{},"customOptions":[]}') throw new Error('empty default wrong: '+empty);
  });
  check('defaultSelectionsFor returns a deep clone', ()=>{
    ev(`state.config.setupDefaults = { keys:{ selections:{ source:'k_house' }, customOptions:[] } };`);
    const a = ev(`(function(){ var s=defaultSelectionsFor('keys'); s.source='MUT'; return state.config.setupDefaults.keys.selections.source; })()`);
    if (a !== 'k_house') throw new Error('not a clone — mutation leaked: '+a);
    ev(`state.config.setupDefaults=null;`);
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
