// importvalidate.js — Bug #2: Data → Import must VALIDATE the pasted JSON in memory
// (run it through the same normalization loadState uses) BEFORE writing localStorage.
// A malformed/empty-but-parseable payload must NOT overwrite good data or collapse
// the app to _firstRun. Valid exports still import (write localStorage + reload).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 // location.reload isn't implemented in jsdom — make it a no-op we can observe.
 try{ Object.defineProperty(w.location,'reload',{configurable:true,value:function(){w.__reloaded=(w.__reloaded||0)+1;}}); }catch(_){}
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

function doImport(text){
 ev('toast=function(m,k){window.__lastToast={m:m,k:k};};');
 // The import UI + its click handler live inside renderDataEditor(); render it fresh
 // each time so #importJsonText/#importJsonBtn exist and are wired.
 ev('renderDataEditor()');
 const ta=doc.getElementById('importJsonText');
 ta.value=text;
 window.__reloaded=0; window.__lastToast=null;
 doc.getElementById('importJsonBtn').click();
}

window.addEventListener('load',()=>setTimeout(()=>{
 const KEY=ev('STORAGE_KEY');
 // A known-good current state in localStorage that must NOT be clobbered by a bad import.
 const goodRaw=JSON.stringify({ config:{ marker:'KEEP_ME' }, service:{ date:'2026-07-05' }, vocalists:[{id:'v1',name:'Real'}], instruments:[{id:'inst_keys',label:'Keys'}] });

 check('valid export → writes localStorage (import applies)', ()=>{
   window.localStorage.setItem(KEY, goodRaw);
   const exp=JSON.stringify({ config:{ marker:'IMPORTED' }, service:{ date:'2026-07-06' }, vocalists:[{id:'v9',name:'New'}], instruments:[{id:'inst_bass',label:'Bass'}] });
   doImport(exp);
   const now=JSON.parse(window.localStorage.getItem(KEY));
   // The load-bearing behavior: a valid payload is committed to localStorage.
   // (The reload is fired from a 600ms setTimeout — not asserted here to avoid timer flake.)
   if(!now || now.config.marker!=='IMPORTED') throw new Error('valid import did not persist (marker='+(now&&now.config&&now.config.marker)+')');
 });

 check('garbage that is not JSON → data untouched, error toast', ()=>{
   window.localStorage.setItem(KEY, goodRaw);
   doImport('this is not json {{{');
   const now=window.localStorage.getItem(KEY);
   if(now!==goodRaw) throw new Error('non-JSON import overwrote good data');
   if(window.__reloaded) throw new Error('reloaded on a non-JSON import');
   if(!window.__lastToast || window.__lastToast.k!=='warn') throw new Error('no warn toast on bad import');
 });

 check('parseable but non-Stage·Assign object → data untouched', ()=>{
   window.localStorage.setItem(KEY, goodRaw);
   doImport(JSON.stringify({ hello:'world', foo:123 }));
   const now=window.localStorage.getItem(KEY);
   if(now!==goodRaw) throw new Error('unrelated object overwrote good data');
   if(window.__reloaded) throw new Error('reloaded on an unrelated object');
 });

 // The core of the bug: a payload that PARSES and has one recognized key but would
 // normalize into a broken/empty state (arrays are the wrong type, no config) must be
 // rejected in memory — never written, and it must not degrade to _firstRun on next load.
 check('malformed payload (bad shapes) is rejected and does NOT overwrite good data', ()=>{
   window.localStorage.setItem(KEY, goodRaw);
   // has `vocalists` key (so it trips the old shallow check) but it's not an array,
   // no config, no service, instruments missing → normalization can't yield a sane state.
   doImport(JSON.stringify({ vocalists:'nope' }));
   const now=window.localStorage.getItem(KEY);
   if(now!==goodRaw) throw new Error('malformed payload overwrote good data (now='+now+')');
   if(window.__reloaded) throw new Error('reloaded on a malformed payload');
   if(!window.__lastToast || window.__lastToast.k!=='warn') throw new Error('no warn toast on malformed import');
 });

 check('empty JSON object {} is rejected (would be a blank state)', ()=>{
   window.localStorage.setItem(KEY, goodRaw);
   doImport('{}');
   const now=window.localStorage.getItem(KEY);
   if(now!==goodRaw) throw new Error('empty object overwrote good data');
   if(window.__reloaded) throw new Error('reloaded on empty object');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
