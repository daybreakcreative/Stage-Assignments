const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 // helper: flatten all people across getStageAreas() into a single list
 const areaPeople = () => ev(`getStageAreas().reduce((acc,a)=>{a.people.forEach(p=>acc.push({name:p.name,key:p.key,typeKey:p.typeKey,role:p.role,instLabel:p.instLabel||null})); return acc;},[])`);
 const enumRoles = () => ev(`enumerateSetupRoles().map(r=>({name:r.name,role:r.role,typeKey:r.typeKey,stableKey:r.stableKey,label:r.label}))`);

 console.log('--- MD who plays Keys: MD entry AND Keys entry both present ---');
 check('getStageAreas has both a Keys band entry and an MD entry for the MD keys player', ()=>{
   ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
   ev(`state.instruments=[{id:'inst_keys_a',label:'Keys',tag:'Keys',assignedTo:'Pat Reed'}];`);
   ev(`state.musicDirectorId='inst_keys_a';`);
   const people = areaPeople();
   const mine = people.filter(p=>/pat reed/.test(p.key));
   const keysEntry = mine.find(p=>p.typeKey==='keys');
   const mdEntry = mine.find(p=>p.typeKey==='md');
   if (!keysEntry) throw new Error('no keys entry: '+JSON.stringify(mine));
   if (!mdEntry) throw new Error('no md entry: '+JSON.stringify(mine));
   if (!/\|md\|md$/.test(mdEntry.key)) throw new Error('md key not name|md|md: '+mdEntry.key);
   if (mdEntry.instLabel !== 'MD') throw new Error('md entry instLabel not MD: '+JSON.stringify(mdEntry));
 });
 check('enumerateSetupRoles has both keys and md entries for MD keys player', ()=>{
   const rows = enumRoles();
   const mine = rows.filter(r=>/pat reed/.test(r.stableKey));
   if (!mine.some(r=>r.typeKey==='keys')) throw new Error('no keys role: '+JSON.stringify(mine));
   const md = mine.find(r=>r.typeKey==='md' && r.role==='md');
   if (!md) throw new Error('no md role: '+JSON.stringify(mine));
   if (md.label !== 'MD') throw new Error('md label not MD');
 });

 console.log('--- MD who runs Tracks: exactly ONE md bucket, no separate |md|md ---');
 check('getStageAreas emits exactly one typeKey==md entry for a tracks MD', ()=>{
   ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
   ev(`state.instruments=[{id:'inst_tracks',label:'Tracks',tag:'Tracks',assignedTo:'Jo Vane'}];`);
   ev(`state.musicDirectorId='inst_tracks';`);
   const people = areaPeople();
   const mine = people.filter(p=>/jo vane/.test(p.key));
   const mdEntries = mine.filter(p=>p.typeKey==='md');
   if (mdEntries.length !== 1) throw new Error('expected exactly one md entry, got '+mdEntries.length+': '+JSON.stringify(mine));
   // the single md entry should be the instrument (band) entry, not a separate |md|md
   if (mine.some(p=>/\|md\|md$/.test(p.key))) throw new Error('unexpected separate |md|md bucket: '+JSON.stringify(mine));
   if (mdEntries[0].role !== 'band') throw new Error('the single md entry should be the band/instrument entry: '+JSON.stringify(mdEntries[0]));
 });
 check('enumerateSetupRoles emits exactly one typeKey==md entry for a tracks MD', ()=>{
   const rows = enumRoles();
   const mine = rows.filter(r=>/jo vane/.test(r.stableKey));
   const mdEntries = mine.filter(r=>r.typeKey==='md');
   if (mdEntries.length !== 1) throw new Error('expected exactly one md entry, got '+mdEntries.length+': '+JSON.stringify(mine));
   if (mine.some(r=>/\|md\|md$/.test(r.stableKey))) throw new Error('unexpected separate |md|md bucket: '+JSON.stringify(mine));
 });

 console.log('--- MD md bucket seeds from church md defaults & catalog resolves ---');
 check('MD keys player md bucket has items seeded and md catalog option text present', ()=>{
   ev(`state.setupItems={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];`);
   ev(`state.instruments=[{id:'inst_keys_b',label:'Keys',tag:'Keys',assignedTo:'Sky Fox'}];`);
   ev(`state.musicDirectorId='inst_keys_b';`);
   areaPeople(); // triggers seeding of buckets
   const mdKey = ev(`stableSetupKey('Sky Fox','md','md')`);
   const bucket = ev(`state.setupItems[${JSON.stringify(mdKey)}]`);
   if (!bucket) throw new Error('md bucket not seeded');
   if (!bucket.seeded) throw new Error('md bucket not marked seeded');
   // an md catalog option text should be resolvable
   const cat = ev(`JSON.stringify((setupCatalogFor('md').groups||[]).flatMap(g=>g.options.map(o=>o.text)))`);
   if (!/House tracks computer|Talkback mic/.test(cat)) throw new Error('md catalog missing expected options: '+cat);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
