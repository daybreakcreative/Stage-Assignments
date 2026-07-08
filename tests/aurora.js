// Rewritten 2026-07-08: the 11 color moods were replaced by 6 named "worlds" (see worlds.js).
// This file (kept under its historical name so the runner + WATCHLIST references hold) now
// asserts the world token axis: setWorld applies [data-world] on <html>, the dark/light axis
// stays independent, and applyBrand is inert (worlds own the accent; no --accent inline clobber).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 check('default world molten applied to <html>', () => {
   ev("setWorld('molten')");
   if (doc.documentElement.getAttribute('data-world')!=='molten') throw new Error('data-world not set');
   if (doc.documentElement.getAttribute('data-look')) throw new Error('legacy data-look present');
 });
 check('dark/light axis is independent of world', () => {
   ev("setTheme('light')");
   if (doc.documentElement.getAttribute('data-theme')!=='light') throw new Error('theme not light');
   if (doc.documentElement.getAttribute('data-world')!=='molten') throw new Error('world changed with theme');
   ev("setTheme('dark')");
 });
 check('applyBrand is a no-op under a world (no --accent inline clobber)', () => {
   ev("state.brand={accent:'#d4a147'}; if(typeof applyBrand==='function') applyBrand();");
   if (ev("document.documentElement.style.getPropertyValue('--accent')")) throw new Error('applyBrand must not set --accent');
   ev("state.brand={}");
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n')); process.exitCode=errs.length?1:0;
},150));
