// FIX #2 — per-person mic prefs must NOT collide on a shared first name.
// FIX #9 — auto-remember only seeds from the DELIBERATE Auto-Assign path,
//          never from a derived (PCO-style) assignment.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const pref = name => { const r=ev(`JSON.stringify(micPrefFor(${JSON.stringify(name)}))`); return r?JSON.parse(r):null; };
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 // ---- FIX #2: shared first name isolation ----
 check('2a) two people sharing a first name keep SEPARATE mic records', ()=>{
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"ca",name:"Chris Allen",isWL:false,leadsSongs:false,micAssigned:""},{id:"cb",name:"Chris Boone",isWL:false,leadsSongs:false,micAssigned:""}]');
   // Set a lock + remembered on Chris Allen only.
   ev('setMicLock("Chris Allen","KMS105")');
   ev('setMicRemembered("Chris Allen","Beta 58A"); saveState()');
   const a=pref('Chris Allen'); const b=pref('Chris Boone');
   if(!a || a.lock!=='KMS105') throw new Error('Chris Allen lock lost: '+JSON.stringify(a));
   if(b && (b.lock || b.remembered)) throw new Error('Chris Boone WRONGLY inherited Chris Allen prefs: '+JSON.stringify(b));
 });
 check('2b) setting Chris Boone does not clobber Chris Allen', ()=>{
   ev('setMicLock("Chris Boone","SM58"); saveState()');
   const a=pref('Chris Allen'); const b=pref('Chris Boone');
   if(!a || a.lock!=='KMS105') throw new Error('Chris Allen lock changed by Boone: '+JSON.stringify(a));
   if(!b || b.lock!=='SM58') throw new Error('Chris Boone lock not stored: '+JSON.stringify(b));
 });
 check('2c) micPrefRecord returns the RIGHT person for each full name', ()=>{
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.config.micPrefs.people))'));
   if(!keys.includes('Chris Allen')||!keys.includes('Chris Boone')) throw new Error('both full-name keys must exist: '+JSON.stringify(keys));
 });

 // ---- FIX #9: derived assignment must NOT seed remembered ----
 check('9a) a NON-deliberate (PCO-style) assignment does NOT seed remembered', ()=>{
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"Beta 58A",total:2,rank:2},{name:"SM58",total:4,rank:3}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"g",name:"Gina",isWL:true,leadsSongs:true,micAssigned:""},{id:"m",name:"Milo",isWL:false,leadsSongs:false,micAssigned:""}]');
   ev('assignMicsToVocalists()'); // default = derived, no explicit Auto-Assign click
   const g=pref('Gina'); const m=pref('Milo');
   if(g && g.remembered) throw new Error('Gina remembered was seeded by a derived assignment: '+JSON.stringify(g));
   if(m && m.remembered) throw new Error('Milo remembered was seeded by a derived assignment: '+JSON.stringify(m));
   // but the mics WERE still assigned this run
   if(ev('state.vocalists.find(v=>v.id==="g").micAssigned')!=='KMS105') throw new Error('Gina should still get a mic this run');
 });
 check('9b) the explicit Auto-Assign path DOES seed remembered (parity w/ micengine 1b)', ()=>{
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"g",name:"Gina",isWL:true,leadsSongs:true,micAssigned:""},{id:"m",name:"Milo",isWL:false,leadsSongs:false,micAssigned:""}]');
   ev('autoAssign()');
   const g=pref('Gina');
   if(!g || g.remembered!=='KMS105') throw new Error('Auto-Assign should seed Gina remembered: '+JSON.stringify(g));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
