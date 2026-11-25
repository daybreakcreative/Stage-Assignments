// 2026-11-25 — the second half of "pulling random people for positions, putting wrong people in
// wrong positions". Since 2026-07-01 ANY inline edit of a name (a vocalist card, a band slot) was
// recorded as a permanent "goes by" alias: official PCO name → whatever was typed. That is right for
// "Santiago Sandez" → "Santi". It is wrong for the thing operators do every Sunday: a singer is out,
// so you type the SUBSTITUTE's name over hers. From then on every pull that scheduled her showed the
// substitute — in her slot, with her headshot, holding her setup items and mic preference — and if
// both were on the plan one of them vanished. Nothing in the app listed these aliases or let you
// remove one; the only undo was to type the official name back into a field that no longer showed it.
// Now: an inline edit is an alias only when the new name plausibly belongs to the SAME person;
// otherwise it is a swap for this service. Aliases already recorded that point one person at another
// are set aside on load (not deleted), and Advanced Settings → Planning Center lists every
// remembered name with Remove / Restore.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
const mk=list=>({data:list.map(([name,pos,id],i)=>({id:id||('x'+i),attributes:{name,team_position_name:pos,status:'C'}}))});

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(m){window.__toast=m;};saveState=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};');
 const fresh=()=>ev(`state._firstRun=false; state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); state.nameAliases={}; state.nameAliasMeta={confirmed:{},setAside:{}};
   state.setupItems={}; state.musicianPreferences={}; state.peoplePhotos={}; state.config.micPrefs={leaderMics:[],people:{}}; state.config.vocalPins={}; state.musicDirectorId=null; state.pcoBaseline=null; window.__toast='';`);
 const PLAN=[['Kay Able','Vocals','p1'],['Wes Lead','Worship Leader','p2'],['Kim Keys','Keys','p3'],['Dee Drum','Drums','p4']];
 const pull=list=>{ window.__tm=mk(list); ev(`applyPCOPlanData({attributes:{}}, window.__tm, {data:[],included:[]})`); };
 const vocNames=()=>J('state.vocalists.map(v=>v.name)');
 const typeOverVocalist=(from,to)=>{ ev('renderVocalists()');
   const id=ev(`(state.vocalists.find(v=>v.name===${JSON.stringify(from)})||{}).id`);
   const inp=doc.querySelector(`.voc-name[data-id="${id}"]`); if(!inp) throw new Error('no name input for '+from);
   inp.dispatchEvent(new window.Event('focus')); inp.value=to;
   inp.dispatchEvent(new window.Event('input',{bubbles:true})); inp.dispatchEvent(new window.Event('change',{bubbles:true})); };
 const typeOverBand=(instId,to)=>{ ev('renderBand()');
   const inp=doc.querySelector(`input[data-inst-id="${instId}"]`); if(!inp) throw new Error('no band input '+instId);
   inp.dispatchEvent(new window.Event('focus')); inp.value=to;
   inp.dispatchEvent(new window.Event('input',{bubbles:true})); inp.dispatchEvent(new window.Event('change',{bubbles:true})); };

 console.log('--- a substitute typed over a scheduled person is a swap for THIS service ---');
 check('vocalist: typing "Hana Other" over "Kay Able" records NO alias, and next week Kay is Kay again', ()=>{
   fresh(); pull(PLAN); typeOverVocalist('Kay Able','Hana Other');
   if(vocNames().indexOf('Hana Other')===-1) throw new Error('the swap itself did not take: '+JSON.stringify(vocNames()));
   if(Object.keys(J('state.nameAliases')).length) throw new Error('alias recorded: '+JSON.stringify(J('state.nameAliases')));
   pull(PLAN);
   const v=vocNames(); if(v.indexOf('Kay Able')===-1||v.indexOf('Hana Other')!==-1) throw new Error('next pull shows '+JSON.stringify(v));
 });
 check('band: typing "Lou Other" over the Keys player records NO alias, and next week Kim is on Keys again', ()=>{
   fresh(); pull(PLAN); typeOverBand('inst_keys','Lou Other');
   if(Object.keys(J('state.nameAliases')).length) throw new Error('alias recorded: '+JSON.stringify(J('state.nameAliases')));
   pull(PLAN);
   if(ev(`instById('inst_keys').assignedTo`)!=='Kim Keys') throw new Error('Keys shows '+ev(`instById('inst_keys').assignedTo`));
 });
 check('the swap tells the operator what it did', ()=>{
   fresh(); pull(PLAN); typeOverVocalist('Kay Able','Hana Other');
   const t=ev('window.__toast'); if(!/Hana Other/.test(t)||!/Kay Able/.test(t)) throw new Error('toast: '+t);
 });
 check('the scheduled person keeps her setup items and mic preference; they are not handed to the substitute', ()=>{
   fresh(); pull(PLAN);
   ev(`enumerateSetupRoles(); const k=stableSetupKey('Kay Able','vocalist','vocals'); state.setupItems[k].customItems=[{id:'c1',text:'Her own stool'}]; rebuildPersonItems(k,'vocals'); setMicRemembered('Kay Able','KMS105');`);
   typeOverVocalist('Kay Able','Hana Other');
   if(!ev(`!!state.setupItems[stableSetupKey('Kay Able','vocalist','vocals')]`)) throw new Error('her setup bucket was re-keyed away');
   const sub=J(`(state.setupItems[stableSetupKey('Hana Other','vocalist','vocals')]||{items:[]}).items.map(i=>i.text)`);
   if(sub.indexOf('Her own stool')!==-1) throw new Error('substitute inherited her custom item');
   if(!ev(`!!micPrefFor('Kay Able')`)||ev(`(micPrefFor('Hana Other')||{}).remembered`)==='KMS105') throw new Error('mic preference moved to the substitute');
 });
 check('a family member (same surname) is a different person: "Sal Sandez" over "Mel Sandez"', ()=>{
   fresh(); pull([['Mel Sandez','Vocals'],['Dee Drum','Drums']]); typeOverVocalist('Mel Sandez','Sal Sandez');
   if(Object.keys(J('state.nameAliases')).length) throw new Error(JSON.stringify(J('state.nameAliases')));
 });
 check('same first name, different surname is a different person: "Nico Beta" over "Nico Alpha"', ()=>{
   fresh(); pull([['Nico Alpha','Electric Guitar'],['Dee Drum','Drums']]); typeOverBand('inst_eg1','Nico Beta');
   if(Object.keys(J('state.nameAliases')).length) throw new Error(JSON.stringify(J('state.nameAliases')));
 });
 check('a first name that belongs to ANOTHER known person is that person, not a nickname: "Chris" over "Christina Lee" when Chris Vance is a regular', ()=>{
   fresh(); ev(`state.config.micPrefs.people['chris vance']={remembered:'SM58'}`);
   pull([['Christina Lee','Vocals'],['Dee Drum','Drums']]); typeOverVocalist('Christina Lee','Chris');
   if(Object.keys(J('state.nameAliases')).length) throw new Error(JSON.stringify(J('state.nameAliases')));
 });

 console.log('--- a real "goes by" name is still remembered ---');
 const expectAlias=(official,goesBy,pos)=>{ fresh(); pull([[official,pos||'Vocals'],['Dee Drum','Drums']]);
   if((pos||'Vocals')==='Vocals') typeOverVocalist(official,goesBy); else typeOverBand('inst_keys',goesBy);
   const a=J('state.nameAliases'); if(a[official.toLowerCase()]!==goesBy) throw new Error(official+' → '+goesBy+' not remembered: '+JSON.stringify(a));
   pull([[official,pos||'Vocals'],['Dee Drum','Drums']]);
   const shown=(pos||'Vocals')==='Vocals'?vocNames():[ev(`instById('inst_keys').assignedTo`)];
   if(shown.indexOf(goesBy)===-1) throw new Error('next pull did not apply it: '+JSON.stringify(shown)); };
 check('"Santiago Sandez" → "Santi"', ()=>expectAlias('Santiago Sandez','Santi'));
 check('"Benjamin Mueller" → "Ben" (band slot)', ()=>expectAlias('Benjamin Mueller','Ben','Keys'));
 check('"Catherine Smith" → "Cathy Smith" (different ending, same surname)', ()=>expectAlias('Catherine Smith','Cathy Smith'));
 check('"Priscilla San Vicente" → "Priscilla S."', ()=>expectAlias('Priscilla San Vicente','Priscilla S.'));
 check('"Elizabeth Stone" → "Liz"', ()=>expectAlias('Elizabeth Stone','Liz'));
 check('"Christina Lee" → "Chris" when nobody else is called Chris', ()=>expectAlias('Christina Lee','Chris'));
 check('the post-pull "goes by" field is an explicit answer: even an unrelated nickname is kept, and marked confirmed', ()=>{
   fresh(); ev(`setPreferredName('Robert Jones','Bob',{confirmed:true})`);
   if(ev(`state.nameAliases['robert jones']`)!=='Bob') throw new Error('not recorded');
   if(!ev(`!!state.nameAliasMeta.confirmed['robert jones']`)) throw new Error('not marked confirmed');
 });

 console.log('--- aliases already recorded that point one person at another are set aside on load ---');
 check('bootRepairNameAliases sets aside the swap-shaped alias, keeps the nickname and the confirmed one, and deletes nothing', ()=>{
   fresh(); ev(`state.nameAliases={'kay able':'Hana Other','santiago sandez':'Santi','robert jones':'Bob','mel sandez':'Sal Sandez'}; state.nameAliasMeta={confirmed:{'robert jones':true},setAside:{}}; window.__n=bootRepairNameAliases();`);
   const a=J('state.nameAliases'), m=J('state.nameAliasMeta');
   if(a['kay able']||a['mel sandez']) throw new Error('still active: '+JSON.stringify(a));
   if(a['santiago sandez']!=='Santi'||a['robert jones']!=='Bob') throw new Error('a real nickname was touched: '+JSON.stringify(a));
   if(m.setAside['kay able']!=='Hana Other'||m.setAside['mel sandez']!=='Sal Sandez') throw new Error('not kept for restore: '+JSON.stringify(m));
   if(ev('window.__n')!==2) throw new Error('count '+ev('window.__n'));
 });
 check('it is idempotent, and a pull after it shows the scheduled person', ()=>{
   ev(`window.__n=bootRepairNameAliases();`); if(ev('window.__n')!==0) throw new Error('second run changed '+ev('window.__n'));
   pull([['Kay Able','Vocals'],['Dee Drum','Drums']]);
   if(vocNames().indexOf('Kay Able')===-1) throw new Error(JSON.stringify(vocNames()));
 });
 check('restoring a set-aside name re-activates it and it survives the next load', ()=>{
   ev(`restoreNameAlias('kay able'); window.__n=bootRepairNameAliases();`);
   if(ev(`state.nameAliases['kay able']`)!=='Hana Other'||ev('window.__n')!==0) throw new Error(JSON.stringify(J('state.nameAliases'))+' n='+ev('window.__n'));
 });
 check('removing a remembered name clears it for good', ()=>{
   ev(`removeNameAlias('kay able'); removeNameAlias('santiago sandez');`);
   const a=J('state.nameAliases'); if(a['kay able']||a['santiago sandez']) throw new Error(JSON.stringify(a));
   if(ev(`!!state.nameAliasMeta.setAside['kay able']`)) throw new Error('remove left it in the set-aside list');
 });

 console.log('--- setting a name aside never rewrites the roster that is already up ---');
 check('auto-refresh after the repair does not "rename" a substitute back (rename detection reads PCO\'s raw name)', ()=>{
   fresh();
   // Roster pulled under the OLD build with the poisoned alias: live + baseline both say "Hana Other", no rawName.
   ev(`state.vocalists=[{id:'v1',name:'Hana Other',isWL:false,leadsSongs:false,micAssigned:''}]; state.assignments=['v1',null,null,null,null,null,null,null];
       state.pcoBaseline={planId:'P',meta:{title:'',date:''},serviceOrder:[],people:[{pcoId:'p1',name:'Hana Other',kind:'vocalist',position:'',positionName:'Vocals',host:'',isWL:false,leadsSongs:false,status:'C'}]};`);
   window.__tm=mk([['Kay Able','Vocals','p1']]);
   ev(`window.__next=derivePcoModel({attributes:{}}, window.__tm, {data:[],included:[]}); window.__d=diffPcoModel(state.pcoBaseline, window.__next);`);
   if(J('window.__d.renamed').length) throw new Error('would rename the live roster: '+JSON.stringify(J('window.__d.renamed')));
   if(ev('window.__next.people[0].rawName')!=='Kay Able') throw new Error('next model carries no rawName');
 });
 check('a real rename in Planning Center is still detected once both sides carry the raw name', ()=>{
   window.__a=mk([['Kay Able','Vocals','p1']]); window.__b=mk([['Kay Baker','Vocals','p1']]);
   ev(`window.__d=diffPcoModel(derivePcoModel({attributes:{}}, window.__a, {data:[],included:[]}), derivePcoModel({attributes:{}}, window.__b, {data:[],included:[]}));`);
   if(J('window.__d.renamed').length!==1) throw new Error(JSON.stringify(J('window.__d')));
 });

 console.log('--- every remembered name is visible and removable ---');
 check('Advanced Settings → Planning Center lists remembered names with Remove, and set-aside names with Restore', ()=>{
   fresh(); ev(`state.nameAliases={'santiago sandez':'Santi'}; state.nameAliasMeta={confirmed:{},setAside:{'kay able':'Hana Other'}}; renderPCOSettings();`);
   const box=doc.getElementById('nameAliasBox'); if(!box) throw new Error('no remembered-names section');
   const t=box.textContent; if(!/Santiago Sandez/i.test(t)||!/Santi/.test(t)||!/Kay Able/i.test(t)||!/Hana Other/.test(t)) throw new Error(t.slice(0,200));
   const rm=box.querySelector('[data-alias-remove="santiago sandez"]'); const rs=box.querySelector('[data-alias-restore="kay able"]');
   if(!rm||!rs) throw new Error('missing controls');
   rm.dispatchEvent(new window.Event('click',{bubbles:true}));
   if(ev(`state.nameAliases['santiago sandez']`)) throw new Error('Remove did nothing');
   doc.getElementById('nameAliasBox').querySelector('[data-alias-restore="kay able"]').dispatchEvent(new window.Event('click',{bubbles:true}));
   if(ev(`state.nameAliases['kay able']`)!=='Hana Other') throw new Error('Restore did nothing');
 });
 check('with nothing remembered the section says so plainly', ()=>{
   fresh(); ev('renderPCOSettings()');
   if(!/No remembered names/i.test(doc.getElementById('nameAliasBox').textContent)) throw new Error(doc.getElementById('nameAliasBox').textContent.slice(0,120));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
