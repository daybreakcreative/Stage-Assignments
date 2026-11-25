// 2026-11-25 — five fixes shipped today and none of them reaches a room until someone reloads the
// tab: the app is one static page, and a booth machine left open for weeks keeps running the build
// it loaded (on 09-30 the booth was still on 09-15). The page now asks the server, quietly, whether
// a newer build is live (HEAD + Last-Modified against its own document.lastModified) and shows a
// small "newer version — Reload" pill in the set-up view. It never reloads by itself, never shows
// on the TV (display mode) and stays silent when the check cannot be made.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/index.html',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.fetch=async()=>{ throw new Error('offline'); };   // boot-time check must survive this
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
async function check(l,f){try{await f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(async()=>{
 const MINE=Date.UTC(2026,10,25,19,0,0);
 const serve=lm=>{ window.__calls=[]; window.fetch=async(u,o)=>{ window.__calls.push({u:String(u),o}); return {ok:true,headers:{get:h=>/last-modified/i.test(h)?lm:null}}; }; };
 ev(`loadedBuildTime=function(){return ${MINE};}`);
 const pill=()=>doc.getElementById('updateNotice');
 const shown=()=>{ const p=pill(); return !!p && p.style.display!=='none'; };

 await check('the pill exists and starts hidden', async()=>{ if(!pill()) throw new Error('no #updateNotice'); if(shown()) throw new Error('visible at boot'); });
 await check('server has the SAME build → stays hidden', async()=>{
   serve(new Date(MINE).toUTCString()); const r=await ev('checkForNewBuild()'); if(r!==false||shown()) throw new Error('r='+r+' shown='+shown());
 });
 await check('server has a NEWER build → the pill shows, with a Reload button', async()=>{
   serve(new Date(MINE+3600e3).toUTCString()); const r=await ev('checkForNewBuild()');
   if(r!==true||!shown()) throw new Error('r='+r+' shown='+shown());
   if(!pill().querySelector('button')||!/reload/i.test(pill().textContent)) throw new Error(pill().textContent);
 });
 await check('the check asks the server fresh: HEAD, no-store, a cache-busting query', async()=>{
   const c=window.__calls[0]; if(!c||c.o.method!=='HEAD'||c.o.cache!=='no-store'||!/\?/.test(c.u)) throw new Error(JSON.stringify(c));
 });
 await check('Reload reloads — and nothing else ever does', async()=>{
   ev(`window.__reloads=0; reloadForUpdate=function(){ window.__reloads++; };`);
   await ev('checkForNewBuild()'); if(ev('window.__reloads')!==0) throw new Error('reloaded by itself');
   pill().querySelector('button').dispatchEvent(new window.Event('click',{bubbles:true}));
   if(ev('window.__reloads')!==1) throw new Error('button did not reload');
 });
 await check('a build older than ours, or within a minute of ours, is not "newer"', async()=>{
   serve(new Date(MINE-86400e3).toUTCString()); if(await ev('checkForNewBuild()')!==false||shown()) throw new Error('older build flagged');
   serve(new Date(MINE+30e3).toUTCString()); if(await ev('checkForNewBuild()')!==false||shown()) throw new Error('30s skew flagged');
 });
 await check('offline, an error, or no Last-Modified header → silent, and an already-shown pill is left alone', async()=>{
   serve(new Date(MINE+3600e3).toUTCString()); await ev('checkForNewBuild()');
   window.fetch=async()=>{ throw new Error('offline'); }; if(await ev('checkForNewBuild()')!==false) throw new Error('error reported as newer');
   if(!shown()) throw new Error('a failed re-check hid a real notice');
   serve(null); if(await ev('checkForNewBuild()')!==false) throw new Error('missing header reported as newer');
 });
 await check('never on the TV: hidden by CSS in display mode and in print', async()=>{
   const css=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n');
   if(!/body\.display-mode\s+#updateNotice\s*\{[^}]*display\s*:\s*none/.test(css)) throw new Error('no display-mode rule');
   const print=css.slice(css.indexOf('@media print')); if(!/#updateNotice/.test(print)) throw new Error('not hidden in print');
 });
 ev('window.__realCheck=checkForNewBuild;');
 await check('triggers are throttled to one check per 10 minutes, and need no timer of their own', async()=>{
   ev(`window.__n=0; checkForNewBuild=async function(){ window.__n++; return false; }; _buildCheckedAt=0;`);
   if(ev('maybeCheckForNewBuild()')!==true) throw new Error('first trigger skipped');
   doc.dispatchEvent(new window.Event('pointerdown',{bubbles:true})); window.dispatchEvent(new window.Event('focus'));
   if(ev('window.__n')!==1) throw new Error('not throttled: '+ev('window.__n'));
   ev(`_buildCheckedAt=Date.now()-BUILD_CHECK_MS-1000;`); doc.dispatchEvent(new window.Event('pointerdown',{bubbles:true}));
   if(ev('window.__n')!==2) throw new Error('a touch 10+ minutes later did not check: '+ev('window.__n'));
   const src=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
   const a=src.indexOf('A NEWER BUILD IS LIVE'), b=src.indexOf('/* ===================== INIT');
   const block=src.slice(a,b).split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
   if(/setInterval\(|setTimeout\(/.test(block)) throw new Error('the build check owns a timer — that hangs every jsdom test');
 });
 await check('a file:// copy never checks', async()=>{
   ev(`buildCheckAllowed=function(){ return false; }`); serve(new Date(MINE+3600e3).toUTCString());
   if(await ev('window.__realCheck()')!==false||window.__calls.length) throw new Error('checked anyway');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
