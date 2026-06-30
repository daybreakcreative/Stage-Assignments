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
 check('mobile breakpoint wraps the top bar', ()=>{
   if(!/@media \(max-width:1024px\)/.test(css)) throw new Error('no 1024 breakpoint');
   if(!/\.topbar\{height:auto;min-height:54px;display:flex;flex-wrap:wrap/.test(css)) throw new Error('topbar not set to wrap on mobile');
   if(!/\.actions\{flex:1 1 100%;flex-wrap:wrap/.test(css)) throw new Error('actions not wrapping on mobile');
 });
 check('mobile overrides the inline 240px title min-width', ()=>{
   if(!/#serviceName\{min-width:0 !important/.test(css)) throw new Error('serviceName min-width not overridden');
 });
 check('top-bar markup unchanged (brand, venue-switch, service-meta, actions, title)', ()=>{
   ['.topbar .brand','.topbar .venue-switch','.topbar .service-meta','.topbar .actions','#serviceName','#assignBtn']
     .forEach(sel=>{ if(!document.querySelector(sel)) throw new Error('missing '+sel); });
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
