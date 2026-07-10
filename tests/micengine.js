const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const mic = id => ev(`state.vocalists.find(v=>v.id==="${id}").micAssigned`);
const rememb = name => { const r=ev(`JSON.stringify(micPrefFor(${JSON.stringify(name)}))`); return r?JSON.parse(r):null; };
window.addEventListener('load',()=>setTimeout(()=>{
 // NOTE (2026-07): the Leader Mics reserved pool and the per-person "no mic" concept were
 // removed. Ranking now drives everything. Priority is: (1) a song leader reuses their
 // remembered mic, (2) anyone with a locked mic gets it, (3) everyone else takes the best
 // available (highest-ranked) mic. leaderMics is a harmless legacy field, no longer seeded.
 const setup = () => {
   ev('state.inventory=[{name:"KMS105",total:1,rank:1,wireless:true},{name:"Beta 58A",total:2,rank:2,wireless:true},{name:"SM58",total:4,rank:3,wireless:false},{name:"D:Facto",total:1,rank:4,wireless:false}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.vocalists=[{id:"g",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""},{id:"a",name:"Mara",isWL:false,leadsSongs:true,micAssigned:""},{id:"o",name:"Mo",isWL:false,leadsSongs:false,micAssigned:""},{id:"n",name:"Ned",isWL:false,leadsSongs:false,micAssigned:""}]');
 };

 check('1) with no prefs, mics are handed out best→worst in order (leaders first)', ()=>{
   // seedRemembered=true = the deliberate Auto-Assign path (FIX #9): only that seeds "usual" mics.
   setup(); ev('assignMicsToVocalists(true)');
   // ordered WL Grayson, leader Mara, then non-leaders Mo, Ned.
   // Pool best→worst by rank/qty: KMS105 x1, Beta 58A x2, SM58 x4, D:Facto x1.
   // → Grayson KMS105, Mara Beta 58A, Mo Beta 58A (2nd), Ned SM58.
   if(mic('g')!=='KMS105') throw new Error('WL got '+mic('g'));
   if(mic('a')!=='Beta 58A') throw new Error('leader got '+mic('a'));
   if(mic('o')!=='Beta 58A') throw new Error('first non-leader should take the 2nd Beta 58A, got '+mic('o'));
   if(mic('n')!=='SM58') throw new Error('last non-leader should take SM58, got '+mic('n'));
 });
 check('1b) the assignment is remembered (seeded)', ()=>{
   if(rememb('Grayson').remembered!=='KMS105') throw new Error('Grayson remembered '+JSON.stringify(rememb('Grayson')));
   if(rememb('Mara').remembered!=='Beta 58A') throw new Error('Mara remembered '+JSON.stringify(rememb('Mara')));
 });
 check('2) sticky: re-running keeps the same pairing', ()=>{
   ev('state.vocalists.forEach(v=>v.micAssigned="")'); ev('assignMicsToVocalists()');
   if(mic('g')!=='KMS105'||mic('a')!=='Beta 58A') throw new Error('not sticky: '+mic('g')+'/'+mic('a'));
 });
 check('3) LOCK: a non-leader locked to KMS105 takes it from the leader', ()=>{
   setup();
   ev('setMicLock("Mo","KMS105")'); ev('assignMicsToVocalists()');
   if(mic('o')!=='KMS105') throw new Error('locked Mo got '+mic('o'));
   if(mic('g')==='KMS105') throw new Error('WL wrongly got the locked mic');
   if(mic('g')!=='Beta 58A') throw new Error('WL should fall to next best mic, got '+mic('g'));
 });
 check('4) LOCK for a leader beats the general pool', ()=>{
   setup();
   ev('setMicLock("Grayson","SM58")'); ev('assignMicsToVocalists()');
   if(mic('g')!=='SM58') throw new Error('locked WL got '+mic('g'));
   if(mic('a')!=='KMS105') throw new Error('other leader should take best available, got '+mic('a'));
 });
 check('5) remembered mic is reused when free (non-leader)', ()=>{
   setup(); ev('setMicRemembered("Mo","D:Facto"); saveState()'); ev('assignMicsToVocalists()');
   if(mic('o')!=='D:Facto') throw new Error('Mo remembered D:Facto but got '+mic('o'));
 });
 check('5b) a song leader with a remembered mic gets it before anyone else', ()=>{
   setup();
   // Mara (leader) remembers SM58 (rank 3) — she keeps it even though better mics are free.
   ev('setMicRemembered("Mara","SM58"); saveState()'); ev('assignMicsToVocalists()');
   if(mic('a')!=='SM58') throw new Error('leader Mara should keep remembered SM58, got '+mic('a'));
   if(mic('g')!=='KMS105') throw new Error('WL should still take best, got '+mic('g'));
 });
 check('6) a one-time fallback does NOT overwrite the usual remembered mic', ()=>{
   setup();
   // KMS105 x1, Beta 58A x1, SM58 x4. Mo (non-leader) usually Beta, but leaders take it first.
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"Beta 58A",total:1,rank:2},{name:"SM58",total:4,rank:3}]');
   ev('setMicRemembered("Mo","Beta 58A"); saveState()');
   ev('assignMicsToVocalists()');
   // Grayson→KMS105, Mara→Beta 58A (only one). Mo's Beta gone → fallback SM58.
   if(mic('o')!=='SM58') throw new Error('Mo expected fallback SM58, got '+mic('o'));
   if(rememb('Mo').remembered!=='Beta 58A') throw new Error('Mo remembered overwritten to '+JSON.stringify(rememb('Mo')));
 });
 check('8) manual setVocMic records the remembered mic', ()=>{
   setup(); ev('setVocMic("o","D:Facto")');
   if(rememb('Mo').remembered!=='D:Facto') throw new Error('manual pick not remembered: '+JSON.stringify(rememb('Mo')));
 });
 check('9) migration folds legacy state.preferences + personMicPrefs into micPrefs', ()=>{
   const r=ev(`JSON.stringify(normalizeMicPrefs({personMicPrefs:{Mara:{primary:"Beta 58A"}}},{preferences:{Grayson:"KMS105",Mo:"__nomic__"}}))`);
   const o=JSON.parse(r);
   if(o.people.Grayson.remembered!=='KMS105') throw new Error('Grayson not migrated: '+r);
   if(!o.people.Mo.noMic) throw new Error('Mo __nomic__ not migrated: '+r);
   if(o.people.Mara.remembered!=='Beta 58A') throw new Error('Mara primary not migrated: '+r);
   if(o.leaderMics.length!==0) throw new Error('leaderMics should start empty');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
