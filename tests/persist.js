const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 check('roundStagePoint preserves control point', ()=>{
   const rp=ev('roundStagePoint({x:10.4,y:20.6,c:{x:5.5,y:6.5}})');
   if(!rp.c || rp.c.x!==6 || rp.c.y!==7 || rp.x!==10 || rp.y!==21) throw new Error(JSON.stringify(rp));
 });
 check('roundStagePoint without c stays straight', ()=>{
   const rp=ev('roundStagePoint({x:1.2,y:2.8})'); if(rp.c) throw new Error('added spurious c');
 });
 // Bug #4: a saved roster of 9+ vocalists must NOT be truncated by loadState.
 // MAX_VOCALISTS defaults to 8 and only grows via ensureVocalCapacity() which runs
 // AFTER loadState — so loadState must key its pad/trim off the saved roster size.
 check('loadState keeps the 9th & 10th vocalist assignment + IEM pack (no truncation)', ()=>{
   const vocalists=[];
   for(let i=0;i<10;i++) vocalists.push({id:'v'+i,name:'V'+i,isWL:i===0,micAssigned:''});
   const assignments=vocalists.map(v=>v.id);            // 10 slots, id per position
   const voxIemPacks=vocalists.map((_,i)=>'Pack'+i);    // 10 parallel pack names
   const saved={ config:{ voxIemPacks }, vocalists, assignments, service:{ date:'2026-07-05' } };
   window.localStorage.setItem(ev('STORAGE_KEY'), JSON.stringify(saved));
   const loaded=ev('loadState()');
   if(loaded._firstRun) throw new Error('loadState collapsed to _firstRun');
   if(loaded.vocalists.length!==10) throw new Error('vocalists truncated to '+loaded.vocalists.length);
   if(loaded.assignments.length<10) throw new Error('assignments truncated to '+loaded.assignments.length);
   if(loaded.assignments[8]!=='v8') throw new Error('slot 9 lost: '+loaded.assignments[8]);
   if(loaded.assignments[9]!=='v9') throw new Error('slot 10 lost: '+loaded.assignments[9]);
   if((loaded.config.voxIemPacks||[]).length<10) throw new Error('voxIemPacks truncated to '+(loaded.config.voxIemPacks||[]).length);
   if(loaded.config.voxIemPacks[8]!=='Pack8') throw new Error('pack 9 lost: '+loaded.config.voxIemPacks[8]);
   if(loaded.config.voxIemPacks[9]!=='Pack9') throw new Error('pack 10 lost: '+loaded.config.voxIemPacks[9]);
   window.localStorage.removeItem(ev('STORAGE_KEY'));
 });
 check('saveState writes curve to localStorage; reload keeps it', ()=>{
   ev('state.config.customStagePoints=[{x:20,y:120,c:{x:400,y:18}},{x:780,y:120},{x:780,y:340},{x:20,y:340}]');
   ev('saveState()');
   const raw=window.localStorage.getItem(ev('STORAGE_KEY'));
   const cps=JSON.parse(raw).config.customStagePoints;
   if(!cps[0].c || cps[0].c.y!==18) throw new Error('not in localStorage: '+JSON.stringify(cps[0]));
   // simulate loadState mapping
   const mapped=ev('JSON.parse(window.localStorage.getItem(STORAGE_KEY)).config.customStagePoints.map(roundStagePoint)');
   if(!mapped[0].c || mapped[0].c.y!==18) throw new Error('loadState mapping dropped c: '+JSON.stringify(mapped[0]));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
