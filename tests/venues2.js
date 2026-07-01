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
 ev('renderAll=function(){}; toast=function(){};');
 ev('renderVenueSwitcher()');
 check('switcher is force-hidden — multi-venue UI disabled this release', ()=>{
   const el=doc.getElementById('venueSwitch'); if(!el) throw new Error('#venueSwitch missing');
   if(el.style.display!=='none') throw new Error('switcher not hidden: '+el.style.display);
   if(el.querySelectorAll('.venue-chip').length!==0) throw new Error('chips still rendered');
 });
 check('quickAddVenue machinery still clones + adds + switches (no UI)', ()=>{
   ev('window.prompt=function(){return "Student Center"};');
   const before=ev('venuesList().length');
   ev('quickAddVenue()');
   if(ev('venuesList().length')!==before+1) throw new Error('not added');
   if(ev('activeVenue().name')!=='Student Center') throw new Error('new venue not active');
 });
 check('switchVenue machinery still switches the active venue (no UI)', ()=>{
   const ids=JSON.parse(ev('JSON.stringify(venuesList().map(v=>v.id))'));
   const cur=ev('state.activeVenueId');
   const other=ids.find(id=>id!==cur);
   if(!other) throw new Error('no other venue');
   ev('switchVenueAndRefresh("'+other+'")');
   if(ev('state.activeVenueId')!==other) throw new Error('did not switch');
 });
 check('addVenue clones the current live settings at creation time', ()=>{
   ev('state.inventory=[{id:"zz",name:"Clone Test Mic",rank:1}];');
   const id=ev('addVenue("CloneCheck")');
   if(!/Clone Test Mic/.test(ev('JSON.stringify(state.venues["'+id+'"].inventory)'))) throw new Error('clone missing current inventory');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
