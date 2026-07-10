// FIX #7 — a PCO reslot must NOT silently DROP a drums/bass player, and a
// failed add must NOT be reported as "added". drums/bass have a single slot
// and are NOT in pcoAddBand's ALLOW auto-create set.
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
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 // Fixture: a single drums slot occupied by "Sam", plus an EG slot with "Carl".
 // Reslot Carl (eg → drums). drums has ONE slot, occupied → cannot place. Carl must NOT vanish.
 function seedOccupiedDrums(){
   ev(`state.instruments=[
        {id:'inst_drums',label:'Drums',tag:'Drums',assignedTo:'Sam'},
        {id:'inst_eg1',label:'Electric',tag:'EG',assignedTo:'Carl'}
      ];
      state.config.customStagePositions={};
      pcoMergeNotices={needs:[],fyi:[]};`);
 }

 check('7a) reslot to an occupied single (drums) slot does NOT drop the person', ()=>{
   seedOccupiedDrums();
   const cl={ added:[], declined:[], hardRemoved:[],
     roleChanged:[{ from:{pcoId:'tmC',name:'Carl',kind:'band',position:'eg'},
                    to:{pcoId:'tmC',name:'Carl',kind:'band',position:'drums'} }],
     renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
   ev(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
   // Carl must still be present somewhere (rolled back to his EG slot).
   const stillHasCarl = ev(`state.instruments.some(i=>i.assignedTo==='Carl')`);
   if(!stillHasCarl) throw new Error('Carl was SILENTLY DROPPED on a failed reslot');
   // Sam must still hold drums (occupied slot never overwritten).
   if(ev(`state.instruments.find(i=>i.id==='inst_drums').assignedTo`)!=='Sam') throw new Error('Sam lost the drums slot');
 });
 check('7b) a failed reslot surfaces a distinct "couldn\'t move" notice (not silence)', ()=>{
   const notices = J('pcoMergeNotices');
   const all = [...notices.needs, ...notices.fyi].map(n=>n.text).join(' || ');
   if(!/could(n.?t| not)\s+move/i.test(all)) throw new Error('no "couldn\'t move" notice produced: '+all);
   if(!/Carl/.test(all)) throw new Error('notice does not name Carl: '+all);
 });
 check('7c) a failed ADD (2nd drummer, no free slot) is NOT reported as "added"', ()=>{
   ev(`state.instruments=[{id:'inst_drums',label:'Drums',tag:'Drums',assignedTo:'Sam'}];
       pcoMergeNotices={needs:[],fyi:[]};`);
   const cl={ added:[{pcoId:'tmD',name:'Duke',kind:'band',position:'drums',host:'',isWL:false,leadsSongs:false}],
     declined:[], hardRemoved:[], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true };
   const res = J(`applyPcoMerge(${JSON.stringify(cl)}, {meta:{},people:[],serviceOrder:[]})`);
   // Simulate the real orchestration: pcoMergeRefresh calls pcoMergeNotify after applyPcoMerge,
   // passing along any failed-add ids so the generic "added" line is suppressed for them.
   const failedIds = (res && res.failedAddIds) || [];
   ev(`pcoMergeNotify(${JSON.stringify(cl)}, ${JSON.stringify(failedIds)})`);
   const notices = J('pcoMergeNotices');
   const texts = [...notices.needs, ...notices.fyi].map(n=>n.text);
   const joined = texts.join(' || ');
   // Duke could not be placed (drums not auto-created) → must NOT say "Duke added"
   if(/Duke added/.test(joined)) throw new Error('LIED: banner says "Duke added" for an unplaced person: '+joined);
   if(!/Duke.*(could not be placed|couldn.?t be placed|no free)/i.test(joined)) throw new Error('no honest "could not be placed" notice for Duke: '+joined);
 });
 check('7d) baseline sanity — pcoMergeNotify still emits the generic "added" line for a PLACED add (1-arg call)', ()=>{
   ev(`pcoMergeNotices={needs:[],fyi:[]};`);
   ev(`pcoMergeNotify({added:[{pcoId:'tmM',name:'Mia',kind:'vocalist'}], declined:[], hardRemoved:[], roleChanged:[], renamed:[], serviceOrderChanged:false, metaChanged:false, hasChanges:true})`);
   const joined = J('pcoMergeNotices').needs.map(n=>n.text).join(' || ');
   if(!/Mia added/.test(joined)) throw new Error('generic added line regressed for a normal add: '+joined);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
