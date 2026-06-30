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
window.addEventListener('load',()=>setTimeout(()=>{
 ev(`
   state.config.stageFeatures=[
     {id:'f1',type:'wedge',label:'Drum monitor',x:400,y:232,w:78,h:50,rot:0},
     {id:'f2',type:'power',label:'Stage DI',x:200,y:200,w:44,h:44,rot:0},
     {id:'f3',type:'stairs',label:'Stairs',x:100,y:300,w:150,h:80,rot:0},
     {id:'f4',type:'wedge',label:'Monitor',x:300,y:200,w:78,h:50,rot:0},
     {id:'f5',type:'wedge',label:'Monitor',x:500,y:200,w:78,h:50,rot:0}
   ];
   state.vocalists=[]; state.instruments=[];
 `);
 check('monitors + DI/power create a STAGE section; structural fixtures excluded', ()=>{
   const arr=JSON.parse(ev('JSON.stringify(collectChecklistItems())'));
   const stage=arr.find(s=>s.key==='stage');
   if(!stage) throw new Error('no STAGE section');
   if(stage.items.length!==4) throw new Error('expected 4 items (3 wedge + 1 power), got '+stage.items.length);
   if(stage.items.some(i=>/f3/.test(i.key))) throw new Error('stairs produced a task');
   if(!stage.items.every(i=>/^stage\|/.test(i.key))) throw new Error('keys not by fixture id');
 });
 check('verbs match type; duplicate labels numbered, unique label untouched', ()=>{
   const stage=JSON.parse(ev('JSON.stringify(collectChecklistItems())')).find(s=>s.key==='stage');
   const byKey={}; stage.items.forEach(i=>byKey[i.key]=i);
   if(byKey['stage|f1'].itemText!=='Line-check') throw new Error('wedge verb');
   if(byKey['stage|f2'].itemText!=='Patch & test') throw new Error('power verb');
   if(byKey['stage|f1'].personName!=='Drum monitor') throw new Error('unique label changed');
   const dups=[byKey['stage|f4'].personName, byKey['stage|f5'].personName].sort();
   if(dups[0]!=='Monitor #1'||dups[1]!=='Monitor #2') throw new Error('dupes not numbered: '+dups);
 });
 check('check-off keyed by fixture id survives a label edit', ()=>{
   ev(`state.pcoConfig.selectedPlanId='PF'; getChecklistState()['stage|f1']=true; state.config.stageFeatures.find(f=>f.id==='f1').label='Front wedge';`);
   const stage=JSON.parse(ev('JSON.stringify(collectChecklistItems())')).find(s=>s.key==='stage');
   const it=stage.items.find(i=>i.key==='stage|f1');
   if(it.personName!=='Front wedge') throw new Error('label not reflected');
   if(!JSON.parse(ev('JSON.stringify(getChecklistState())'))['stage|f1']) throw new Error('check-off lost on relabel');
 });
 check('no fixtures → no STAGE section (and no crash)', ()=>{
   ev('state.config.stageFeatures=[];');
   const arr=JSON.parse(ev('JSON.stringify(collectChecklistItems())'));
   if(arr.some(s=>s.key==='stage')) throw new Error('STAGE section present with no fixtures');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
