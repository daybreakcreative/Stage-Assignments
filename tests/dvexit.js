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
    window.Element.prototype.requestFullscreen=function(){return Promise.resolve();};
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{

  console.log('--- display: clear exit + hover-hidden scalers ---');
  check('exit control is clearly labeled "Exit" (not just a gear icon)', ()=>{
    const b = doc.getElementById('displayBackBtn');
    if (!b) throw new Error('no #displayBackBtn');
    if (!/Exit/i.test(b.textContent)) throw new Error('exit button not labeled Exit: "'+b.textContent+'"');
  });
  check('scaler hover-tabs are hidden (opacity:0) until section hover', ()=>{
    if (!/\.dv-hover-tab\{[^}]*opacity:0(?:[;}])/.test(html)) throw new Error('.dv-hover-tab default opacity is not 0');
    if (!/:hover .dv-hover-tab\{[^}]*opacity/.test(html)) throw new Error('no section:hover reveal rule for .dv-hover-tab');
  });
  check('pressing Escape exits display mode', ()=>{
    ev("state.viewMode = 'display';");
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    if (ev("state.viewMode") === 'display') throw new Error('Escape did not exit display mode');
  });
  check('clicking the Exit button exits display mode', ()=>{
    ev("state.viewMode = 'display';");
    doc.getElementById('displayBackBtn').click();
    if (ev("state.viewMode") === 'display') throw new Error('Exit button did not exit display mode');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
