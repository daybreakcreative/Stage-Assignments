// FIX #8 — applyPcoMerge must be ATOMIC: a throw partway through must leave the
// live state byte-identical to the pre-merge snapshot (rolled back) and rethrow,
// so the 3-min unattended auto-refresh can never persist a half-merged state.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 if(!w.crypto) w.crypto={}; if(!w.crypto.randomUUID) w.crypto.randomUUID=()=>'x'+Math.random().toString(16).slice(2);
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 function seed(){
   ev(`
     state.vocalists=[{id:'vJ',name:'Jake',isWL:true,leadsSongs:true,micAssigned:'Beta 58 #1'},
                      {id:'vS',name:'Sophia',isWL:false,leadsSongs:false,micAssigned:'Beta 58 #2'}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[2]='vJ'; state.assignments[3]='vS';
     state.instruments=[{id:'inst_drums',label:'Drums',tag:'Drums',assignedTo:'Sam'},
                        {id:'inst_eg1',label:'Electric',tag:'EG',assignedTo:'Carl'}];
     state.hosts={speaker:'Pastor Dave',welcomeHost1:'',welcomeHost2:'',hh3:'',hh3IsBaptismal:false};
     state.shadows=[{id:'sh1',name:'Riley',pack:'Misc 2'}];
     state.musicDirectorId=null;
     state.setupItems={};
     state.config.customStagePositions={ vocal_2:{x:400,y:120} };
     state.service={name:'Old Name',date:'2026-01-01'};
     state.serviceOrder=[{id:'so1',kind:'song',title:'Old Song'}];
   `);
 }

 const snapshot = () => ev(`JSON.stringify({
   vocalists:state.vocalists, assignments:state.assignments, instruments:state.instruments,
   hosts:state.hosts, shadows:state.shadows, musicDirectorId:state.musicDirectorId,
   setupItems:state.setupItems, customStagePositions:state.config.customStagePositions,
   service:state.service, serviceOrder:state.serviceOrder })`);

 check('8a) a throw mid-merge ROLLS BACK every mutated collection AND rethrows', ()=>{
   seed();
   const before = snapshot();
   // Force a throw partway: pcoRenamePerson runs AFTER removes/reslots/adds have already mutated.
   ev(`window.__origRename = pcoRenamePerson; window.pcoRenamePerson = function(){ throw new Error('boom'); };`);
   // A change-list that mutates a LOT before the rename throws: hard-remove Sophia, reslot Carl
   // eg->keys (creates a keys slot), decline Sam, add a vocalist — THEN rename (throws).
   const cl = {
     added:[{pcoId:'tmMia',name:'Mia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false}],
     declined:[{pcoId:'tmSam',name:'Sam',kind:'band',position:'drums'}],
     hardRemoved:[{pcoId:'tmSoph',name:'Sophia',kind:'vocalist'}],
     roleChanged:[{ from:{pcoId:'tmCarl',name:'Carl',kind:'band',position:'eg'},
                    to:{pcoId:'tmCarl',name:'Carl',kind:'band',position:'keys'} }],
     renamed:[{ from:{pcoId:'tmJ',name:'Jake',kind:'vocalist'}, to:{pcoId:'tmJ',name:'Jake Bloggs',kind:'vocalist'} }],
     serviceOrderChanged:true, metaChanged:true, hasChanges:true
   };
   const next = { meta:{title:'New Name',date:'2026-02-02'}, people:[], serviceOrder:[{id:'so2',kind:'song',title:'New Song'}] };
   let threw=false;
   try { ev(`applyPcoMerge(${JSON.stringify(cl)}, ${JSON.stringify(next)})`); }
   catch(e){ threw=true; }
   finally { ev(`window.pcoRenamePerson = window.__origRename;`); }
   if(!threw) throw new Error('applyPcoMerge swallowed the error — it must RETHROW so callers skip saveState');
   const after = snapshot();
   if(after !== before) throw new Error('state NOT rolled back after the throw.\n  BEFORE: '+before+'\n  AFTER:  '+after);
 });

 check('8b) success path is unchanged (no rollback when nothing throws)', ()=>{
   seed();
   const cl = { added:[], declined:[], hardRemoved:[{pcoId:'tmSoph',name:'Sophia',kind:'vocalist'}],
     roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
   ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
   if(/Sophia/.test(ev('state.vocalists.map(v=>v.name).join(",")'))) throw new Error('success path broken: Sophia not removed');
   if(ev("state.instruments.find(i=>i.id==='inst_drums').assignedTo")!=='Sam') throw new Error('success path over-mutated');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
