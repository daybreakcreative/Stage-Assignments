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
   renderAll=function(){}; toast=function(){};
   state.instruments=[
     {id:'inst_drums',label:'Drums',pack:'Drum Pack',placeholder:'Drummer',tag:'Drums',assignedTo:'Danny',vocalistPlayer:null,optional:false},
     {id:'inst_bass', label:'Bass', pack:'Bass Pack', placeholder:'Bass', tag:'Bass', assignedTo:'',      vocalistPlayer:null,optional:false},
     {id:'inst_keys', label:'Keys', pack:'Keys Pack', placeholder:'Keys', tag:'Keys', assignedTo:'Marcus',vocalistPlayer:null,optional:false},
     {id:'inst_eg1',  label:'Electric 1',pack:'EG Pack',placeholder:'EG1',tag:'EG',  assignedTo:'Petey', vocalistPlayer:null,optional:false}
   ];
   state.musicDirectorId='inst_keys';
   ensureVenueInstrumentSlots(state);
   var mid='v_meadow';
   state.venues[mid]=Object.assign({}, extractVenueFields(state), {id:mid,name:'Meadowlark',
     instrumentSlots:[
       {id:'inst_drums',label:'Drums',pack:'Drum Pack',placeholder:'Drummer',tag:'Drums',optional:false},
       {id:'inst_bass', label:'Bass', pack:'Bass Pack', placeholder:'Bass', tag:'Bass', optional:false},
       {id:'inst_synth',label:'Synth',pack:'Synth Pack',placeholder:'Synth',tag:'Keys',optional:false}
     ]});
   window.__cid=state.activeVenueId; window.__mid=mid;
 `);
 check('slot template excludes per-service fields (assignedTo / vocalistPlayer)', ()=>{
   const slots=ev('extractVenueFields(state).instrumentSlots');
   if(!Array.isArray(slots)) throw new Error('no slots');
   if(slots.some(s=>('assignedTo' in s)||('vocalistPlayer' in s))) throw new Error('assignment leaked into template');
   if(!slots.some(s=>s.id==='inst_keys')) throw new Error('keys missing from template');
 });
 check('switching rebuilds the band from the target venue slots', ()=>{
   ev('switchVenue(window.__mid)');
   const ids=ev('JSON.stringify(state.instruments.map(i=>i.id))');
   if(ids!==JSON.stringify(['inst_drums','inst_bass','inst_synth'])) throw new Error('band='+ids);
 });
 check('assignments carry across by slot id; new slots start empty', ()=>{
   if(ev("state.instruments.find(i=>i.id==='inst_drums').assignedTo")!=='Danny') throw new Error('drums not carried');
   if(ev("state.instruments.find(i=>i.id==='inst_synth').assignedTo")!=='') throw new Error('synth not empty');
 });
 check('music director resets when its slot is absent in the venue', ()=>{
   if(ev('state.musicDirectorId')!==null) throw new Error('MD not reset: '+ev('state.musicDirectorId'));
 });
 check('switching back restores the original slot set; dropped-slot assignments do not resurrect', ()=>{
   ev('switchVenue(window.__cid)');
   const ids=ev('JSON.stringify(state.instruments.map(i=>i.id))');
   if(ids!==JSON.stringify(['inst_drums','inst_bass','inst_keys','inst_eg1'])) throw new Error('band='+ids);
   if(ev("state.instruments.find(i=>i.id==='inst_drums').assignedTo")!=='Danny') throw new Error('drums lost on return');
   if(ev("state.instruments.find(i=>i.id==='inst_keys').assignedTo")!=='') throw new Error('keys should be empty (was dropped at Meadowlark)');
 });
 check('migration backfills instrumentSlots on venues lacking them', ()=>{
   ev('state.venues["v_nofill"]={id:"v_nofill",name:"NoFill"}; ensureVenueInstrumentSlots(state);');
   if(!Array.isArray(ev('state.venues["v_nofill"].instrumentSlots'))) throw new Error('not backfilled');
   if(ev('state.venues["v_nofill"].instrumentSlots.length')===0) throw new Error('backfill empty');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
