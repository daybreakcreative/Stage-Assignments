// UI test for the unified mic-preference panel + card toggles (supersedes the old state.preferences bridge test)
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
const fire=(el,type)=>el.dispatchEvent(new window.Event(type,{bubbles:true}));
const rec=name=>{const r=ev(`JSON.stringify(micPrefFor(${JSON.stringify(name)}))`);return r?JSON.parse(r):null;};
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');                 // isolate handler logic from full re-render
 const setup=()=>{
   ev('state.inventory=[{name:"KMS105",total:1,rank:1,wireless:true},{name:"Beta 58A",total:2,rank:2,wireless:true},{name:"SM58",total:4,rank:3,wireless:false},{name:"D:Facto",total:1,rank:4,wireless:false}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"g",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:"KMS105"},{id:"o",name:"Mo",isWL:false,leadsSongs:false,micAssigned:"SM58"}]');
 };

 check('panel renders leader-mic chips + a people table with both vocalists', ()=>{
   setup(); ev('renderPrefEditor()');
   const chips=doc.querySelectorAll('#prefEdit [data-leadermic]').length;
   const rows=doc.querySelectorAll('#prefEdit .pref-table tbody tr').length;
   if(chips!==4) throw new Error('expected 4 leader-mic chips, got '+chips);
   if(rows!==2) throw new Error('expected 2 people rows, got '+rows);
 });
 check('checking a leader-mic chip adds it to leaderMics', ()=>{
   setup(); ev('renderPrefEditor()');
   const cb=doc.querySelector('#prefEdit [data-leadermic="Beta 58A"]');
   cb.checked=true; fire(cb,'change');
   const lm=ev('JSON.stringify(micPrefsStore().leaderMics)');
   if(!JSON.parse(lm).includes('Beta 58A')) throw new Error('leaderMics='+lm);
 });
 check('setting the "Always" dropdown locks that person to the mic', ()=>{
   setup(); ev('renderPrefEditor()');
   const sel=doc.querySelector('#prefEdit .pp-lock[data-name="Grayson"]');
   sel.value='D:Facto'; fire(sel,'change');
   if((rec('Grayson')||{}).lock!=='D:Facto') throw new Error('lock='+JSON.stringify(rec('Grayson')));
 });
 check('checking "No mic" sets noMic and frees the mic', ()=>{
   setup(); ev('renderPrefEditor()');
   const cb=doc.querySelector('#prefEdit .pp-nomic[data-name="Mo"]');
   cb.checked=true; fire(cb,'change');
   if(!(rec('Mo')||{}).noMic) throw new Error('noMic not set: '+JSON.stringify(rec('Mo')));
   if(ev('state.vocalists.find(v=>v.id==="o").micAssigned')!=='') throw new Error('Mo mic not freed');
 });
 check('the "Usually" clear (✕) forgets the remembered mic', ()=>{
   setup(); ev('setMicRemembered("Mo","SM58"); saveState()'); ev('renderPrefEditor()');
   const btn=doc.querySelector('#prefEdit .pp-rem-clear[data-name="Mo"]');
   if(!btn) throw new Error('no clear button rendered for a remembered mic');
   btn.click();
   if((rec('Mo')||{}).remembered) throw new Error('remembered not cleared: '+JSON.stringify(rec('Mo')));
 });
 check('vocalist cards no longer render Lock Mic / No Mic buttons (removed; locking lives in Advanced Settings)', ()=>{
   setup(); ev('state.config.showMicCapsules=true'); ev('state.assignments=computePositions(state.vocalists)'); ev('renderVocalists()');
   if(doc.querySelector('#vocGrid .voc-mic-lock')) throw new Error('card Lock Mic button still rendered');
   if(doc.querySelector('#vocGrid .voc-nomic-toggle')) throw new Error('card No Mic button still rendered');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
