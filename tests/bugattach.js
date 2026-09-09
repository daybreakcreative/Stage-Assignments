// Oversize screenshots must SHRINK at attach time, not bounce at the caps. Reported 2026-09-09
// (bug_94ec5a97): booth screenshots run 4-6MB, the KHARIS caps are 3MB/file and 5.5MB total, so a
// report could carry "1 maybe 2 images". The caps are deliberate (unauthenticated route, Express
// body limit) — the fix is to redraw oversize images smaller client-side so any screenshot fits
// and all four slots always fit together. Canvas work can't run under jsdom, so these checks stub
// shrinkImageForBugReport and assert the ROUTING: what gets shrunk, what doesn't, what is refused.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const until=(fn,ms=2000)=>new Promise((res,rej)=>{const t0=Date.now();(function poll(){
 try{if(fn())return res();}catch(_){}
 if(Date.now()-t0>ms)return rej(new Error('timed out waiting'));setTimeout(poll,25);})();});

window.addEventListener('load',()=>setTimeout(async ()=>{
 ev('window.__toasts=[]; toast=function(m){window.__toasts.push(String(m));};');

 check('shrinkImageForBugReport exists as a global function', ()=>{
   if(ev('typeof shrinkImageForBugReport')!=='function') throw new Error('not defined');
 });
 check('a per-file shrink target exists and 4 of it fit the total cap', ()=>{
   const t=ev('typeof BUG_ATTACH_TARGET_BYTES==="number" ? BUG_ATTACH_TARGET_BYTES : 0');
   if(!t) throw new Error('BUG_ATTACH_TARGET_BYTES missing');
   const total=ev('BUG_ATTACH_TOTAL_BYTES'), max=ev('BUG_MAX_ATTACHMENTS');
   if(t*max>total) throw new Error(`target ${t} x ${max} exceeds total cap ${total}`);
 });

 // Stub the canvas work with a distinctive tiny JPEG; the routing is what's under test.
 ev(`window.__shrinkCalls=0;
     shrinkImageForBugReport = async () => { window.__shrinkCalls++;
       return { dataUrl: 'data:image/jpeg;base64,' + 'B'.repeat(4000), type: 'image/jpeg' }; };`);

 ev('openBugReportModal()');
 const drop = doc.querySelector('#brf_drop');
 check('bug modal opens with a drop zone', ()=>{ if(!drop) throw new Error('#brf_drop missing'); });
 const dropFiles = files => {
   const de = new window.Event('drop', {bubbles:true, cancelable:true});
   de.dataTransfer = { files };
   drop.dispatchEvent(de);
 };
 const rows = () => Array.from(doc.querySelectorAll('#brf_list .brf-att'));
 const names = () => rows().map(r=>{const n=r.querySelector('.brf-att-name');return n?n.textContent:'';});

 console.log('--- an oversize screenshot is shrunk, a small one is left alone ---');
 dropFiles([new window.File(['x'.repeat(2_000_000)], 'booth-full.png', {type:'image/png'})]);
 await until(()=>rows().length===1).catch(e=>{errs.push('big attach never rendered');});
 check('a 2MB image goes through the shrinker exactly once', ()=>{
   if(window.__shrinkCalls!==1) throw new Error('shrink calls: '+window.__shrinkCalls);
 });
 check('the stored attachment IS the shrunk JPEG (thumb src + renamed .jpg)', ()=>{
   const img=rows()[0]&&rows()[0].querySelector('img.brf-thumb');
   if(!img||!/^data:image\/jpeg/.test(img.getAttribute('src')||'')) throw new Error('thumb is not the shrunk jpeg');
   if(names()[0]!=='booth-full.jpg') throw new Error('name: '+names()[0]);
 });
 dropFiles([new window.File(['x'.repeat(10_000)], 'tiny.png', {type:'image/png'})]);
 await until(()=>rows().length===2).catch(e=>{errs.push('small attach never rendered');});
 check('a small image is NOT shrunk and keeps its name', ()=>{
   if(window.__shrinkCalls!==1) throw new Error('shrink ran on a small file');
   if(names()[1]!=='tiny.png') throw new Error('name: '+names()[1]);
 });

 console.log('--- when shrinking cannot help, the caps still refuse with a reason ---');
 ev('shrinkImageForBugReport = async () => null;');
 dropFiles([new window.File(['x'.repeat(4_000_000)], 'huge.png', {type:'image/png'})]);
 await until(()=>ev('window.__toasts.length')>0).catch(e=>{errs.push('no refusal toast for a 4MB unshrinkable file');});
 check('an unshrinkable 4MB file is refused at attach time, by name, with sizes', ()=>{
   if(rows().length!==2) throw new Error('it was attached anyway ('+rows().length+' rows)');
   const t=ev('window.__toasts.join(" | ")');
   if(!/huge\.png/.test(t)||!/MB/i.test(t)) throw new Error('unhelpful toast: '+t);
 });

 console.log('--- the attachment count cap holds at attach time ---');
 ev('window.__toasts=[]; shrinkImageForBugReport = async () => null;');
 dropFiles([1,2,3].map(i=>new window.File(['x'.repeat(10_000)], 'more'+i+'.png', {type:'image/png'})));
 await until(()=>rows().length===4 && ev('window.__toasts.length')>0).catch(e=>{errs.push('count cap never fired');});
 check('the 5th attachment is refused and the toast says the max', ()=>{
   if(rows().length!==4) throw new Error(rows().length+' rows');
   const t=ev('window.__toasts.join(" | ")');
   if(!/4/.test(t)) throw new Error('toast does not name the max: '+t);
 });

 console.log('--- what is SENT is the shrunk file ---');
 ev(`window.__sent=null; window.fetch = async (u,o)=>{ window.__sent=JSON.parse(o.body);
     return { ok:true, status:200, json:async()=>({ok:true}) }; };`);
 doc.querySelector('#brf_desc').value='screens attached';
 doc.querySelector('#brf_send').click();
 await until(()=>ev('!!window.__sent')).catch(e=>{errs.push('report never sent');});
 check('the payload carries 4 attachments and the first is the shrunk JPEG', ()=>{
   const s=window.__sent; if(!s) throw new Error('nothing sent');
   if((s.attachments||[]).length!==4) throw new Error('attachments: '+(s.attachments||[]).length);
   if(!/^data:image\/jpeg/.test(s.attachments[0].dataUrl)) throw new Error('first attachment is not the shrunk jpeg');
   if(s.attachments[0].name!=='booth-full.jpg') throw new Error('name: '+s.attachments[0].name);
 });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   if(errs.length) console.log(errs.join('\n'));
   process.exit(errs.length?1:0);
 },20);
},150));
