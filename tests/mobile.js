const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;
const css=Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('\n');
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 check('shell is a flex column filling the viewport (dvh)', ()=>{
   if(!/flex-direction:column/.test(css)) throw new Error('body not flex-column');
   if(!/height:100dvh/.test(css)) throw new Error('no dvh height');
 });
 check('workspace fills remaining height via flex (no fixed 100vh-54px)', ()=>{
   if(!/\.workspace\{flex:1 1 auto;min-height:0/.test(css)) throw new Error('workspace not flex:1');
   if(/\.workspace\{height:calc\(100vh - 54px\)/.test(css)) throw new Error('old fixed height still present');
 });
 check('the narrow breakpoint wraps the top bar', ()=>{
   // Asserted by PROPERTY, not by declaration ORDER — the original regex pinned the exact order and
   // broke the moment flex-shrink:0 was inserted, for a change that was entirely correct.
   if(!/@media \(max-width:1024px\)/.test(css)) throw new Error('no 1024 breakpoint');
   const m = css.match(/@media \(max-width:1439px\)\{[\s\S]*?\n\}/);
   if(!m) throw new Error('no 1439 reflow block');
   const block = m[0];
   [['height:auto','topbar must be free to grow'],
    ['flex-wrap:wrap','topbar must wrap'],
    ['flex-shrink:0','topbar must not be compressed by the body flex column']].forEach(([prop,why])=>{
     if(block.indexOf(prop)===-1) throw new Error(why+' ('+prop+' missing)');
   });
   if(!/\.actions\{flex:1 1 100%;flex-wrap:wrap/.test(block)) throw new Error('actions not wrapping');
 });

 // The bug this guards: the topbar is a grid whose eight buttons measure 819px, giving the bar a
 // natural width of ~1426px at ANY viewport, and body is overflow-x:hidden. With the reflow starting
 // at 1024 the band from 1025 to 1426 clipped silently — "✓ Items" lost its edge and "▶ Display",
 // the primary action, was entirely off-screen and unreachable on a 1366x768 laptop.
 check('the reflow starts above the bar\'s natural width, not at 1024', ()=>{
   const m = css.match(/@media \(max-width:(\d+)px\)\{\s*(?:\/\*[\s\S]*?\*\/\s*)?\.topbar\{height:auto/);
   if(!m) throw new Error('could not find the topbar reflow breakpoint');
   const bp = parseInt(m[1],10);
   if(bp < 1426) throw new Error('reflow starts at '+bp+'px, below the bar\'s natural 1426px — 1025..1426 will clip');
 });

 // flex-shrink:0 belongs on the BASE rule too: body is display:flex;flex-direction:column, so
 // without it the bar is compressed rather than grown and its wrapped row paints over the workspace.
 check('the base topbar rule is not compressible', ()=>{
   const m = css.match(/\n\.topbar\{[^}]*\}/);
   if(!m) throw new Error('no base .topbar rule');
   if(m[0].indexOf('flex-shrink:0')===-1)
     throw new Error('base .topbar lacks flex-shrink:0 — the body flex column will squash it');
 });
 check('mobile overrides the inline 240px title min-width', ()=>{
   if(!/#serviceName\{min-width:0 !important/.test(css)) throw new Error('serviceName min-width not overridden');
 });
 check('top-bar markup unchanged (brand, venue-switch, service-meta, actions, title)', ()=>{
   // NOTE: #assignBtn (top-bar Auto-Assign) was intentionally removed; the ⌘↵ shortcut still calls autoAssign().
   ['.topbar .brand','.topbar .venue-switch','.topbar .service-meta','.topbar .actions','#serviceName']
     .forEach(sel=>{ if(!document.querySelector(sel)) throw new Error('missing '+sel); });
   if(document.getElementById('assignBtn')) throw new Error('#assignBtn should have been removed');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
