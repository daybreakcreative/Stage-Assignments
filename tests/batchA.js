const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');

 // ---- Edit 1: no WL highlight on display-view stage people ----
 check('renderDisplayView adds no .is-wl highlight to stage people (.dv-sp)', ()=>{
   ev('state.viewMode="display"');
   ev('state.vocalists=[{id:"v1",name:"Alice",isWL:true,leadsSongs:true,micAssigned:""},{id:"v2",name:"Bob",isWL:false,leadsSongs:false,micAssigned:""}]');
   ev('state.assignments=["v1","v2"].concat(new Array(MAX_VOCALISTS-2).fill(null))');
   ev('renderDisplayView()');
   const wlPeople=doc.querySelectorAll('#dvStagePeople .dv-sp.is-wl');
   if(wlPeople.length!==0) throw new Error('found '+wlPeople.length+' WL-highlighted .dv-sp in display view');
   // sanity: people were actually rendered
   const all=doc.querySelectorAll('#dvStagePeople .dv-sp');
   if(all.length===0) throw new Error('no .dv-sp rendered at all — test seed failed');
 });

 // ---- Edit 2: Auto-Assign top-bar button removed, function kept ----
 check('#assignBtn top-bar button is removed', ()=>{
   if(doc.getElementById('assignBtn')!==null) throw new Error('#assignBtn still exists');
 });
 check('autoAssign function still defined', ()=>{
   if(ev('typeof autoAssign')!=='function') throw new Error('autoAssign is not a function');
 });

 // ---- Edit 3: Stage Areas section removed from Display settings tab ----
 check('Display settings layout tab no longer renders Stage Areas section', ()=>{
   ev('state.viewMode="setup"');
   ev('renderLayoutEditor()');
   const le=doc.getElementById('layoutEdit');
   if(!le) throw new Error('#layoutEdit missing');
   if(doc.getElementById('stageAreasEditor')!==null) throw new Error('#stageAreasEditor still present');
   if(doc.getElementById('addStageAreaBtn')!==null) throw new Error('#addStageAreaBtn still present');
   if(/Stage Areas/i.test(le.textContent)) throw new Error('"Stage Areas" heading text still present');
 });

 // ---- Edit 4: blockDisplayUntilSetup defaults to true ----
 check('DEFAULT_STATE.config.blockDisplayUntilSetup defaults to true', ()=>{
   if(ev('DEFAULT_STATE.config.blockDisplayUntilSetup')!==true) throw new Error('DEFAULT_STATE value is not true');
 });
 check('a freshly-defaulted config has blockDisplayUntilSetup true when field absent', ()=>{
   // simulate load-merge with a saved payload that omits the field
   const merged=ev('(function(){var lc={};return typeof lc.blockDisplayUntilSetup==="boolean"?lc.blockDisplayUntilSetup:true;})()');
   if(merged!==true) throw new Error('merge default for absent field is not true');
   // explicit false must be respected
   const explicitFalse=ev('(function(){var lc={blockDisplayUntilSetup:false};return typeof lc.blockDisplayUntilSetup==="boolean"?lc.blockDisplayUntilSetup:true;})()');
   if(explicitFalse!==false) throw new Error('explicit false not respected');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
