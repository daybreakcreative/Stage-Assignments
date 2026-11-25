// 2026-11-25 — team_members was read with per_page=100 and never paged. Sunday plans sampled today
// run 12–31 records, so this has not bitten yet; a combined or Christmas service with a 101st team
// member would silently lose whoever Planning Center sorted last, and the auto-refresh would then
// see them "removed" and take them off the stage. pcoFetchAll follows links.next.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||path.join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
async function check(l,f){try{await f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(async()=>{
 const page1={data:[],links:{next:'https://api.planningcenteronline.com/services/v2/x?offset=100'}};
 for(let i=0;i<100;i++) page1.data.push({id:'u'+i,attributes:{name:'Usher '+i,team_position_name:'Usher',status:'C'}});
 const page2={data:[{id:'d1',attributes:{name:'Dee Drum',team_position_name:'Drums',status:'C'}},{id:'v1',attributes:{name:'Wes Lead',team_position_name:'Worship Leader',status:'C'}}],links:{}};
 window.__p1=page1; window.__p2=page2;
 ev(`toast=function(){};saveState=function(){};renderAll=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};console.warn=function(){};
     openPostPullPopup=function(){return false;}; maybeResolvePackConflicts=function(){};
     pcoTokens={access_token:'tok',expires_at:9999999999999}; state.venues=null; state._firstRun=false; state.pcoConfig.selectedServiceTypeId='st1';
     state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); window.__urls=[];
     pcoFetch=async function(p){ window.__urls.push(p);
       if(/offset=100/.test(p)) return window.__p2;
       if(/team_members/.test(p)) return window.__p1;
       if(/items/.test(p)) return {data:[],included:[]};
       return {data:{attributes:{title:'T',sort_date:'2026-12-20T17:00:00Z'}}}; };`);
 await check('pcoFetchAll follows links.next and returns one combined list', async()=>{
   const n=await ev(`pcoFetchAll('/services/v2/service_types/st1/plans/p1/team_members?per_page=100').then(r=>r.data.length)`);
   if(n!==102) throw new Error('got '+n+' records');
 });
 await check('a pull seats the drummer and worship leader who arrive on page 2', async()=>{
   await ev(`pcoPullPlan('p1')`);
   if(ev(`instById('inst_drums').assignedTo`)!=='Dee Drum') throw new Error('Drums = "'+ev(`instById('inst_drums').assignedTo`)+'"');
   if(ev(`state.vocalists.map(v=>v.name).join(',')`)!=='Wes Lead') throw new Error(ev(`state.vocalists.map(v=>v.name).join(',')`));
 });
 await check('the auto-refresh reads every page too (nobody on page 2 is "removed")', async()=>{
   await ev('pcoMergeRefresh()');
   if(ev(`instById('inst_drums').assignedTo`)!=='Dee Drum'||ev('state.vocalists.length')!==1) throw new Error('page-2 people were dropped by the refresh');
 });
 await check('a runaway "next" chain stops (20-page guard)', async()=>{
   ev(`window.__calls=0; pcoFetch=async function(){ window.__calls++; return {data:[{id:'x'}],links:{next:'https://api.planningcenteronline.com/loop'}}; };`);
   await ev(`pcoFetchAll('/loop')`); if(ev('window.__calls')>21) throw new Error('calls: '+ev('window.__calls'));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
