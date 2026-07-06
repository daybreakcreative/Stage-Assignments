// #9 Stage 2 — findPackConflicts(): detects two on-stage IEM users on the same mix, or one
// with no mix; suggests moving the lowest-priority (off-stage shadow first) to an open mix.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const CONF = c => JSON.parse(ev(`JSON.stringify((function(){${c}; var r=findPackConflicts(); return {hasIssues:r.hasIssues,needMore:r.needMore,open:r.openMixes,fixes:r.fixes.map(f=>({kind:f.kind,name:f.position.name,kind2:f.position.kind,pr:f.position.priority,cur:f.currentMix,to:f.suggestTo,shared:f.sharedWith}))};})())`));
const base = `state.config.iemPackPresets=['Drums','Bass','EG','Keys','Acoustic','Misc 1','Misc 2','Misc 3']; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.instruments=[];`;

window.addEventListener('load',()=>setTimeout(()=>{

 check('no conflict when everyone is on a distinct mix', ()=>{
   const r=CONF(`${base} state.instruments=[{id:'i1',label:'Drums',assignedTo:'Sam',pack:'Drums'},{id:'i2',label:'Bass',assignedTo:'Jo',pack:'Bass'}]`);
   if(r.hasIssues) throw new Error('unexpected conflict: '+JSON.stringify(r.fixes));
 });

 check('two instruments on the same mix → one dup fix, suggests an open mix', ()=>{
   const r=CONF(`${base} state.instruments=[{id:'i1',label:'Electric 1',assignedTo:'Sam',pack:'Misc 1'},{id:'i2',label:'Electric 2',assignedTo:'Jo',pack:'Misc 1',optional:true}]`);
   if(!r.hasIssues || r.fixes.length!==1) throw new Error('expected 1 fix: '+JSON.stringify(r.fixes));
   const f=r.fixes[0];
   if(f.kind!=='dup'||f.cur!=='Misc 1') throw new Error('not a Misc 1 dup: '+JSON.stringify(f));
   if(f.name!=='Jo') throw new Error('should move the optional (lower-priority) EG2 player Jo, got '+f.name);
   if(!f.to || f.to==='Misc 1' || r.open.indexOf(f.to)<0) throw new Error('suggestTo not an open mix: '+f.to);
 });

 check('instrument with no mix → unassigned fix with an open mix suggested', ()=>{
   const r=CONF(`${base} state.instruments=[{id:'i1',label:'Keys',assignedTo:'Pat',pack:''}]`);
   if(r.fixes.length!==1 || r.fixes[0].kind!=='unassigned') throw new Error('expected 1 unassigned: '+JSON.stringify(r.fixes));
   if(!r.fixes[0].to) throw new Error('no open mix suggested');
 });

 check('off-stage-IEM shadow is lowest priority → it moves, not the band instrument', ()=>{
   const r=CONF(`${base} state.instruments=[{id:'i1',label:'Bass',assignedTo:'Sam',pack:'Misc 2'}]; state.shadows=[{id:'s1',name:'Bri',setup:'off-stage-iem',pack:'Misc 2'}]`);
   const f=r.fixes.find(x=>x.cur==='Misc 2');
   if(!f) throw new Error('no Misc 2 conflict: '+JSON.stringify(r.fixes));
   if(f.name!=='Bri' || f.kind2!=='shadow') throw new Error('off-stage shadow should be the mover, got '+f.name);
 });

 check('not enough open mixes → needMore, and the LOWEST-priority (off-stage shadow) is left with no suggestion', ()=>{
   // Only 2 mixes total; 3 consumers all on 'Drums' → 2 need to move, only 1 open mix ('Misc 9').
   const r=CONF(`${base} state.config.iemPackPresets=['Drums','Misc 9']; state.instruments=[{id:'i1',label:'Bass',assignedTo:'A',pack:'Drums'},{id:'i2',label:'Keys',assignedTo:'B',pack:'Drums'}]; state.shadows=[{id:'s1',name:'Shad',setup:'off-stage-iem',pack:'Drums'}]`);
   if(!r.needMore) throw new Error('expected needMore=true: '+JSON.stringify(r));
   const shadowFix=r.fixes.find(x=>x.name==='Shad');
   if(!shadowFix || shadowFix.to!==null) throw new Error('off-stage shadow should be the one left without a mix: '+JSON.stringify(r.fixes));
 });

 check('vocalists on reserved vocal mixes never count as conflicts', ()=>{
   const r=CONF(`${base} state.vocalists=[{id:'v1',name:'A',micAssigned:''},{id:'v2',name:'B',micAssigned:''}]; state.assignments[0]='v1'; state.assignments[1]='v2';`);
   if(r.hasIssues) throw new Error('vocalists should not conflict: '+JSON.stringify(r.fixes));
 });

 check('off-stage / observing shadow (no IEM) is not a mix consumer', ()=>{
   const r=CONF(`${base} state.instruments=[{id:'i1',label:'Bass',assignedTo:'Sam',pack:'Misc 2'}]; state.shadows=[{id:'s1',name:'Obs',setup:'observer',pack:'Misc 2'},{id:'s2',name:'OffNoIem',setup:'off-stage',pack:'Misc 2'}]`);
   if(r.hasIssues) throw new Error('no-IEM shadows should not consume a mix: '+JSON.stringify(r.fixes));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
