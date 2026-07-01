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
window.addEventListener('load', ()=>setTimeout(()=>{

  console.log('--- Keys auto-places to far stage right ---');
  check('Keys gets the far-right (max x) default slot regardless of list order', ()=>{
    ev(`state.config.customStageEnabled=false;
        state.instruments=[
          {id:'i_keys', label:'Keys', tag:'Keys', assignedTo:'K'},
          {id:'i_drums',label:'Drums', tag:'Drums', assignedTo:'D'},
          {id:'i_bass', label:'Bass', tag:'Bass', assignedTo:'B'},
          {id:'i_eg',   label:'Electric', tag:'EG', assignedTo:'E'}
        ];`);
    const pos = ev('JSON.stringify(getBandStagePositions())');
    const p = JSON.parse(pos);
    const keysX = p['i_keys'].x;
    const others = ['i_drums','i_bass','i_eg'].map(id => p[id].x);
    if (others.some(x => x >= keysX)) throw new Error('Keys not the furthest right: keys='+keysX+' others='+JSON.stringify(others));
    if (keysX < 700) throw new Error('Keys not near the right edge (expected ~710): '+keysX);
  });
  check('a hand-placed Keys position is still respected (auto-right only when no custom)', ()=>{
    ev(`state.config.customStageEnabled=true; state.config.customStagePositions={ i_keys:{x:120,y:200} };`);
    const p = JSON.parse(ev('JSON.stringify(getBandStagePositions())'));
    if (p['i_keys'].x !== 120) throw new Error('custom Keys position overridden: '+p['i_keys'].x);
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
