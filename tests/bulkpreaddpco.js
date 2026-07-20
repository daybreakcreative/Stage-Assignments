// FEATURE: Bulk pre-add — Phase 2 (PCO-linked). "Bulk add regulars (last 6 months)" walks past
// plans' team_members → deduped grid rows; the name field searches PCO people; a tracks-only MD
// becomes an MD row with an on/off-stage choice. Pure aggregator is unit-tested; pcoFetch stubbed.
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
async function checkA(l,f){try{await f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(async ()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 check('bulkRowsFromPcoTeamData: per-role rows, isMD, md-only, skips, dedupe', ()=>{
   const members=JSON.stringify([
     {name:'Ava Chen',position:'Vocals'},
     {name:'Ava Chen',position:'Worship Leader'},
     {name:'Pat Reed',position:'Keys'},
     {name:'Pat Reed',position:'Music Director'},
     {name:'Jo Vane',position:'Bass'},
     {name:'Sam Fox',position:'Acoustic Guitar'},
     {name:'Dana Lee',position:'Music Director'},
     {name:'Nope',position:'Video Host'}
   ]);
   const rows=JSON.parse(ev(`JSON.stringify(bulkRowsFromPcoTeamData(${members}, []))`));
   const byName=n=>rows.filter(r=>r.name===n);
   if(byName('Ava Chen').length!==1||byName('Ava Chen')[0].role!=='vocalist') throw new Error('Ava should be 1 vocalist row');
   const pat=byName('Pat Reed');
   const patBand=pat.find(r=>r.role==='band'); const patMd=pat.find(r=>r.role==='md');
   if(!patBand||patBand.typeKey!=='keys') throw new Error('Pat should have a band/keys row: '+JSON.stringify(pat));
   if(!patMd||patMd.onStage!==true) throw new Error('Pat should ALSO have a standalone md row (onStage true): '+JSON.stringify(pat));
   if(pat.some(r=>r.isMD)) throw new Error('no row should carry isMD anymore: '+JSON.stringify(pat));
   if(byName('Jo Vane')[0].typeKey!=='bass') throw new Error('Jo bass');
   if(byName('Sam Fox')[0].typeKey!=='ag') throw new Error('Sam ag');
   const dana=byName('Dana Lee'); if(dana.length!==1||dana[0].role!=='md'||dana[0].onStage!==true) throw new Error('Dana should be an md-only row, onStage true: '+JSON.stringify(dana));
   if(byName('Nope').length!==0) throw new Error('Video Host should be skipped');
 });

 check('a vocalist who was also MD is NOT flagged MD — MD becomes its own row', ()=>{
   const members=JSON.stringify([{name:'Val Singer',position:'Vocals'},{name:'Val Singer',position:'Music Director'}]);
   const rows=JSON.parse(ev(`JSON.stringify(bulkRowsFromPcoTeamData(${members}, []))`));
   const voc=rows.find(r=>r.name==='Val Singer'&&r.role==='vocalist');
   if(!voc) throw new Error('vocalist row missing');
   if(voc.isMD) throw new Error('vocalist row must NOT be flagged isMD');
   if(!rows.some(r=>r.name==='Val Singer'&&r.role==='md')) throw new Error('a tracks-only MD row should be added instead');
 });

 check('bulkRowsFromPcoTeamData dedupes against existing grid keys', ()=>{
   const members=JSON.stringify([{name:'Jo Vane',position:'Bass'},{name:'New Guy',position:'Drums'}]);
   const existing=JSON.stringify([ev(`(normFullName('Jo Vane'))`)+'|band|bass']);
   const rows=JSON.parse(ev(`JSON.stringify(bulkRowsFromPcoTeamData(${members}, ${existing}))`));
   if(rows.some(r=>r.name==='Jo Vane')) throw new Error('Jo should be deduped out');
   if(!rows.some(r=>r.name==='New Guy')) throw new Error('New Guy should remain');
 });

 // ---- regulars fetch (pcoFetch stubbed) ----
 function stubPco(){
   ev(`pcoTokens={access_token:'x',expires_at:Date.now()+1e6}; state.pcoConfig.selectedServiceTypeId='st1';`);
   ev(`window.__calls=[]; window.pcoFetch=function(path){
     window.__calls.push(path);
     var now=Date.now();
     var recent=new Date(now-10*86400000).toISOString();
     var old=new Date(now-300*86400000).toISOString();
     if(/\\/plans\\?/.test(path)) return Promise.resolve({data:[
       {id:'p1',attributes:{sort_date:recent}},
       {id:'p2',attributes:{sort_date:recent}},
       {id:'p3',attributes:{sort_date:old}}
     ],links:{}});
     if(/plans\\/p1\\/team_members/.test(path)) return Promise.resolve({data:[
       {attributes:{name:'Ava Chen',team_position_name:'Vocals',status:'C'}},
       {attributes:{name:'Pat Reed',team_position_name:'Keys',status:'C'}},
       {attributes:{name:'Pat Reed',team_position_name:'Music Director',status:'C'}},
       {attributes:{name:'Jo Vane',team_position_name:'Bass',status:'C'}}
     ]});
     if(/plans\\/p2\\/team_members/.test(path)) return Promise.resolve({data:[
       {attributes:{name:'Sam Fox',team_position_name:'Acoustic Guitar',status:'C'}},
       {attributes:{name:'Dana Lee',team_position_name:'Music Director',status:'C'}},
       {attributes:{name:'Declined Person',team_position_name:'Bass',status:'D'}}
     ]});
     if(/plans\\/p3\\/team_members/.test(path)) return Promise.resolve({data:[{attributes:{name:'TooOld',team_position_name:'Bass',status:'C'}}]});
     return Promise.resolve({data:[]});
   };`);
 }

 await checkA('fetchPcoRegulars: scans in-window plans, adds deduped rows, skips old plan + declined', async ()=>{
   stubPco();
   ev('openBulkPreadd();');
   await ev('fetchPcoRegulars()');
   const names=JSON.parse(ev(`JSON.stringify(bulkPeople.map(x=>x.name).sort())`));
   if(JSON.stringify(names)!==JSON.stringify(['Ava Chen','Dana Lee','Jo Vane','Pat Reed','Sam Fox'])) throw new Error('rows wrong: '+JSON.stringify(names));
   if(ev(`bulkPeople.some(x=>x.name==='TooOld')`)) throw new Error('old plan should not be scanned');
   if(ev(`bulkPeople.some(x=>x.name==='Declined Person')`)) throw new Error('declined member should be skipped');
   if(!ev(`window.__calls.some(p=>/plans\\/p3\\/team_members/.test(p))`)===false) {/* p3 tm not fetched */}
   if(ev(`window.__calls.some(p=>/plans\\/p3\\/team_members/.test(p))`)) throw new Error('should not fetch team_members for the >6mo plan');
 });

 check('MD-only row: on/off-stage select shown; Save stores onStage on the |md marker', ()=>{
   ev(`state.setupItems={}; state.musicianPreferences={};`);
   ev(`openBulkPreadd(); var pid=addBulkPerson({name:'Dana Lee'}); addBulkRow({pid,name:'Dana Lee',role:'md',onStage:true,open:true}); renderBulkPreadd();`);
   const stage=doc.querySelector('#bulkPreaddModal .bulk-pos .bulk-md-stage'); if(!stage) throw new Error('no on/off-stage select on md row');
   stage.value='off'; stage.dispatchEvent(new window.Event('change',{bubbles:true}));
   ev('commitBulkPreadd();');
   const marker=JSON.parse(ev(`JSON.stringify(state.musicianPreferences['dana lee|md']||null)`));
   if(!marker) throw new Error('no |md marker written');
   if(marker.onStage!==false) throw new Error('onStage not stored as false: '+JSON.stringify(marker));
 });

 await checkA('people-search: typing yields a PCO dropdown; selecting sets the canonical name', async ()=>{
   ev(`pcoTokens={access_token:'x',expires_at:Date.now()+1e6};`);
   ev(`window.pcoFetch=function(path){ if(/people/.test(path)) return Promise.resolve({data:[{id:'ppl1',attributes:{name:'Avaline Chen'}},{id:'ppl2',attributes:{name:'Ava Reed'}}]}); return Promise.resolve({data:[]}); };`);
   ev('openBulkPreadd(); var pid=addBulkPerson(); renderBulkPreadd();');
   await ev(`bulkPeopleSearch(bulkPeople[0],'Ava')`);
   const results=doc.querySelectorAll('#bulkPreaddModal .bulk-name-result');
   if(results.length!==2) throw new Error('expected 2 people results, got '+results.length);
   results[0].dispatchEvent(new window.Event('click',{bubbles:true}));
   if(ev('bulkPeople[0].name')!=='Avaline Chen') throw new Error('select did not set canonical name: '+ev('bulkPeople[0].name'));
 });

 check('regulars button is disabled without PCO connected', ()=>{
   ev(`pcoTokens=null;`);
   ev('openBulkPreadd();');
   const btn=doc.getElementById('bulkRegulars'); if(!btn) throw new Error('no regulars button');
   if(!btn.disabled) throw new Error('regulars button should be disabled without PCO');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
