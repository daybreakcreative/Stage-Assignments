// Dillon's answers of 2026-10-01 on "set up items is a big mess" (bug_34d61961):
//   2. "implied only" — a RADIO choice ("User bringing keyboard", "House bass rig") describes a
//      configuration, not a task; it stops printing its own text and emits only the lines it
//      implies (the DI box, the adapter). A CHECK item ("Needs talkback mic") IS the task and keeps
//      printing. His export held 10 removal records, all from fighting radio texts one at a time.
//   3. "your recommendation" on the 7 legacy `<name>|band|none` buckets → delete. They were minted
//      by an old build, hold MD lines under a nonsense key, and produced a false lead on 09-30.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const texts=(key,sel,ci)=>JSON.parse(ev(`JSON.stringify(resolveSetupItems(${JSON.stringify(key)},${JSON.stringify(sel)},${JSON.stringify(ci||[])}).map(i=>i.text))`));

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){}; state.config.setupCatalog=null;');

 console.log('--- 2. a radio CHOICE prints only what it implies ---');

 check('eg "Stereo guitar rig" (radio) emits its three implied lines and NOT its own text', ()=>{
   const t=texts('eg',{rig:'eg_stereo'});
   if(t.indexOf('Stereo guitar rig')!==-1) throw new Error('radio choice still prints itself: '+JSON.stringify(t));
   ['Stereo DI box','Amp & mic setup (stereo)','2 XLRs for player EG rig'].forEach(x=>{ if(t.indexOf(x)===-1) throw new Error('implied line missing: '+x+' in '+JSON.stringify(t)); });
 });

 check('keys "User Bringing Keyboard" (radio, no implied lines) emits NOTHING — the line Dillon kept deleting', ()=>{
   const t=texts('keys',{source:'k_user_kbd'});
   if(t.length!==0) throw new Error('expected empty, got '+JSON.stringify(t));
 });

 check('keys "2 stereo inputs" (radio, no implied lines) emits nothing either', ()=>{
   const t=texts('keys',{inputs:'k_in2'});
   if(t.indexOf('2 stereo inputs')!==-1) throw new Error('radio text printed: '+JSON.stringify(t));
 });

 check('a CHECK item still prints its own text — it IS the task', ()=>{
   const t=texts('bass',{extras:['b_talk','b_stand']});
   if(t.indexOf('Needs talkback mic')===-1||t.indexOf('Guitar stand')===-1) throw new Error('check items lost: '+JSON.stringify(t));
 });

 check('a CHECK item with implied lines prints both its text and the implied lines', ()=>{
   const t=texts('keys',{cabling:['k_di']});
   if(t.indexOf("Stereo DI/DIs & 1/4\" cables")===-1) throw new Error('check text missing: '+JSON.stringify(t));
 });

 check('drums (check-only catalog) is unchanged — every chosen option still prints', ()=>{
   const t=texts('drums',{options:['d_housesnare','d_sticks']});
   if(t.join('|')!=='House snare|Needs drum sticks') throw new Error(JSON.stringify(t));
 });

 check('a per-person removal (`replaces`) still suppresses an implied line', ()=>{
   const t=texts('eg',{rig:'eg_stereo'},[{id:'r1',text:'',replaces:'Stereo DI box'}]);
   if(t.indexOf('Stereo DI box')!==-1) throw new Error('removal ignored: '+JSON.stringify(t));
   if(t.indexOf('Amp & mic setup (stereo)')===-1) throw new Error('sibling implied line lost');
 });

 check('a plain custom item still renders', ()=>{
   const t=texts('eg',{rig:'eg_house'},[{id:'c1',text:'Bring the pedalboard'}]);
   if(t.indexOf('Bring the pedalboard')===-1) throw new Error(JSON.stringify(t));
 });

 console.log('--- 3. legacy |band|none buckets are swept on load ---');

 check('repairSetupBuckets deletes a <name>|band|none bucket and counts it', ()=>{
   ev(`state.setupItems={
     'pat player|band|none':{selections:{},customItems:[],seeded:true,items:[{id:'x',text:'House tracks computer',doneThisService:false,scopeOneTime:false}]},
     'pat player|band|keys':{selections:{source:'k_house'},customItems:[],seeded:true,items:[]},
     'sam singer|vocalist|vocals':{selections:{},customItems:[],seeded:true,items:[]} };
     window.__n=repairSetupBuckets();`);
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.setupItems))'));
   if(keys.some(k=>/\|none$/.test(k))) throw new Error('|none bucket survived: '+JSON.stringify(keys));
   if(keys.length!==2) throw new Error('wrong buckets left: '+JSON.stringify(keys));
   if(ev('__n')<1) throw new Error('sweep not counted');
 });

 check('the sweep touches ONLY |band|none — real buckets and vocalist buckets are untouched', ()=>{
   ev(`state.setupItems={
     'a|band|none':{selections:{},customItems:[],items:[]},
     'a|band|bass':{selections:{rig:'b_house'},customItems:[{id:'c',text:'keep me'}],items:[]},
     'a|vocalist|vocals':{selections:{},customItems:[],items:[]},
     'a|md|md':{selections:{rig:['md_tracks']},customItems:[],items:[]} };
     repairSetupBuckets();`);
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.setupItems).sort())'));
   if(keys.join(',')!=='a|band|bass,a|md|md,a|vocalist|vocals') throw new Error(JSON.stringify(keys));
   if(ev(`state.setupItems['a|band|bass'].customItems[0].text`)!=='keep me') throw new Error('sibling bucket was altered');
 });

 check('the sweep is a no-op on clean data', ()=>{
   ev(`state.setupItems={'a|band|bass':{selections:{},customItems:[],items:[]}}; window.__n=repairSetupBuckets();`);
   if(ev('__n')!==0) throw new Error('reported '+ev('__n')+' fixes on clean data');
 });

 console.log('--- the legacy migration no longer MINTS |none on every boot ---');
 // Found 2026-10-01 with a Proxy trap on Dillon's export: migrateLegacySetupBuckets folds old
 // `name|<instrumentId>` keys by looking the id up in THIS WEEK's instruments; three ids from a past
 // band no longer resolve, so typeKey came back null and the bucket was re-keyed to `|band|none` —
 // on every single load, after the repair had already swept them. The source of the debris.

 check('an old-shape bucket keyed by a DEAD instrument id is deleted, not re-keyed to |none', ()=>{
   ev(`state.instruments=[{id:'inst_keys',label:'Keys',assignedTo:'Pat Player',pack:'Keys',tag:'Keys'}];
       state.setupItems={'pat player|inst_gone_xyz':{items:[{id:'a',text:'House tracks computer'}]}};
       migrateLegacySetupBuckets();`);
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.setupItems))'));
   if(keys.some(k=>/\|none$/.test(k))) throw new Error('re-keyed to |none: '+JSON.stringify(keys));
   if(keys.length!==0) throw new Error('dead-instrument bucket survived: '+JSON.stringify(keys));
 });

 check('an old-shape bucket keyed by a LIVE instrument id still migrates to the right type', ()=>{
   ev(`state.instruments=[{id:'inst_keys',label:'Keys',assignedTo:'Pat Player',pack:'Keys',tag:'Keys'}];
       state.setupItems={'pat player|inst_keys':{items:[{id:'a',text:'Laptop stand'}]}};
       migrateLegacySetupBuckets();`);
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.setupItems))'));
   if(keys.join()!=='pat player|band|keys') throw new Error(JSON.stringify(keys));
 });

 check('old vocal / shadow / tag: shapes still migrate as before', ()=>{
   ev(`state.instruments=[];
       state.setupItems={'a|vocal':{items:[]},'b|shadow':{items:[]},'c|tag:Drums':{items:[]}};
       migrateLegacySetupBuckets();`);
   const keys=JSON.parse(ev('JSON.stringify(Object.keys(state.setupItems).sort())'));
   // `b|shadow` is already a stable key to this migration (shadow is in ROLES) and is left alone.
   if(keys.join()!=='a|vocalist|vocals,b|shadow,c|band|drums') throw new Error(JSON.stringify(keys));
 });

 console.log('--- cached items follow the new rule without an editor visit ---');

 check('after boot repair, a bucket\'s cached items equal a fresh resolve (no stale radio texts)', ()=>{
   ev(`state.instruments=[{id:'inst_keys',label:'Keys',assignedTo:'Pat Player',pack:'Keys',tag:'Keys'}];
       state.vocalists=[]; state.assignments=new Array(8).fill(null); state.musicDirectorId=null; state.shadows=[];
       const k=stableSetupKey('Pat Player','band','keys');
       // a pre-change cache: the radio text is sitting in items as if the old rule wrote it
       state.setupItems={}; state.setupItems[k]={selections:{source:'k_user_kbd',soundsfrom:'k_dante'},customItems:[],seeded:true,
         items:[{id:'1',text:'User Bringing Keyboard',doneThisService:false,scopeOneTime:false},
                {id:'2',text:'User computer via Dante',doneThisService:false,scopeOneTime:false},
                {id:'3',text:'Needs network — thunderbolt adapter',doneThisService:false,scopeOneTime:false}]};
       window.__k=k; bootRepairSetupItems();`);
   const cached=JSON.parse(ev('JSON.stringify(state.setupItems[__k].items.map(i=>i.text))'));
   const fresh=JSON.parse(ev('JSON.stringify(resolveSetupItems("keys",state.setupItems[__k].selections,state.setupItems[__k].customItems).map(i=>i.text))'));
   if(cached.indexOf('User Bringing Keyboard')!==-1) throw new Error('stale radio text still cached: '+JSON.stringify(cached));
   if(cached.slice().sort().join('|')!==fresh.slice().sort().join('|')) throw new Error('cache != resolve: '+JSON.stringify([cached,fresh]));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
