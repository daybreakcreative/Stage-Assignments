// 2026-11-25 — three times in one day the fix for a wrong placement was "teach the app a position
// name" (Message, Prayer Host, Ministry Moment), each needing a code change and a deploy. Planning
// Center positions are the team's data, so the mapping is now theirs: Advanced Settings → Planning
// Center lists every position the app has seen, what it does with it, and a select to change it.
// ⚠ An override applies to PCO POSITIONS only. Instrument slot LABELS ("Keys", "Electric 1") keep the
// built-in rules — otherwise mapping the "Keys" position to something else would un-find every Keys slot.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
const mk=list=>({data:list.map(([name,pos,st],i)=>({id:'x'+i,attributes:{name,team_position_name:pos,status:st||'C'}}))});
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(m){window.__toast=m;};saveState=function(){window.__saves=(window.__saves||0)+1;};renderAll=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};');
 const fresh=()=>ev(`state._firstRun=false; state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); state.config.positionMap={}; state.positionsSeen={}; state.nameAliases={}; state.setupItems={}; state.musicDirectorId=null;
   state.config.hostChannels=[{id:'hp',label:'Pastor',capsule:''},{id:'h1',label:'HH 1',capsule:''},{id:'h2',label:'HH 2',capsule:''},{id:'h3',label:'HH 3',capsule:''}];`);
 const pull=list=>{ window.__tm=mk(list); ev(`applyPCOPlanData({attributes:{}}, window.__tm, {data:[],included:[]})`); };
 const hosts=()=>J(`Object.fromEntries(hostChannels().map(ch=>[ch.label,state.hosts[ch.id]||'']))`);

 console.log('--- an override decides, and clearing it returns to automatic ---');
 check('automatic: Prayer Host is not on stage; mapped to "Host (handheld)" it takes one; cleared, it is off again', ()=>{
   fresh(); const P=[['Pia Pray','Prayer Host'],['Hal Host','Welcome Host']];
   pull(P); if(hosts()['HH 1']!=='Hal Host'||hosts()['HH 2']) throw new Error('automatic: '+JSON.stringify(hosts()));
   ev(`setPositionRole('Prayer Host','welcome')`); pull(P);
   if(hosts()['HH 1']!=='Pia Pray'||hosts()['HH 2']!=='Hal Host') throw new Error('override: '+JSON.stringify(hosts()));
   ev(`setPositionRole('Prayer Host','')`); pull(P);
   if(hosts()['HH 1']!=='Hal Host'||hosts()['HH 2']) throw new Error('cleared: '+JSON.stringify(hosts()));
   if(Object.keys(J('state.config.positionMap')).length) throw new Error('clearing left an entry: '+JSON.stringify(J('state.config.positionMap')));
 });
 check('an unrecognised position can be put on stage: "Lyrics" → Keys seats that person on Keys', ()=>{
   fresh(); ev(`setPositionRole('Lyrics','keys')`); pull([['Lee Lyric','Lyrics'],['Dee Drum','Drums']]);
   if(ev(`instById('inst_keys').assignedTo`)!=='Lee Lyric') throw new Error(ev(`instById('inst_keys').assignedTo`));
 });
 check('every role maps to a working classification (vocalist, WL, band, MD, speaker, baptizing, shadow, not on stage)', ()=>{
   fresh(); const want={ignore:{kind:'ignore'},vocalist:{kind:'vocalist'},wl:{kind:'vocalist',isWL:true},drums:{kind:'band',position:'drums'},bass:{kind:'band',position:'bass'},
     keys:{kind:'band',position:'keys'},eg:{kind:'band',position:'eg'},ag:{kind:'band',position:'ag'},md:{kind:'md_flag'},speaker:{kind:'host',host:'speaker'},welcome:{kind:'host',host:'welcome'},baptismal:{kind:'host',host:'baptismal'},shadow:{kind:'shadow'}};
   const roles=J('POSITION_ROLES.map(r=>r.id)'); Object.keys(want).forEach(r=>{ if(roles.indexOf(r)===-1) throw new Error('role missing from POSITION_ROLES: '+r); });
   Object.keys(want).forEach(r=>{ ev(`setPositionRole('Zzz Test Position','${r}')`); const c=J(`classifyPosition('Zzz Test Position')`);
     Object.keys(want[r]).forEach(k=>{ if(c[k]!==want[r][k]) throw new Error(r+' → '+JSON.stringify(c)); }); });
 });
 check('matching ignores case and surrounding spaces', ()=>{
   fresh(); ev(`setPositionRole('  PRAYER host ','welcome')`);
   if(J(`classifyPosition('Prayer Host')`).host!=='welcome') throw new Error(JSON.stringify(J(`classifyPosition('Prayer Host')`)));
 });
 check('an unknown role is refused', ()=>{
   fresh(); ev(`setPositionRole('Prayer Host','banana')`);
   if(Object.keys(J('state.config.positionMap')).length) throw new Error(JSON.stringify(J('state.config.positionMap')));
 });

 console.log('--- an override can never un-find the band slots ---');
 check('mapping the POSITION "Keys" to not-on-stage does not stop the Keys SLOT being a keys slot', ()=>{
   fresh(); ev(`setPositionRole('Keys','ignore'); setPositionRole('Piano','keys')`);
   pull([['Kim Keys','Keys'],['Pat Piano','Piano'],['Dee Drum','Drums']]);
   if(ev(`instById('inst_keys').assignedTo`)!=='Pat Piano') throw new Error('Keys slot: "'+ev(`instById('inst_keys').assignedTo`)+'"');
   if(J(`classifyPositionBuiltin('Keys')`).position!=='keys') throw new Error('built-in rules were altered');
 });
 check('the merge path finds slots by the built-in rules too', ()=>{
   fresh(); ev(`setPositionRole('Drums','ignore')`);
   const ok=ev(`pcoAddPerson({pcoId:'z',name:'Max Drum',kind:'band',position:'drums',positionName:'Kit',host:'',status:'C'})`);
   if(ok!==true||ev(`instById('inst_drums').assignedTo`)!=='Max Drum') throw new Error('drum slot not found: '+ev(`instById('inst_drums').assignedTo`));
 });

 console.log('--- the app remembers which positions it has seen (names of positions only) ---');
 check('a pull records every position on the plan, any status, with its original spelling', ()=>{
   fresh(); pull([['A B','Vocals'],['C D','ProPresenter'],['E F','Culture Carriers','U'],['G H','Bass Guitar','D']]);
   const seen=J('state.positionsSeen'); ['vocals','propresenter','culture carriers','bass guitar'].forEach(k=>{ if(!seen[k]) throw new Error(k+' not recorded: '+JSON.stringify(Object.keys(seen))); });
   if(seen['propresenter'].name!=='ProPresenter') throw new Error('spelling lost: '+seen['propresenter'].name);
   if(/A B|C D|E F|G H/.test(JSON.stringify(seen))) throw new Error('a PERSON leaked into positionsSeen');
 });
 check('the list is capped at 120, dropping the oldest', ()=>{
   fresh(); ev(`for(let i=0;i<130;i++){ state.positionsSeen['old '+i]={name:'Old '+i,last:'2026-01-01T00:00:'+String(i%60).padStart(2,'0')+'Z'}; }`);
   pull([['A B','Vocals']]); const n=Object.keys(J('state.positionsSeen')).length;
   if(n>120) throw new Error('size '+n); if(!ev(`!!state.positionsSeen['vocals']`)) throw new Error('the newest was dropped');
 });
 check('a saved map is sanitised on load: unknown roles and junk are dropped', ()=>{
   const m=J(`sanitizePositionMap({'Prayer Host':'welcome','x':'banana','':'keys','y':42, 'Lyrics ':'ignore'})`);
   if(JSON.stringify(m)!==JSON.stringify({'prayer host':'welcome','lyrics':'ignore'})) throw new Error(JSON.stringify(m));
   if(JSON.stringify(J(`sanitizePositionMap(null)`))!=='{}') throw new Error('null not handled');
 });

 console.log('--- the settings table ---');
 check('lists each seen position with what it does now; on-stage first, unrecognised last', ()=>{
   fresh(); pull([['A B','Vocals'],['C D','ProPresenter'],['E F','Prayer Host'],['G H','Message'],['I J','Camera 2']]);
   ev('renderPCOSettings()'); const box=doc.getElementById('positionMapBox'); if(!box) throw new Error('no #positionMapBox');
   const rows=[...box.querySelectorAll('.pm-row')].map(r=>({pos:r.querySelector('.pm-pos').textContent.trim(), now:r.querySelector('.pm-now').textContent.trim()}));
   const by=Object.fromEntries(rows.map(r=>[r.pos,r.now]));
   if(!/Vocalist/i.test(by['Vocals'])||!/Speaker/i.test(by['Message'])||!/Not on stage/i.test(by['Prayer Host'])||!/Not on stage/i.test(by['Camera 2'])) throw new Error(JSON.stringify(by));
   if(!/not recognised/i.test(by['ProPresenter'])) throw new Error('ProPresenter: '+by['ProPresenter']);
   const order=rows.map(r=>r.pos); if(order.indexOf('Vocals')>order.indexOf('Camera 2')||order.indexOf('Camera 2')>order.indexOf('ProPresenter')) throw new Error('order: '+order.join(', '));
 });
 check('choosing a role in the select saves it, marks the row as changed, and says when it applies', ()=>{
   const box=doc.getElementById('positionMapBox');
   const sel=[...box.querySelectorAll('.pm-row')].find(r=>r.querySelector('.pm-pos').textContent.trim()==='Prayer Host').querySelector('select');
   sel.value='welcome'; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev(`state.config.positionMap['prayer host']`)!=='welcome') throw new Error(JSON.stringify(J('state.config.positionMap')));
   const row=[...doc.getElementById('positionMapBox').querySelectorAll('.pm-row')].find(r=>r.querySelector('.pm-pos').textContent.trim()==='Prayer Host');
   if(!row.classList.contains('pm-custom')||!/Host/i.test(row.querySelector('.pm-now').textContent)) throw new Error(row.className+' / '+row.querySelector('.pm-now').textContent);
   if(!/next pull/i.test(ev('window.__toast')||'')) throw new Error('toast: '+ev('window.__toast'));
 });
 check('choosing "Automatic" removes the override', ()=>{
   const row=()=>[...doc.getElementById('positionMapBox').querySelectorAll('.pm-row')].find(r=>r.querySelector('.pm-pos').textContent.trim()==='Prayer Host');
   const sel=row().querySelector('select'); sel.value=''; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev(`'prayer host' in state.config.positionMap`)) throw new Error('still mapped');
   if(row().classList.contains('pm-custom')) throw new Error('row still marked changed');
 });
 check('before any pull the section says so plainly instead of showing an empty table', ()=>{
   fresh(); ev('renderPCOSettings()');
   if(!/Pull a plan/i.test(doc.getElementById('positionMapBox').textContent)) throw new Error(doc.getElementById('positionMapBox').textContent.slice(0,140));
 });
 check('an override for a position not seen lately is still listed, so it can be undone', ()=>{
   fresh(); ev(`setPositionRole('Old Position','welcome'); renderPCOSettings();`);
   if(!/Old Position/i.test(doc.getElementById('positionMapBox').textContent)) throw new Error('orphan override hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
