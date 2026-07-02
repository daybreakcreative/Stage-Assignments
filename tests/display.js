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
const fire=(el,t)=>el.dispatchEvent(new window.Event(t,{bubbles:true}));
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');
 ev('state.viewMode="setup"');

 // TV/Computer mode was replaced by per-section hover font-scalers (see dvscalers.js).
 // These checks are now the removal regression guards.
 check('Settings Display editor has NO TV/Computer radio anymore', ()=>{
   ev('renderLayoutEditor()');
   if(doc.querySelector('#layoutEdit input[data-cfg-tvmode]')) throw new Error('tvMode radio still rendered');
   if(doc.querySelector('#layoutEdit input[name="tvMode"]')) throw new Error('tvMode radio still rendered');
 });
 check('body never gets a tv-mode class in the display view', ()=>{
   ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup"');
   if(doc.body.classList.contains('tv-mode')) throw new Error('body.tv-mode present');
 });
 check('no body.tv-mode CSS rule remains', ()=>{
   if(/body\.tv-mode\b/.test(html)) throw new Error('body.tv-mode CSS rule still present');
 });
 check('fullscreen button is present in the display chrome', ()=>{
   if(!doc.getElementById('dvFullscreenBtn')) throw new Error('no #dvFullscreenBtn');
 });
 check('Settings Display help now points to per-section hover scalers', ()=>{
   ev('renderLayoutEditor()');
   if(!/hover|section|resize/i.test(doc.getElementById('layoutEdit').textContent)) throw new Error('no per-section scaler help text');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
