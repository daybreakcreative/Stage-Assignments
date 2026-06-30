const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');
 check('checklist nav button is now "✓ Items" (id preserved)', ()=>{
   const b=doc.getElementById('setupItemsBtn'); if(!b) throw new Error('setupItemsBtn missing');
   if(!/✓\s*Items/.test(b.textContent)) throw new Error('text: '+JSON.stringify(b.textContent));
 });
 check('settings tabs relabeled (Display / Setup Items) with data-tab keys unchanged', ()=>{
   const l=doc.querySelector('.tab[data-tab="layout"]'), s=doc.querySelector('.tab[data-tab="setups"]');
   if(!l||!/Display/.test(l.textContent)) throw new Error('layout tab not "Display"');
   if(!s||!/Setup Items/.test(s.textContent)) throw new Error('setups tab not "Setup Items"');
 });
 check('navigation by key still activates the right tab+panel after rename', ()=>{
   ev('openSettings("layout")');
   if(!doc.querySelector('.tab[data-tab="layout"]').classList.contains('active')) throw new Error('Display tab not active');
   if(!doc.getElementById('tab-layout').classList.contains('active')) throw new Error('tab-layout panel not active');
   ev('openSettings("setups")');
   if(!doc.getElementById('tab-setups').classList.contains('active')) throw new Error('tab-setups panel not active');
 });
 check('display scale tabs are visible without hover (touch-friendly, opacity>0)', ()=>{
   const m=html.match(/\.dv-hover-tab\{[^}]*opacity:([0-9.]+)\}/);
   if(!m) throw new Error('.dv-hover-tab rule missing');
   if(parseFloat(m[1])<=0) throw new Error('still hidden: opacity '+m[1]);
 });
 check('no stale "Set Up → " navigation hints, and "Set Up" no longer used as a label', ()=>{
   if(/Set Up → /.test(html)) throw new Error('stale "Set Up → " path remains');
   // The only allowed "Set Up" would be none now; button is "✓ Items"
   const stray=(html.match(/>Set Up</g)||[]).length;
   if(stray>0) throw new Error(stray+' stray ">Set Up<" label(s) remain');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
