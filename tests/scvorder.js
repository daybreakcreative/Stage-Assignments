// ✓ Items (and every consumer of enumerateSetupRoles) must list vocalists in STAGE order —
// VOCAL 1, 2, 3… — not the raw state.vocalists array order (which arrives alphabetical from a
// PCO pull). Reported 2026-08-04: "In setup Items it lists vocalist in alphabetical not stage
// order. would be easier for switching capsules etc if they were in stage order".
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
 ev('toast=function(){};');

 // The reported roster: array order is ALPHABETICAL (as PCO returns it), but stage order
 // (state.assignments) is Marcus=VOCAL 1, Ella=VOCAL 2, Grayson=VOCAL 3.
 const seed=()=>ev(`
   state.serviceOrder=[];
   state.vocalists=[{id:'ella',   name:'Ella Graves',    micAssigned:'KMS105'},
                    {id:'grayson',name:'Grayson Kredit', micAssigned:'KMS105'},
                    {id:'marcus', name:'Marcus Donalson',micAssigned:'D:Facto'}];
   state.assignments=['marcus','ella','grayson',null,null,null,null,null];
   state.instruments=[];
   state.shadows=[]; state.hosts={}; state.mdSoloName=null; state.musicDirectorId=null;
 `);

 check('enumerateSetupRoles lists vocalists in stage order, not array order', ()=>{
   seed();
   const names=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().filter(r=>r.role==='vocalist').map(r=>r.name))`));
   const expected=['Marcus Donalson','Ella Graves','Grayson Kredit'];
   if(JSON.stringify(names)!==JSON.stringify(expected))
     throw new Error('expected stage order '+JSON.stringify(expected)+' got '+JSON.stringify(names));
 });

 check('the ✓ Items VOCALISTS cards render in stage order (VOCAL 1,2,3)', ()=>{
   seed();
   const secs=JSON.parse(ev(`(function(){
     var s=collectChecklistItems().find(function(x){return x.key==='vocalists'});
     return JSON.stringify((s&&s.people||[]).map(function(p){return p.name}));
   })()`));
   const expected=['Marcus Donalson','Ella Graves','Grayson Kredit'];
   if(JSON.stringify(secs)!==JSON.stringify(expected))
     throw new Error('checklist cards out of stage order: '+JSON.stringify(secs));
 });

 check('a vocalist missing from state.assignments still appears (appended last)', ()=>{
   seed();
   ev("state.vocalists.push({id:'zoe',name:'Zoe Absent',micAssigned:''});"); // never assigned a slot
   const names=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().filter(r=>r.role==='vocalist').map(r=>r.name))`));
   if(names.indexOf('Zoe Absent')===-1) throw new Error('unassigned vocalist dropped: '+JSON.stringify(names));
   if(names[names.length-1]!=='Zoe Absent') throw new Error('unassigned vocalist should sort last: '+JSON.stringify(names));
   if(names.length!==4) throw new Error('expected 4 vocalists, got '+JSON.stringify(names));
 });

 check('reordering the stage (drag) reorders the ✓ Items list', ()=>{
   seed();
   ev("state.assignments=['grayson','marcus','ella',null,null,null,null,null];");
   const names=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().filter(r=>r.role==='vocalist').map(r=>r.name))`));
   const expected=['Grayson Kredit','Marcus Donalson','Ella Graves'];
   if(JSON.stringify(names)!==JSON.stringify(expected))
     throw new Error('did not follow the new stage order: '+JSON.stringify(names));
 });

 check('no vocalist is duplicated or lost by the reorder', ()=>{
   seed();
   const names=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().filter(r=>r.role==='vocalist').map(r=>r.name))`));
   if(new Set(names).size!==names.length) throw new Error('duplicate: '+JSON.stringify(names));
   ['Ella Graves','Grayson Kredit','Marcus Donalson'].forEach(n=>{
     if(names.indexOf(n)===-1) throw new Error('lost '+n);
   });
 });

 check('band entries still follow the instrument roster (stage left→right), unchanged', ()=>{
   seed();
   ev(`state.instruments=[{id:'i1',label:'Bass',assignedTo:'Evan Forniss',pack:'Bass'},
                          {id:'i2',label:'Drums',assignedTo:'Simon Mugarami',pack:'Drums'},
                          {id:'i3',label:'Keys',assignedTo:'Santi',pack:'Keys'}];`);
   const band=JSON.parse(ev(`JSON.stringify(enumerateSetupRoles().filter(r=>r.role==='band').map(r=>r.name))`));
   const expected=['Evan Forniss','Simon Mugarami','Santi'];
   if(JSON.stringify(band)!==JSON.stringify(expected))
     throw new Error('band order changed: '+JSON.stringify(band));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
