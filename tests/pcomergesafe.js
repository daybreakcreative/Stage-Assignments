// 2026-11-25 — the auto-refresh (every 3 minutes, plus the ↻ button) could put one plan's people on
// top of another's, and could seat one person twice:
//   • pcoPullPlan stored the newly chosen plan id BEFORE fetching it. A pull that failed, or a page
//     reloaded mid-pull, left last week's roster on screen with THIS week's plan id selected. The
//     next refresh found no baseline for that plan, called everybody in it "added", and merged them
//     onto last week's roster: nine vocalists, strangers on the handhelds, "could not be placed".
//   • a merge "add" never checked whether the person was already there. Type a substitute into a
//     band slot, let the worship pastor fix Planning Center an hour later, and the refresh gave the
//     substitute a SECOND slot (or minted "Keys 2" for them).
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
async function check(l,f){try{await f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
const mk=list=>({data:list.map(([name,pos,id])=>({id,attributes:{name,team_position_name:pos,status:'C'}}))});
const WEEK1=[['Ann One','Vocals','a1'],['Wes Lead','Worship Leader','a2'],['Kim Keys','Keys','a3'],['Dee Drum','Drums','a4'],['Sue Speak','Speaker','a5'],['Hal Host','Welcome Host','a6']];
const WEEK2=[['Bea Two','Vocals','b1'],['Cy Three','Vocals','b2'],['Zed Lead','Worship Leader','b3'],['Lou Other','Keys','b4'],['Max Drum','Drums','b5'],['Pat Preach','Speaker','b6'],['Ivy Host','Welcome Host','b7']];

window.addEventListener('load',()=>setTimeout(async()=>{
 ev(`toast=function(){};saveState=function(){};renderAll=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};console.warn=function(){};
     openPostPullPopup=function(){return false;}; maybeResolvePackConflicts=function(){}; openSetupReviewDialog=function(){};
     pcoTokens={access_token:'tok',expires_at:9999999999999}; state.config.autoRefreshPaused=false; state.venues=null;
     window.__plans={}; window.__fail=false; window.__fetches=0;
     pcoFetch=async function(p){ window.__fetches++; if(window.__fail) throw new Error('PCO 503');
       const m=/plans\\/([^/?]+)/.exec(p); const id=m?m[1]:'';
       if(/team_members/.test(p)) return window.__plans[id];
       if(/items/.test(p)) return {data:[],included:[]};
       return {data:{attributes:{title:'T',sort_date:'2026-11-29T08:00:00Z'}}}; };`);
 const room=()=>ev(`state._firstRun=false; state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); state.nameAliases={}; state.nameAliasMeta={confirmed:{},setAside:{}}; state.setupItems={}; state.musicDirectorId=null;
   state.config.hostChannels=[{id:'hp',label:'Pastor',capsule:''},{id:'h1',label:'HH 1',capsule:''},{id:'h2',label:'HH 2',capsule:''},{id:'h3',label:'HH 3',capsule:''}];
   state.pcoConfig.selectedServiceTypeId='st1'; state.pcoConfig.selectedPlanId=''; state.pcoBaseline=null; pcoMergeNotices={needs:[],fyi:[]}; window.__fail=false; window.__fetches=0;`);
 const everyone=()=>J(`[...state.vocalists.map(v=>v.name), ...state.instruments.map(i=>i.assignedTo).filter(Boolean), ...Object.keys(state.hosts).map(k=>state.hosts[k]).filter(Boolean)]`).sort();
 window.__plans={w1:mk(WEEK1), w2:mk(WEEK2)};

 console.log('--- a plan that was never successfully pulled is never merged in ---');
 await check('a successful pull selects the plan and stamps the baseline with it', async()=>{
   room(); await ev(`pcoPullPlan('w1')`);
   if(ev('state.pcoConfig.selectedPlanId')!=='w1'||ev('state.pcoBaseline.planId')!=='w1') throw new Error(ev('state.pcoConfig.selectedPlanId')+' / '+ev('state.pcoBaseline&&state.pcoBaseline.planId'));
   if(everyone().length!==6) throw new Error(JSON.stringify(everyone()));
 });
 await check('a pull that FAILS leaves the selected plan — and so the refresh target — where it was', async()=>{
   ev('window.__fail=true'); await ev(`pcoPullPlan('w2')`); ev('window.__fail=false');
   if(ev('state.pcoConfig.selectedPlanId')!=='w1') throw new Error('selected plan is now '+ev('state.pcoConfig.selectedPlanId')+' with week 1 still on screen');
 });
 await check('…so the next auto-refresh keeps syncing week 1 and adds nobody from week 2', async()=>{
   const before=everyone(); await ev('pcoMergeRefresh()');
   if(JSON.stringify(everyone())!==JSON.stringify(before)) throw new Error('roster changed: '+JSON.stringify(everyone()));
 });
 await check('a roster whose baseline is for a DIFFERENT plan is not merged into: nobody added, nothing fetched, and the status says to pull', async()=>{
   // the state an interrupted pull under the old build left behind: week 1 on screen, week 2 selected
   ev(`state.pcoConfig.selectedPlanId='w2'; window.__fetches=0; setPCOStatus('x');`);
   const before=everyone(); await ev('pcoMergeRefresh()');
   if(JSON.stringify(everyone())!==JSON.stringify(before)) throw new Error('week 2 was merged onto week 1: '+JSON.stringify(everyone()));
   if(ev('window.__fetches')!==0) throw new Error('fetched '+ev('window.__fetches')+' time(s)');
   const st=(doc.getElementById('pcoStatusText')||{}).textContent||'';
   if(!/pull/i.test(st)) throw new Error('status does not tell the operator to pull: "'+st+'"');
   if(ev('state.pcoBaseline.planId')!=='w1') throw new Error('baseline was replaced');
 });
 await check('no baseline at all is the same: nothing is merged', async()=>{
   ev(`state.pcoBaseline=null; window.__fetches=0;`); const before=everyone(); await ev('pcoMergeRefresh()');
   if(JSON.stringify(everyone())!==JSON.stringify(before)||ev('window.__fetches')!==0) throw new Error(JSON.stringify(everyone())+' fetches='+ev('window.__fetches'));
 });
 await check('pulling week 2 properly replaces the roster outright', async()=>{
   await ev(`pcoPullPlan('w2')`);
   const e=everyone(); if(e.length!==7||e.indexOf('Ann One')!==-1) throw new Error(JSON.stringify(e));
 });

 console.log('--- a merge "add" never seats someone who is already seated ---');
 await check('band: a player already in a slot of that type is not given a second one', async()=>{
   room(); await ev(`pcoPullPlan('w1')`);
   ev(`window.__r=pcoAddPerson({pcoId:'z1',name:'Kim Keys',kind:'band',position:'keys',positionName:'Keys',host:'',status:'C'});`);
   const keys=J(`state.instruments.filter(i=>/keys/i.test(i.label)).map(i=>i.label+'='+i.assignedTo)`);
   if(keys.length!==1||ev('window.__r')!==true) throw new Error(JSON.stringify(keys)+' r='+ev('window.__r'));
 });
 await check('host: a host already on a channel is not given a second one', async()=>{
   ev(`pcoAddPerson({pcoId:'z2',name:'Hal Host',kind:'host',position:'',positionName:'Host',host:'welcome',status:'C'});`);
   const n=J(`Object.keys(state.hosts).filter(k=>state.hosts[k]==='Hal Host')`).length; if(n!==1) throw new Error('Hal Host on '+n+' channels');
 });
 await check('the Sunday case: operator types the substitute over Keys, the scheduler then fixes Planning Center → one Keys slot, one substitute', async()=>{
   room(); await ev(`pcoPullPlan('w1')`);
   ev(`instById('inst_keys').assignedTo='Lou Other';`);                       // the swap, typed by hand
   window.__plans.w1=mk(WEEK1.filter(r=>r[2]!=='a3').concat([['Lou Other','Keys','a9']]));   // PCO catches up
   await ev('pcoMergeRefresh()');
   const keys=J(`state.instruments.filter(i=>/keys/i.test(i.label)&&i.assignedTo).map(i=>i.label+'='+i.assignedTo)`);
   if(keys.length!==1||!/Lou Other/.test(keys[0])) throw new Error(JSON.stringify(keys));
   if(J('pcoMergeNotices.needs.map(n=>n.text)').some(t=>/could not be placed/.test(t))) throw new Error('false "could not be placed" notice: '+JSON.stringify(J('pcoMergeNotices.needs.map(n=>n.text)')));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
