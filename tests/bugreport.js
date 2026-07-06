// #2 — Report-a-bug form: opens a modal (description + screenshot), and on send downloads the
// config and opens a PRE-FILLED GitHub issue in the repo (no token/backend).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){}; // don't navigate on download
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){}; window.__opened=null; window.open=function(u){window.__opened=u; return {};};');

 check('modal renders a description field, screenshot input, and send button', ()=>{
   ev('openBugReportModal()');
   const m=doc.querySelector('.setup-review-modal.show');
   if(!m) throw new Error('no modal opened');
   if(!m.querySelector('#brf_desc')) throw new Error('no description field');
   if(!m.querySelector('#brf_shot')) throw new Error('no screenshot input');
   if(!m.querySelector('#brf_send')) throw new Error('no send button');
 });

 check('send with an EMPTY description does not open an issue', ()=>{
   ev('window.__opened=null');
   doc.querySelector('.setup-review-modal.show #brf_send').click();
   if(ev('window.__opened')) throw new Error('opened an issue with no description');
 });

 check('send with a description opens a prefilled GitHub issue in the repo', ()=>{
   ev('window.__opened=null');
   const m=doc.querySelector('.setup-review-modal.show');
   m.querySelector('#brf_desc').value='Band IEM column blank after pull';
   m.querySelector('#brf_send').click();
   const u=ev('window.__opened');
   if(!u) throw new Error('no issue opened');
   if(!/github\.com\/daybreakcreative\/Stage-Assignments\/issues\/new/.test(u)) throw new Error('not the repo issue URL: '+u);
   if(!/Band%20IEM%20column%20blank/.test(u)) throw new Error('description not carried into the issue: '+u);
 });

 check('the issue body includes the build stamp + a label', ()=>{
   const u=ev(`sendBugReport({desc:'x', shotDataUrl:'', shotName:''})`);
   const dec=decodeURIComponent(u);
   if(!/labels=bug/.test(u)) throw new Error('no bug label');
   if(!/Build/.test(dec)) throw new Error('no build stamp in body');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
