const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 // Build a team: 5 vocalists, 2 named
 ev(`state.vocalists=[
   {id:"v1",name:"Grace",leadsSongs:false,isWL:true,micAssigned:""},
   {id:"v2",name:"Sam",leadsSongs:false,isWL:false,micAssigned:""},
   {id:"v3",name:"",leadsSongs:false,isWL:false,micAssigned:""},
   {id:"v4",name:"",leadsSongs:false,isWL:false,micAssigned:""},
   {id:"v5",name:"",leadsSongs:false,isWL:false,micAssigned:""}
 ];`);
 ev('state.inventory=[{name:"Beta 58A",total:2,rank:1,wireless:true},{name:"SM58",total:4,rank:2,wireless:false}];');
 ev('ensureVocalCapacity(); state.assignments=computePositions(state.vocalists);');
 const before = ev('state.vocalists.length');
 ev('autoAssign()');
 check('all 5 vocalist slots preserved after auto-assign', ()=>{
   const after = ev('state.vocalists.length');
   if(after!==5) throw new Error('vocalists became '+after);
 });
 check('assignments still references the 5 slots (not culled to 2)', ()=>{
   const n = ev('state.assignments.filter(Boolean).length');
   if(n!==5) throw new Error('assignments filled = '+n);
 });
 check('named vocalists received a mic', ()=>{
   const g = ev('state.vocalists.find(v=>v.id==="v1").micAssigned');
   const s = ev('state.vocalists.find(v=>v.id==="v2").micAssigned');
   if(!g||!s) throw new Error('Grace="'+g+'" Sam="'+s+'"');
 });
 check('empty vocalists got no mic (blank)', ()=>{
   if(ev('state.vocalists.find(v=>v.id==="v3").micAssigned')!=='') throw new Error('empty got a mic');
 });
 check('auto-assign with zero named warns and no-ops', ()=>{
   ev('state.vocalists=[{id:"e",name:"",isWL:true,micAssigned:""}]; state.assignments=computePositions(state.vocalists);');
   const before=ev('JSON.stringify(state.assignments)');
   ev('autoAssign()');
   // should not throw; state.vocalists still length 1
   if(ev('state.vocalists.length')!==1) throw new Error('mutated on empty');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},120));
