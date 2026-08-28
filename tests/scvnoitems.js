// A person who is ON THE PLAN but has no setup items yet must still get a ✓ Items card
// (showing "No setup needed" + the ⚙), otherwise they are invisible on the setup page AND
// there is no way to give them setup items from there. Found during the 2026-08-27 walkthrough.
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

 // Simon (drums) and Evan (bass) deliberately have NO setup items; Santi has one.
 const seed=()=>ev(`
   state.serviceOrder=[]; state.setupItems={};
   state.config.setupDefaults={};
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'}];
   state.assignments=['v1',null,null,null,null,null,null,null];
   state.instruments=[{id:'inst_drums',label:'Drums',assignedTo:'Simon Mugarami',pack:'Drums'},
                      {id:'inst_bass',label:'Bass',assignedTo:'Evan Forniss',pack:'Bass'}];
   state.shadows=[]; state.hosts={}; state.mdSoloName=null; state.musicDirectorId=null;
 `);

 check('a band member with zero setup items still appears in the BAND section', ()=>{
   seed();
   const names=JSON.parse(ev(`(function(){
     var s=collectChecklistItems().find(function(x){return x.key==='band'});
     return JSON.stringify((s&&s.people||[]).map(function(p){return p.name}));
   })()`));
   if(names.indexOf('Simon Mugarami')===-1) throw new Error('drummer dropped from ✓ Items: '+JSON.stringify(names));
   if(names.indexOf('Evan Forniss')===-1) throw new Error('bassist dropped from ✓ Items: '+JSON.stringify(names));
 });

 check('their card renders the "No setup needed" state', ()=>{
   seed();
   ev('renderSetupChecklist();');
   const none=doc.querySelectorAll('#setupChecklistView .si-none');
   if(!none.length) throw new Error('si-none state never rendered');
 });

 check('their card still exposes the ⚙ so setup can be added from here', ()=>{
   seed();
   ev('renderSetupChecklist();');
   const cards=[...doc.querySelectorAll('#setupChecklistView .si-card')];
   const simon=cards.find(c=>/Simon Mugarami/.test(c.textContent));
   if(!simon) throw new Error('no card for Simon');
   if(!simon.querySelector('.si-cog')) throw new Error('no cog on a zero-item card — setup would be unreachable');
 });

 check('zero-item people do NOT inflate the progress counts', ()=>{
   seed();
   ev('renderSetupChecklist();');
   const secs=JSON.parse(ev(`JSON.stringify(collectChecklistItems().map(function(s){return {k:s.key,n:s.items.length}}))`));
   const band=secs.find(s=>s.k==='band');
   if(band && band.n!==0) throw new Error('zero-item band people contributed items: '+JSON.stringify(secs));
 });

 check('people with items still render their chips (no regression)', ()=>{
   seed();
   ev("var k=stableSetupKey('Simon Mugarami','band','drums'); seedPersonSetup(k,'drums'); state.setupItems[k].items=[{id:'a',text:'House snare',doneThisService:false}]; renderSetupChecklist();");
   const t=doc.getElementById('setupChecklistView').textContent;
   if(t.indexOf('House snare')===-1) throw new Error('existing items no longer render');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
