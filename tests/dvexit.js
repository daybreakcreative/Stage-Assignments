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
  check('hidden scaler tabs are click-through (pointer-events:none) so they cannot eat cog clicks', ()=>{
    if (!/\.dv-hover-tab\{[^}]*opacity:0;pointer-events:none\}/.test(html.replace(/\s+/g,''))) throw new Error('.dv-hover-tab default is not pointer-events:none while hidden');
  });
  check('display cogs sit above the scaler tabs (z-index)', ()=>{
    const cog = html.match(/\.display-cog\{[^}]*z-index:(\d+)/); if(!cog) throw new Error('no cog z-index');
    const railTab = html.match(/\.dv-rail-header .dv-hover-tab\{[^}]*z-index:(\d+)/);
    const railZ = railTab ? parseInt(railTab[1],10) : 15;
    if (parseInt(cog[1],10) <= railZ) throw new Error('cog z-index ('+cog[1]+') not above scaler tab z-index ('+railZ+')');
  });
  check('Exit/fullscreen cogs sit ABOVE the setup lock screen (so Exit always works)', ()=>{
    const cog = parseInt(html.match(/\.display-cog\{[^}]*z-index:(\d+)/)[1],10);
    const lock = html.match(/#setupLockScreen\s*\{[^}]*z-index:\s*(\d+)/);
    const lockZ = lock ? parseInt(lock[1],10) : 100;
    if (cog <= lockZ) throw new Error('cog z-index ('+cog+') not above lock screen z-index ('+lockZ+') — lock screen would eat Exit clicks');
  });
  check('display view does NOT highlight worship leaders on the vocal cards', ()=>{
    // A WL vocalist rendered in display mode must not get the is-wl accent/badge.
    // Pin to a non-bespoke world (corporate) so this exercises the DEFAULT #dvVocGrid cards;
    // the bespoke worlds (concrete=default, molten) have their own displays (equal lineup, no
    // .dv-voc-card); corporate/terra/orbit fall back to this default skeleton.
    ev("state.vocalists=[{id:'v1',name:'Grace',isWL:true}]; state.assignments=['v1'];");
    ev("state.world='corporate'; applyWorld();");
    ev("state.viewMode='display'; renderDisplayView();");
    const wl = doc.querySelectorAll('#dvVocGrid .dv-voc-card.is-wl');
    if (wl.length) throw new Error(wl.length+' WL-highlighted vocal card(s) in display view');
    const cards = doc.querySelectorAll('#dvVocGrid .dv-voc-card');
    if (!cards.length) throw new Error('no vocal cards rendered — test setup failed');
  });
  check('a build stamp is present so the booth can confirm it is on the latest deploy', ()=>{
    const el = doc.getElementById('buildStamp');
    if (!el) throw new Error('no #buildStamp element');
    if (!/build\s+\d{4}-\d{2}-\d{2}/.test(el.textContent)) throw new Error('build stamp has no dated tag: "'+el.textContent+'"');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
