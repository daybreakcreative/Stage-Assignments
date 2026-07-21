// #2 — Report-a-bug form: opens a modal (description + drag-drop attachments), and on send
// downloads the config + attachments and opens a PRE-FILLED GitHub issue in the repo (no token/backend).
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

 function mkFile(name, type, text){ return new window.File([text||'x'], name, {type:type||'application/octet-stream'}); }
 function fireDrop(zone, files){
   const ev2 = new window.Event('drop', {bubbles:true, cancelable:true});
   Object.defineProperty(ev2, 'dataTransfer', { value: { files } });
   zone.dispatchEvent(ev2);
 }
 const wait = ms => new Promise(r=>setTimeout(r, ms));

 check('modal shows a clickable drop zone + hidden multi-file input; old single input gone', ()=>{
   ev('openBugReportModal();');
   if(!doc.getElementById('brf_drop')) throw new Error('drop zone #brf_drop missing');
   const inp=doc.getElementById('brf_files');
   if(!inp || !inp.multiple) throw new Error('#brf_files should be a multiple file input');
   if(doc.getElementById('brf_shot')) throw new Error('old single #brf_shot input should be gone');
   if(!/Submit/i.test(doc.getElementById('brf_send').textContent)) throw new Error('send button should read Submit');
 });

 check('send with an EMPTY description does not open an issue', ()=>{
   ev('window.__opened=null');
   doc.querySelector('.setup-review-modal.show #brf_send').click();
   if(ev('window.__opened')) throw new Error('opened an issue with no description');
 });

 await check('dropping two files lists two removable rows; removing one leaves one', async ()=>{
   ev('openBugReportModal();');
   fireDrop(doc.getElementById('brf_drop'), [mkFile('a.png','image/png'), mkFile('log.txt','text/plain')]);
   await wait(60);
   let rows=doc.querySelectorAll('#brf_list [data-att-idx]');
   if(rows.length!==2) throw new Error('expected 2 attachment rows, got '+rows.length);
   rows[0].querySelector('[data-att-remove]').dispatchEvent(new window.Event('click',{bubbles:true}));
   rows=doc.querySelectorAll('#brf_list [data-att-idx]');
   if(rows.length!==1) throw new Error('expected 1 row after remove, got '+rows.length);
 });

 await check('Submit POSTs attachments[] + sanitized config to the intake URL', async ()=>{
   ev(`state.pcoConfig=state.pcoConfig||{}; state.pcoConfig.clientId='CID'; state.pcoConfig.clientSecret='SECRET';`);
   let captured=null;
   window.fetch=(url,opts)=>{ captured={url,opts}; return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve({ok:true})}); };
   ev('openBugReportModal();');
   fireDrop(doc.getElementById('brf_drop'), [mkFile('a.png','image/png'), mkFile('b.log','text/plain')]);
   await wait(60);
   doc.getElementById('brf_desc').value='multi attach test';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await wait(60);
   if(!captured) throw new Error('fetch not called');
   if(!/\/bug$/.test(captured.url)) throw new Error('should POST to /bug, got '+captured.url);
   const body=JSON.parse(captured.opts.body);
   if(!Array.isArray(body.attachments)||body.attachments.length!==2) throw new Error('attachments should be an array of 2, got '+JSON.stringify(body.attachments&&body.attachments.length));
   if(!body.attachments[0].dataUrl||!body.attachments[0].name) throw new Error('attachment missing dataUrl/name');
   if(typeof body.config!=='string'||/SECRET|CID/.test(body.config)) throw new Error('config must be sanitized string');
 });

 await check('on fetch failure it falls back to download + GitHub issue', async ()=>{
   let opened=null; window.open=(u)=>{opened=u;return{};};
   ev('downloadBlob=function(){window.__dl=(window.__dl||0)+1;};');
   window.fetch=()=>Promise.reject(new Error('network'));
   ev('openBugReportModal(); window.__dl=0;');
   fireDrop(doc.getElementById('brf_drop'), [mkFile('a.png','image/png')]);
   await wait(60);
   doc.getElementById('brf_desc').value='fallback test';
   doc.getElementById('brf_send').dispatchEvent(new window.Event('click',{bubbles:true}));
   await wait(60);
   if(!opened||!/github\.com\/daybreakcreative\/Stage-Assignments\/issues\/new/.test(opened)) throw new Error('fallback should open GitHub URL');
   if((window.__dl||0) < 2) throw new Error('fallback should download config + attachment (>=2 downloadBlob calls), got '+(window.__dl||0));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
});
