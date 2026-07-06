// Quick-wins batch: #6 band IEM column label, #5 display fullscreen consolidation,
// #1 Submit-beta-test button in the Data tab.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const doc=document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('#6: Band section labels the IEM Pack column', ()=>{
   const hint=doc.querySelector('#dvBandBlock .dv-col-hint');
   if(!hint) throw new Error('no .dv-col-hint in band block');
   if(!/IEM Pack/i.test(hint.textContent)) throw new Error('hint text not "IEM Pack": '+hint.textContent);
 });

 check('#5: redundant fullscreen cog removed; Exit button remains', ()=>{
   if(doc.getElementById('dvFullscreenBtn')) throw new Error('dvFullscreenBtn should be removed');
   if(!doc.getElementById('displayBackBtn')) throw new Error('Exit button (displayBackBtn) missing');
 });

 check('#5: enter/exit display mode run without error (fullscreen guarded in jsdom)', ()=>{
   ev('renderDisplayView=function(){}; applyDvDividers=function(){}; renderAll=function(){}; saveState=function(){};');
   ev('enterDisplayMode()');
   if(!document.body.classList.contains('display-mode')) throw new Error('did not enter display mode');
   ev('exitDisplayMode()');
   if(document.body.classList.contains('display-mode')) throw new Error('did not exit display mode');
 });

 check('#1: Data tab renders a Submit-beta-test button', ()=>{
   ev('renderDataEditor()');
   const b=doc.getElementById('betaSubmitBtn');
   if(!b) throw new Error('no #betaSubmitBtn in Data tab');
   if(!/beta/i.test(b.textContent)) throw new Error('button text unexpected: '+b.textContent);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
