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
const fire=(el,t)=>el.dispatchEvent(new window.Event(t,{bubbles:true}));
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}; toast=function(){}; window.confirm=function(){return true};');
 ev('if(venuesList().length<2){ addVenue("Meadowlark"); }');
 ev('renderVenuesEditor()');
 check('panel renders a row per venue with rename input + Active badge + duplicate/delete', ()=>{
   const rows=doc.querySelectorAll('#venuesEdit .venue-manage-row');
   if(rows.length!==ev('venuesList().length')) throw new Error('rows='+rows.length);
   if(!doc.querySelector('#venuesEdit .venue-active-badge')) throw new Error('no active badge');
   if(!doc.querySelector('#venuesEdit [data-venue-dup]')) throw new Error('no duplicate');
   if(!doc.querySelector('#venuesEdit [data-venue-del]')) throw new Error('no delete');
   if(!doc.querySelector('#venuesEdit [data-venue-name]')) throw new Error('no name input');
 });
 check('rename commits on change to state (top-bar chip UI disabled this release)', ()=>{
   const aid=ev('state.activeVenueId');
   const inp=doc.querySelector('#venuesEdit [data-venue-name="'+aid+'"]');
   inp.value='Carlsbad Main'; fire(inp,'change');
   if(ev('state.venues["'+aid+'"].name')!=='Carlsbad Main') throw new Error('name not saved');
   const sw=doc.getElementById('venueSwitch');
   if(sw && sw.style.display!=='none') throw new Error('switcher should stay hidden');
 });
 check('duplicate adds a "… copy" without switching the active venue', ()=>{
   const aid=ev('state.activeVenueId'); const before=ev('venuesList().length');
   const other=ev('venuesList().find(v=>v.id!==state.activeVenueId).id');
   fire(doc.querySelector('#venuesEdit [data-venue-dup="'+other+'"]'),'click');
   if(ev('venuesList().length')!==before+1) throw new Error('not duplicated');
   if(ev('state.activeVenueId')!==aid) throw new Error('active changed on duplicate');
   if(!ev('venuesList().some(v=>/copy$/.test(v.name))')) throw new Error('no copy');
 });
 check('delete a non-active venue removes only it', ()=>{
   const aid=ev('state.activeVenueId'); const before=ev('venuesList().length');
   const victim=ev('venuesList().find(v=>v.id!==state.activeVenueId).id');
   fire(doc.querySelector('#venuesEdit [data-venue-del="'+victim+'"]'),'click');
   if(ev('venuesList().length')!==before-1) throw new Error('not deleted');
   if(ev('state.activeVenueId')!==aid) throw new Error('active changed');
   if(ev('!!state.venues["'+victim+'"]')) throw new Error('victim remains');
 });
 check('deleting the ACTIVE venue moves to a survivor and stays valid', ()=>{
   ev('if(venuesList().length<2){ addVenue("Temp"); renderVenuesEditor(); }');
   const aid=ev('state.activeVenueId'); const before=ev('venuesList().length');
   fire(doc.querySelector('#venuesEdit [data-venue-del="'+aid+'"]'),'click');
   if(ev('venuesList().length')!==before-1) throw new Error('active not deleted');
   if(ev('state.activeVenueId')===aid) throw new Error('still points at deleted');
   if(!ev('!!state.venues[state.activeVenueId]')) throw new Error('active id invalid');
 });
 check('cannot delete the last remaining venue (button disabled + guard no-op)', ()=>{
   ev('Object.keys(state.venues).filter(id=>id!==state.activeVenueId).forEach(id=>{delete state.venues[id]}); saveState(); renderVenuesEditor();');
   if(ev('venuesList().length')!==1) throw new Error('setup expected 1');
   if(!doc.querySelector('#venuesEdit [data-venue-del]').disabled) throw new Error('delete not disabled at 1');
   if(ev('deleteVenue(state.activeVenueId); venuesList().length')!==1) throw new Error('guard failed');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
