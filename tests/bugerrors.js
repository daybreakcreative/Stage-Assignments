// A rejected bug report must say WHY. Reported 2026-09-02: two large screenshots were rejected by
// KHARIS (attachments exceed 3MB each / 5.5MB total), the server returned a helpful message, and
// sendBugReport collapsed it — along with 429, 403 and a genuine network failure — into one
// "Couldn't reach KHARIS — try again", which tells you to retry something that can never succeed.
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
const done=r=>{};

window.addEventListener('load',()=>setTimeout(async ()=>{
 ev('toast=function(){};');

 // Stub fetch per-case.
 const stubFetch = (impl) => { window.fetch = impl; };
 const call = async (desc, atts) => {
   window.__r = null;
   await ev(`(async()=>{ window.__r = await sendBugReport(${JSON.stringify({desc, attachments: atts||[]})}); })()`);
   return window.__r;
 };
 const dataUrl = (bytes) => 'data:image/png;base64,' + 'A'.repeat(Math.ceil(bytes*4/3));

 console.log('--- the server\'s reason survives ---');

 stubFetch(async()=>({ ok:false, status:413, json:async()=>({ok:false,error:'Attachments are too large (max 5.5 MB total).'}) }));
 let r = await call('too big', [{dataUrl:dataUrl(10), name:'a.png', type:'image/png'}]);
 check('a 413 returns the server\'s own message, not a generic one', ()=>{
   if(!r || r.ok!==false) throw new Error('expected failure');
   if(!/too large/i.test(r.error||'')) throw new Error('lost the reason: '+JSON.stringify(r));
 });

 stubFetch(async()=>({ ok:false, status:429, json:async()=>({ok:false,error:'Too many reports from here — try again shortly.'}) }));
 r = await call('rate limited');
 check('a 429 surfaces the rate-limit message', ()=>{
   if(!/too many/i.test(r.error||'')) throw new Error('lost the reason: '+JSON.stringify(r));
 });

 stubFetch(async()=>({ ok:false, status:403, json:async()=>({ok:false,error:'forbidden'}) }));
 r = await call('forbidden');
 check('a 403 is reported as a refusal, not a network problem', ()=>{
   if(r.ok!==false) throw new Error('expected failure');
   if(/reach/i.test(r.error||'')) throw new Error('should not claim unreachable: '+r.error);
 });

 console.log('--- a genuine outage still reads as one ---');
 stubFetch(async()=>{ throw new TypeError('Failed to fetch'); });
 r = await call('offline');
 check('a network failure says KHARIS is unreachable', ()=>{
   if(r.ok!==false) throw new Error('expected failure');
   if(!/reach/i.test(r.error||'')) throw new Error('expected an unreachable message, got: '+r.error);
 });

 console.log('--- oversize is caught BEFORE the upload ---');
 stubFetch(async()=>{ throw new Error('fetch should not have been called'); });
 r = await call('huge', [{dataUrl:dataUrl(4_000_000), name:'big.png', type:'image/png'}]);
 check('an over-cap attachment is refused locally, without a round trip', ()=>{
   if(r.ok!==false) throw new Error('expected failure');
   if(!/too large|3 ?MB|large/i.test(r.error||'')) throw new Error('unhelpful: '+JSON.stringify(r));
 });
 r = await call('huge total', [
   {dataUrl:dataUrl(2_900_000), name:'a.png', type:'image/png'},
   {dataUrl:dataUrl(2_900_000), name:'b.png', type:'image/png'}]);
 check('two attachments over the TOTAL cap are refused locally', ()=>{
   if(r.ok!==false) throw new Error('expected failure');
   if(!/total|too large/i.test(r.error||'')) throw new Error('unhelpful: '+JSON.stringify(r));
 });

 console.log('--- the happy path still works ---');
 stubFetch(async()=>({ ok:true, status:200, json:async()=>({ok:true,attachments:1}) }));
 r = await call('fine', [{dataUrl:dataUrl(1000), name:'a.png', type:'image/png'}]);
 check('a normal report still succeeds', ()=>{ if(!r||r.ok!==true) throw new Error(JSON.stringify(r)); });

 check('a success needs no error text', ()=>{ if(r.error) throw new Error('unexpected error on success: '+r.error); });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   if(errs.length) console.log(errs.join('\n'));
   process.exit(errs.length?1:0);
 },20);
},150));
