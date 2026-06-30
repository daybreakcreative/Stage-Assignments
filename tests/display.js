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
 ev('state.viewMode="setup"; state.config.tvMode=false; document.body.classList.remove("tv-mode")');

 check('TV/Projector radio now applies live (sets config + body.tv-mode)', ()=>{
   ev('renderLayoutEditor()');
   const tv=doc.querySelector('#layoutEdit input[data-cfg-tvmode="true"]');
   if(!tv) throw new Error('TV radio not rendered');
   tv.checked=true; fire(tv,'change');
   if(ev('state.config.tvMode')!==true) throw new Error('tvMode not set true');
   if(!doc.body.classList.contains('tv-mode')) throw new Error('body.tv-mode not added');
 });
 check('Computer/Tablet radio turns it back off', ()=>{
   const pc=doc.querySelector('#layoutEdit input[data-cfg-tvmode="false"]');
   pc.checked=true; fire(pc,'change');
   if(ev('state.config.tvMode')!==false) throw new Error('tvMode not set false');
   if(doc.body.classList.contains('tv-mode')) throw new Error('body.tv-mode not removed');
 });
 check('TV mode CSS uses COMPACT sizing (voc-name 14px < default 20px) for a screen viewed up close', ()=>{
   const m=html.match(/body\.tv-mode \.dv-voc-name\{font-size:(\d+)px\}/);
   if(!m) throw new Error('tv-mode .dv-voc-name rule missing');
   if(parseInt(m[1],10) >= 20) throw new Error('tv-mode name should be smaller than default 20px, got '+m[1]+'px');
 });
 check('fullscreen button is present in the display chrome', ()=>{
   if(!doc.getElementById('dvFullscreenBtn')) throw new Error('no #dvFullscreenBtn');
 });
 check('help hint explains TV mode', ()=>{
   ev('renderLayoutEditor()');
   if(!/compact text|up close/i.test(doc.getElementById('layoutEdit').textContent)) throw new Error('no TV-mode help text');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
