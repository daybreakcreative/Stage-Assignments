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
function check(l,f){try{const p=f();if(p&&typeof p.then==='function'){return p.then(()=>console.log('  OK  ',l)).catch(e=>{console.log('  FAIL',l,'->',e.message);errs.push(l);});}console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',async ()=>{await new Promise(r=>setTimeout(r,150));
 ev('downloadBlob=function(){};');
 ev('toast=function(){};');
 ev('window.__opened=null; window.open=function(u){window.__opened=u; return {};};');

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

 await check('submitting POSTs sanitized JSON to the KHARIS intake URL', async ()=>{
   ev(`state.pcoConfig=state.pcoConfig||{}; state.pcoConfig.clientId='CID'; state.pcoConfig.clientSecret='SECRET';`);
   let captured=null;
   window.fetch=(url,opts)=>{ captured={url,opts}; return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})}); };
   ev('openBugReportModal();');
   doc.getElementById('brf_desc').value='display went blank';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await new Promise(r=>setTimeout(r,30));
   if(!captured) throw new Error('fetch was not called');
   if(!/\/bug$/.test(captured.url)) throw new Error('should POST to the /bug intake URL, got '+captured.url);
   const body=JSON.parse(captured.opts.body);
   if(body.description!=='display went blank') throw new Error('description not sent');
   if(typeof body.config!=='string') throw new Error('config should be a JSON string');
   if(/SECRET|CID/.test(body.config)) throw new Error('PCO secrets must be stripped from config');
 });

 await check('on fetch failure it falls back to the download + GitHub issue flow', async ()=>{
   let opened=null; window.open=(u)=>{ opened=u; return {}; };
   window.fetch=()=>Promise.reject(new Error('network'));
   ev('openBugReportModal();');
   doc.getElementById('brf_desc').value='still broken';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await new Promise(r=>setTimeout(r,30));
   if(!opened||!/github\.com\/daybreakcreative\/Stage-Assignments\/issues\/new/.test(opened)) throw new Error('fallback should open the GitHub issue URL, got '+opened);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
});
