// 2026-11-25 — "major bugs lately: pulling random people for positions, putting wrong people in
// wrong positions" (Dillon, secondhand from the team; nothing in the bug queue). Diagnosed by
// replaying the SHAPE of six real plans (fixtures/realplans-2026-11-25.js — every position, status
// and record order real, every person a code) through applyPCOPlanData, carrying state from one plan
// to the next the way a booth machine carries it from week to week. What the old build did:
//   • Meadowlark Nov 29 names no Music Director → the flag from the PREVIOUS plan stayed on the Bass
//     slot, so a different person was shown as "Bass · MD" with the MD's setup items.
//   • 68 Nov 29: the speaker's position is "Message" (unrecognised) → a welcome host was put on the
//     PASTOR channel and the speaker got nothing.
//   • Thanksgiving Night of Worship: the second "Pastors" person was dropped with no word. (One
//     person holding HH 1 as host AND HH 3 as baptizer is Daybreak's standing rule — whoever baptizes
//     takes the baptism mic — and is deliberately left alone.)
//   • Sunday Nov 29: the second baptizing pastor was dropped with no word.
// Plus, read out of the code: the acoustic link and the MD match compared FIRST names only (this
// team has two Nicks who both play guitar/bass), and anyone dropped for lack of a slot vanished silently.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const F=require('./fixtures/realplans-2026-11-25.js');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
const norm=s=>(s||'').trim().toLowerCase().replace(/\s+/g,' ');

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};');
 // Daybreak's handheld layout: a Pastor channel, then HH 1-3 (HH 3 is the baptism mic).
 const freshRoom=()=>ev(`state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); state.nameAliases={}; state.config.vocalPins={}; state.setupItems={}; state.musicDirectorId=null; state.mdSoloName=null;
   state.config.hostChannels=[{id:'hp',label:'Pastor',capsule:''},{id:'h1',label:'HH 1',capsule:''},{id:'h2',label:'HH 2',capsule:''},{id:'h3',label:'HH 3',capsule:''}];`);
 const pull=tm=>{ window.__tm=tm; ev(`applyPCOPlanData({attributes:{}}, window.__tm, {data:[],included:[]})`); };
 const snap=()=>J(`({
   voc: state.vocalists.map(v=>v.name),
   band: state.instruments.map(i=>({id:i.id,label:i.label,name:i.assignedTo||((state.vocalists.find(v=>v.id===i.vocalistPlayer)||{}).name)||'',linked:!!i.vocalistPlayer,md:state.musicDirectorId===i.id})).filter(b=>b.name),
   hosts: hostChannels().map(ch=>({id:ch.id,label:ch.label,name:state.hosts[ch.id]||''})),
   mdSolo: state.mdSoloName||'', shadows: state.shadows.map(s=>s.name),
   notices: pcoMergeNotices.needs.map(n=>n.text) })`);
 const truth=key=>{ const act=F.PLANS[key].filter(r=>r[2]!=='D').map(r=>({name:F.nameOf(r[0]),pos:r[1],cls:J(`classifyPosition(${JSON.stringify(r[1])})`)}));
   return { act, onStage: act.filter(x=>['vocalist','band','host','shadow'].includes(x.cls.kind)), md: act.filter(x=>x.cls.kind==='md_flag').map(x=>x.name) }; };

 console.log('--- six real plans, pulled back to back like six weeks on one machine ---');
 freshRoom();
 F.keys.forEach(key=>{
   pull(F.tm(key)); const s=snap(); const t=truth(key);
   const placed=[...s.voc, ...s.band.map(b=>b.name), ...s.hosts.map(h=>h.name).filter(Boolean), ...s.shadows];
   check(key+': nobody is on stage who is not on this plan in an on-stage position', ()=>{
     const ok=new Set(t.onStage.map(x=>norm(x.name)));
     const strays=placed.filter(n=>!ok.has(norm(n)));
     if(strays.length) throw new Error('strays: '+JSON.stringify(strays));
   });
   check(key+': the Music Director flag is on the plan\'s MD and nowhere else', ()=>{
     const flagged=s.band.filter(b=>b.md).map(b=>b.name);
     if(!t.md.length){ if(flagged.length||s.mdSolo) throw new Error('plan names no MD but '+JSON.stringify(flagged)+' is flagged (stale from the previous pull)'); return; }
     if(flagged.length!==1||norm(flagged[0])!==norm(t.md[0])) throw new Error('MD should be '+t.md[0]+', flagged: '+JSON.stringify(flagged)+' solo='+s.mdSolo);
   });
   check(key+': nobody holds two handhelds — except the baptizer, who also takes the baptism mic (HH 3)', ()=>{
     const names=s.hosts.filter(h=>h.label!=='HH 3').map(h=>norm(h.name)).filter(Boolean);
     const dup=names.filter((n,i)=>names.indexOf(n)!==i);
     if(dup.length) throw new Error('twice: '+JSON.stringify(dup)+' in '+JSON.stringify(s.hosts));
   });
   check(key+': the Pastor channel holds a speaker or nobody — never a welcome host', ()=>{
     const p=s.hosts.find(h=>h.label==='Pastor'); if(!p.name) return;
     const roles=t.onStage.filter(x=>norm(x.name)===norm(p.name)&&x.cls.kind==='host').map(x=>x.cls.host);
     if(roles.indexOf('speaker')===-1) throw new Error(p.name+' is on Pastor as '+JSON.stringify(roles));
   });
   check(key+': everyone in an on-stage position is placed, or named in a "wasn\'t placed" notice', ()=>{
     const on=new Set(placed.map(norm));
     const missing=t.onStage.filter(x=>!on.has(norm(x.name)) && !s.notices.some(n=>n.indexOf(x.name)!==-1 && /wasn.t placed/.test(n)));
     if(missing.length) throw new Error('silently dropped: '+JSON.stringify(missing.map(x=>x.name+' ('+x.pos+')')));
   });
 });

 console.log('--- the specific placements ---');
 check('68: the "Message" position is the speaker and takes the Pastor channel; both hosts take HH 1 and HH 2', ()=>{
   freshRoom(); pull(F.tm('sixeight_nov29')); const s=snap();
   const h=Object.fromEntries(s.hosts.map(x=>[x.label,x.name]));
   if(h['Pastor']!==F.nameOf('a45')) throw new Error('Pastor='+h['Pastor']);
   if(h['HH 1']!==F.nameOf('a81')||h['HH 2']!==F.nameOf('a84')) throw new Error(JSON.stringify(h));
 });
 check('Thanksgiving: first pastor on Pastor, baptizer on HH 3, both hosts on HH 1-2, and the second pastor is REPORTED (the Pastor mic is taken)', ()=>{
   freshRoom(); pull(F.tm('thanksgiving_now')); const s=snap();
   const h=Object.fromEntries(s.hosts.map(x=>[x.label,x.name]));
   const want={'Pastor':F.nameOf('a48'),'HH 3':F.nameOf('a37'),'HH 1':F.nameOf('a37'),'HH 2':F.nameOf('a49')};
   Object.keys(want).forEach(k=>{ if(h[k]!==want[k]) throw new Error(k+' should be '+want[k]+': '+JSON.stringify(h)); });
   if(!s.notices.some(n=>n.indexOf(F.nameOf('a24'))!==-1&&/wasn.t placed/.test(n))) throw new Error('second pastor not reported: '+JSON.stringify(s.notices));
 });
 check('a host listed under two host positions takes ONE handheld', ()=>{
   freshRoom(); window.__tm={data:[['Hal Host','Host'],['Hal Host','Welcome Host'],['Ida Other','Host']].map(([name,pos],i)=>({id:'h'+i,attributes:{name,team_position_name:pos,status:'C'}}))};
   ev(`applyPCOPlanData({attributes:{}}, window.__tm, {data:[],included:[]})`); const s=snap();
   const h=Object.fromEntries(s.hosts.map(x=>[x.label,x.name]));
   if(h['HH 1']!=='Hal Host'||h['HH 2']!=='Ida Other') throw new Error(JSON.stringify(h));
 });
 check('Sunday Nov 29: speaker on Pastor, first baptizer on HH 3, hosts on HH 1-2, and the second baptizer is REPORTED', ()=>{
   freshRoom(); pull(F.tm('sunday_nov29')); const s=snap();
   const h=Object.fromEntries(s.hosts.map(x=>[x.label,x.name]));
   if(h['Pastor']!==F.nameOf('a23')||h['HH 3']!==F.nameOf('a18')) throw new Error(JSON.stringify(h));
   if(!s.notices.some(n=>n.indexOf(F.nameOf('a19'))!==-1)) throw new Error('no notice for the second baptizer: '+JSON.stringify(s.notices));
 });

 console.log('--- first names are not identities ---');
 const mk=list=>({data:list.map(([name,pos],i)=>({id:'x'+i,attributes:{name,team_position_name:pos,status:'C'}}))});
 check('an acoustic player who shares only a FIRST name with a vocalist is not turned into that vocalist', ()=>{
   freshRoom(); pull(mk([['Nico Alpha','Vocals'],['Nico Beta','Acoustic Guitar'],['Dee Drum','Drums']])); const s=snap();
   const ag=s.band.find(b=>/Acoustic/.test(b.label));
   if(!ag) throw new Error('acoustic player vanished: '+JSON.stringify(s.band));
   if(ag.linked||ag.name!=='Nico Beta') throw new Error('acoustic slot shows '+ag.name+(ag.linked?' (linked to the vocalist)':''));
 });
 check('a vocalist who really is the acoustic player is still linked', ()=>{
   freshRoom(); pull(mk([['Nico Alpha','Worship Leader'],['Nico Alpha','Acoustic Guitar']])); const s=snap();
   const ag=s.band.find(b=>/Acoustic/.test(b.label));
   if(!ag||!ag.linked||ag.name!=='Nico Alpha') throw new Error(JSON.stringify(s.band));
 });
 check('the MD flag goes to the MD, not to an earlier slot whose player shares a first name', ()=>{
   freshRoom(); pull(mk([['Nico Alpha','Bass'],['Nico Beta','Electric Guitar'],['Nico Beta','Music Director']])); const s=snap();
   const md=s.band.filter(b=>b.md);
   if(md.length!==1||md[0].name!=='Nico Beta') throw new Error('MD flagged on '+JSON.stringify(md));
 });
 check('MD-first ordering inside a bucket uses the full name too', ()=>{
   freshRoom(); pull(mk([['Nico Alpha','Electric Guitar'],['Nico Beta','Electric Guitar'],['Nico Beta','Music Director']])); const s=snap();
   const eg1=s.band.find(b=>b.label==='Electric 1');
   if(!eg1||eg1.name!=='Nico Beta'||!eg1.md) throw new Error(JSON.stringify(s.band));
 });

 console.log('--- nothing is dropped in silence, and old notices do not linger ---');
 check('a second drummer (no second kit) is reported, not silently lost', ()=>{
   freshRoom(); pull(mk([['Ann One','Drums'],['Bob Two','Drums']])); const s=snap();
   if(!s.notices.some(n=>n.indexOf('Bob Two')!==-1&&/wasn.t placed/.test(n))) throw new Error(JSON.stringify(s.notices));
 });
 check('a fresh pull clears the notices of the plan before it', ()=>{
   freshRoom(); pull(mk([['Ann One','Drums'],['Bob Two','Drums']])); pull(mk([['Ann One','Drums']]));
   const s=snap(); if(s.notices.length) throw new Error('stale notices: '+JSON.stringify(s.notices));
 });

 console.log('--- an MD the operator set by hand follows the PERSON, never the slot ---');
 check('re-pulling the same band keeps a hand-set MD; a different player in that slot does not inherit it', ()=>{
   freshRoom(); pull(mk([['Kim Keys','Keys'],['Dee Drum','Drums']]));
   ev(`state.musicDirectorId='inst_keys'`);
   pull(mk([['Kim Keys','Keys'],['Dee Drum','Drums']]));
   if(ev('state.musicDirectorId')!=='inst_keys') throw new Error('hand-set MD lost on a re-pull of the same person');
   pull(mk([['Lou Other','Keys'],['Dee Drum','Drums']]));
   if(ev('state.musicDirectorId')) throw new Error('MD flag inherited by a different person in the same slot');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
