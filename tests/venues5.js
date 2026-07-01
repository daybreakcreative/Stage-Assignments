const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev(`
   renderAll=function(){}; toast=function(){};
   var cid=state.activeVenueId; state.venues[cid].pcoServiceTypeId='1058760'; state.venues[cid].name='Main Campus';
   state.pcoConfig.selectedServiceTypeId='1058760';
   var mid='v_m5'; state.venues[mid]=Object.assign({}, extractVenueFields(state), {id:mid,name:'Student Center',pcoServiceTypeId:'1662354'});
   window.__cid=cid; window.__mid=mid;
 `);
 check('venueForServiceType returns the sole owner, null when none or ambiguous', ()=>{
   if(ev('(venueForServiceType("1662354")||{}).id')!==ev('window.__mid')) throw new Error('Student Center not matched');
   if(ev('(venueForServiceType("1058760")||{}).id')!==ev('window.__cid')) throw new Error('Main Campus not matched');
   if(ev('venueForServiceType("9999")')!==null) throw new Error('unknown not null');
   ev('state.venues[window.__mid].pcoServiceTypeId="1058760";');
   if(ev('venueForServiceType("1058760")')!==null) throw new Error('ambiguous not null');
   ev('state.venues[window.__mid].pcoServiceTypeId="1662354";');
 });
 check('settings header venue tag is force-hidden this release (even with >1 venue)', ()=>{
   ev('updateSettingsVenueTag()');
   const tag=doc.getElementById('settingsVenueTag');
   if(tag.style.display!=='none') throw new Error('tag should be hidden, got: '+tag.style.display);
   ev('delete state.venues[window.__mid]; updateSettingsVenueTag();');
   if(doc.getElementById('settingsVenueTag').style.display!=='none') throw new Error('should stay hidden with 1 venue');
   ev('state.venues[window.__mid]=Object.assign({}, extractVenueFields(state), {id:window.__mid,name:"Student Center",pcoServiceTypeId:"1662354"});');
 });
 check('PCO dropdown sync points at the active venue service type', ()=>{
   ev('pcoServiceTypes=[{id:"1058760",name:"Main Campus Sunday",folderName:""},{id:"1662354",name:"Student Center Sunday",folderName:""}]; pcoLoadPlans=function(){}; populateServiceTypeSelect();');
   ev('state.pcoConfig.selectedServiceTypeId="1662354"; syncPcoServiceTypeUI();');
   if(doc.getElementById('pcoServiceTypeSelect').value!=='1662354') throw new Error('not synced: '+doc.getElementById('pcoServiceTypeSelect').value);
 });
 check('pulling a plan from another venue service type switches venue on confirm', ()=>{
   ev('window.confirm=function(){return true}; pcoFetch=async function(){throw new Error("stub")}; pcoServiceTypes=[];');
   ev('state.pcoConfig.selectedServiceTypeId="1662354";');
   if(ev('state.activeVenueId')!==ev('window.__cid')) throw new Error('precondition: active should be Main Campus');
   ev('pcoPullPlan("plan1")');
   if(ev('state.activeVenueId')!==ev('window.__mid')) throw new Error('did not switch to Student Center on pull');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
