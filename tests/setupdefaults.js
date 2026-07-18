// FEATURE: edit the church's DEFAULT setup items per instrument from Advanced Settings
// (renderSetupDefaultsEditor → #setupDefaultsEditor). Writes state.config.setupDefaults[key];
// applies to NEW people as they're seeded (non-destructive to existing buckets).
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

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 check('renders a default-setup card per catalog key, incl. MD', ()=>{
   ev(`state.config.setupDefaults={}; renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
   const cont=doc.getElementById('setupDefaultsEditor');
   if(!cont) throw new Error('no #setupDefaultsEditor container');
   const cards=cont.querySelectorAll('[data-def-key]');
   const keys=[].map.call(cards, c=>c.getAttribute('data-def-key'));
   ['drums','bass','ag','eg','keys','md','strings','vocals'].forEach(k=>{ if(keys.indexOf(k)===-1) throw new Error('missing card for '+k); });
   const mdCard=[].find.call(cards, c=>c.getAttribute('data-def-key')==='md');
   if(!/Music Director|Tracks/i.test(mdCard.textContent)) throw new Error('MD card missing its label');
 });

 check('ticking a group option writes setupDefaults[key].selections', ()=>{
   ev(`state.config.setupDefaults={}; renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
   const mdCard=[].find.call(doc.querySelectorAll('#setupDefaultsEditor [data-def-key]'), c=>c.getAttribute('data-def-key')==='md');
   const cb=mdCard.querySelector('input[value="md_tracks"]');
   if(!cb) throw new Error('no md_tracks option input rendered');
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const sel=JSON.parse(ev('JSON.stringify(state.config.setupDefaults.md.selections)'));
   const has=Object.keys(sel).some(g=>Array.isArray(sel[g])&&sel[g].indexOf('md_tracks')!==-1);
   if(!has) throw new Error('md_tracks not written to defaults: '+JSON.stringify(sel));
 });

 check('adding then removing a custom item updates customOptions', ()=>{
   ev(`state.config.setupDefaults={}; renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
   const mdCard=[].find.call(doc.querySelectorAll('#setupDefaultsEditor [data-def-key]'), c=>c.getAttribute('data-def-key')==='md');
   const input=mdCard.querySelector('.def-custom-input');
   const add=mdCard.querySelector('.def-custom-add');
   input.value='Bring click track'; add.dispatchEvent(new window.Event('click',{bubbles:true}));
   let opts=JSON.parse(ev('JSON.stringify((state.config.setupDefaults.md.customOptions||[]).map(o=>o.text))'));
   if(opts.indexOf('Bring click track')===-1) throw new Error('custom not added: '+JSON.stringify(opts));
   const del=mdCard.querySelector('.def-custom-del');
   del.dispatchEvent(new window.Event('click',{bubbles:true}));
   opts=JSON.parse(ev('JSON.stringify((state.config.setupDefaults.md.customOptions||[]).map(o=>o.text))'));
   if(opts.indexOf('Bring click track')!==-1) throw new Error('custom not removed: '+JSON.stringify(opts));
 });

 check('a NEWLY seeded person inherits the new defaults (closes the MD loop)', ()=>{
   ev(`state.config.setupDefaults={}; renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
   const mdCard=[].find.call(doc.querySelectorAll('#setupDefaultsEditor [data-def-key]'), c=>c.getAttribute('data-def-key')==='md');
   const cb=mdCard.querySelector('input[value="md_tracks"]');
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   // seed a fresh MD bucket AFTER setting the default
   ev(`state.setupItems={};`);
   const key=ev(`stableSetupKey('New MD','md','md')`);
   ev(`seedPersonSetup(${JSON.stringify(key)},'md');`);
   const texts=JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(key)}].items||[]).map(i=>i.text))`));
   if(texts.indexOf('House tracks computer')===-1) throw new Error('new MD did not inherit default item: '+JSON.stringify(texts));
 });

 check('editing a default does NOT mutate an already-seeded bucket', ()=>{
   ev(`state.config.setupDefaults={}; state.setupItems={};`);
   const key=ev(`stableSetupKey('Old MD','md','md')`);
   ev(`seedPersonSetup(${JSON.stringify(key)},'md');`); // seeded with EMPTY md defaults → no items
   const before=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).length`);
   ev(`renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));`);
   const mdCard=[].find.call(doc.querySelectorAll('#setupDefaultsEditor [data-def-key]'), c=>c.getAttribute('data-def-key')==='md');
   const cb=mdCard.querySelector('input[value="md_tracks"]');
   cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const after=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).length`);
   if(after!==before) throw new Error('existing bucket changed by a defaults edit ('+before+'→'+after+')');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
