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

  console.log('--- print: summary prints (class matches CSS) ---');
  // Isolate the @media print block from the source.
  const m = html.match(/@media print\{[\s\S]*?\n\}/);
  const printCss = m ? m[0] : '';

  check('print CSS targets the summary via .show (the class actually applied), not the dead .open', ()=>{
    if (!printCss) throw new Error('no @media print block found');
    if (!/\.summary-overlay\.show/.test(printCss)) throw new Error('print CSS does not show .summary-overlay.show');
    if (/:not\(\.open\)/.test(printCss) || /\.summary-overlay\.open/.test(printCss)) throw new Error('stale .open rule still present');
  });
  check('print CSS no longer references the non-existent #editView', ()=>{
    if (/#editView/.test(printCss)) throw new Error('#editView (no such element) still referenced in print CSS');
    if (doc.getElementById('editView')) throw new Error('there is now an #editView element — update this test');
  });
  check('showSummary() applies the .show class the print CSS keys off', ()=>{
    ev('showSummary()');
    const ov = doc.getElementById('summaryOverlay');
    if (!ov.classList.contains('show')) throw new Error('summary overlay not shown with .show');
  });
  check('the summary overlay is a direct <body> child (so body>* print hide/show works)', ()=>{
    const ov = doc.getElementById('summaryOverlay');
    if (!ov || ov.parentElement !== doc.body) throw new Error('summaryOverlay is not a direct body child');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
