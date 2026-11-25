// 2026-11-25 — when the roster on screen holds someone the selected plan does not put on stage, the
// app now says so, once: "On screen but not on this plan: …". The usual cause is harmless — a
// substitute typed in by hand — so it reads as a confirmation and can be dismissed. The other cause
// is the one that was reported as "random people in positions": a roster left over from another
// plan. Either way it can no longer sit there unremarked.
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
async function check(l,f){try{await f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
const mk=list=>({data:list.map(([name,pos,id,st])=>({id,attributes:{name,team_position_name:pos,status:st||'C'}}))});
const PLAN=[['Ann One','Vocals','a1'],['Wes Lead','Worship Leader','a2'],['Kim Keys','Keys','a3'],['Dee Drum','Drums','a4'],['Sue Speak','Speaker','a5'],['Pro Pres','ProPresenter','a6']];
window.addEventListener('load',()=>setTimeout(async()=>{
 ev(`toast=function(){};saveState=function(){};renderAll=function(){};console.group=function(){};console.groupEnd=function(){};console.log=function(){};console.warn=function(){};
     openPostPullPopup=function(){return false;}; maybeResolvePackConflicts=function(){}; openSetupReviewDialog=function(){};
     pcoTokens={access_token:'tok',expires_at:9999999999999}; state.config.autoRefreshPaused=false; state.venues=null; state._firstRun=false;
     pcoFetch=async function(p){ if(/team_members/.test(p)) return window.__tm; if(/items/.test(p)) return {data:[],included:[]}; return {data:{attributes:{title:'T',sort_date:'2026-11-29T08:00:00Z'}}}; };`);
 const room=async()=>{ ev(`state.instruments=JSON.parse(JSON.stringify(DEFAULT_INSTRUMENTS)); state.nameAliases={}; state.nameAliasMeta={confirmed:{},setAside:{}}; state.config.positionMap={}; state.setupItems={}; state.pcoConfig.selectedServiceTypeId='st1'; state.pcoBaseline=null; pcoDismissedNoticeIds=new Set();`);
   window.__tm=mk(PLAN); await ev(`pcoPullPlan('w1')`); };
 const off=()=>J(`pcoMergeNotices.fyi.filter(n=>/^offplan_/.test(n.id)).map(n=>n.text)`);

 await check('straight after a pull nobody is off-plan and there is no notice', async()=>{ await room(); if(off().length) throw new Error(JSON.stringify(off())); });
 await check('a substitute typed over Keys → one calm notice naming them on the next refresh', async()=>{
   ev(`instById('inst_keys').assignedTo='Lou Other'`); await ev('pcoMergeRefresh()');
   const o=off(); if(o.length!==1||!/Lou Other/.test(o[0])||!/not on this plan/i.test(o[0])) throw new Error(JSON.stringify(o));
   if(/⚠/.test(o[0])) throw new Error('reads as an alarm: '+o[0]);
   if(/Kim Keys|Ann One/.test(o[0])) throw new Error('names someone who IS on the plan: '+o[0]);
 });
 await check('it shows in the banner with a dismiss control', async()=>{
   const el=doc.getElementById('pcoMergeBanner'); if(!/Lou Other/.test(el.textContent)||!el.querySelector('.pmn-x')) throw new Error(el.innerHTML.slice(0,200));
 });
 await check('the next refresh does not stack a second copy', async()=>{ await ev('pcoMergeRefresh()'); if(off().length!==1) throw new Error(JSON.stringify(off())); });
 await check('dismissed → it stays gone for that same set of people', async()=>{
   const x=[...doc.querySelectorAll('#pcoMergeBanner .pmn-x')].find(b=>/^offplan_/.test(b.dataset.notice)); x.dispatchEvent(new window.Event('click',{bubbles:true}));
   if(off().length) throw new Error('still there after dismiss');
   await ev('pcoMergeRefresh()'); if(off().length) throw new Error('came back: '+JSON.stringify(off()));
 });
 await check('a DIFFERENT set of off-plan people raises it again, and the old text is replaced, not added to', async()=>{
   ev(`state.vocalists.push({id:'vx',name:'Zoe Extra',isWL:false,leadsSongs:false,micAssigned:''}); state.assignments[state.assignments.findIndex(a=>!a)]='vx';`);
   await ev('pcoMergeRefresh()'); const o=off();
   if(o.length!==1||!/Lou Other/.test(o[0])||!/Zoe Extra/.test(o[0])) throw new Error(JSON.stringify(o));
 });
 await check('hosts and shadows count too; someone scheduled in an off-stage position (ProPresenter) is "not on this plan" on stage', async()=>{
   await room(); ev(`state.hosts['h2']='Pro Pres'; state.shadows.push({id:'s1',name:'Shay Shadow',position:'',pack:''});`);
   await ev('pcoMergeRefresh()'); const o=off();
   if(o.length!==1||!/Pro Pres/.test(o[0])||!/Shay Shadow/.test(o[0])) throw new Error(JSON.stringify(o));
 });
 await check('a go-by name is not "off plan": Santiago scheduled, shown as Santi', async()=>{
   await room(); ev(`state.nameAliases={'kim keys':'Kimmy'}; instById('inst_keys').assignedTo='Kimmy';`);
   await ev('pcoMergeRefresh()'); if(off().length) throw new Error(JSON.stringify(off()));
 });
 await check('once Planning Center catches up with the substitute, the notice clears itself', async()=>{
   await room(); ev(`instById('inst_keys').assignedTo='Lou Other'`); await ev('pcoMergeRefresh()'); if(off().length!==1) throw new Error('precondition');
   window.__tm=mk(PLAN.filter(r=>r[2]!=='a3').concat([['Lou Other','Keys','a9']])); await ev('pcoMergeRefresh()');
   if(off().length) throw new Error('stale notice: '+JSON.stringify(off()));
 });
 await check('a fresh pull starts clean', async()=>{
   await room(); ev(`instById('inst_keys').assignedTo='Lou Other'`); await ev('pcoMergeRefresh()'); window.__tm=mk(PLAN); await ev(`pcoPullPlan('w1')`);
   if(off().length) throw new Error(JSON.stringify(off()));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
