// Batch B display-view: band-row relabels (MD tag on position, instrumentalist-who-sings shown in
// the Band section with their vocal pack), full-name auto-link, front-line placement, drums except.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// Build a known band+vocalist state, then render the display view and return #dvBandList <li>s.
function renderBandRows(setup){
  ev('renderAll=function(){};saveState=function(){};toast=function(){};');
  ev(setup);
  ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup";');
  return [].slice.call(doc.querySelectorAll('#dvBandList .dv-list-item'));
}

window.addEventListener('load',()=>setTimeout(()=>{

 check('MD band row: "· MD" is on the .pos cell, NOT the .name cell', ()=>{
   const rows=renderBandRows(`
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'Abraham Mata',vocalistPlayer:null}];
     state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null);
     state.musicDirectorId='inst_bass';
   `);
   if(rows.length!==1) throw new Error('expected 1 band row, got '+rows.length);
   const pos=rows[0].querySelector('.pos').textContent;
   const name=rows[0].querySelector('.name').textContent;
   if(!/·\s*MD/i.test(pos)) throw new Error('pos should contain "· MD": '+pos);
   if(/·\s*MD/i.test(name)) throw new Error('name must NOT contain "· MD": '+name);
   if(rows[0].querySelector('.name.is-md')) throw new Error('.name should no longer carry is-md');
 });

 check('linked instrumentalist appears in Band list as "Instr · Vocal N | Name | vocal pack"', ()=>{
   const rows=renderBandRows(`
     state.vocalists=[{id:'v1',name:'Jane Smith',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[2]='v1';
     state.config.voxIemPacks=state.config.voxIemPacks||[]; state.config.voxIemPacks[2]='Vocal C';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'BassPack',assignedTo:'',vocalistPlayer:'v1'}];
     state.musicDirectorId='inst_keys';
   `);
   const li=rows.find(r=>/BASS/i.test(r.querySelector('.pos').textContent));
   if(!li) throw new Error('no bass row rendered for the linked instrumentalist');
   const pos=li.querySelector('.pos').textContent;
   const detail=li.querySelector('.detail').textContent;
   if(!/·\s*VOCAL\s*3/i.test(pos)) throw new Error('pos should read "· Vocal 3": '+pos);
   if(!/Jane/.test(li.querySelector('.name').textContent)) throw new Error('name should be the vocalist');
   if(detail!=='Vocal C') throw new Error('detail should be the VOCAL pack (Vocal C), got: '+detail);
 });

 check('autoLinkBandToVocalists links a same-FULL-name instrument to its vocalist', ()=>{
   ev(`
     state.vocalists=[{id:'v9',name:'Jane Smith',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v9';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'Jane Smith',vocalistPlayer:null}];
   `);
   ev('autoLinkBandToVocalists();');
   const b=JSON.parse(ev(`JSON.stringify(state.instruments.find(i=>i.id==='inst_bass'))`));
   if(b.vocalistPlayer!=='v9') throw new Error('bass should link to v9, got '+b.vocalistPlayer);
   if((b.assignedTo||'')!=='') throw new Error('assignedTo should be cleared after linking');
 });

 check('shared FIRST name only does NOT auto-link', ()=>{
   ev(`
     state.vocalists=[{id:'v10',name:'Jane Doe',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='v10';
     state.instruments=[{id:'inst_eg1',label:'Electric 1',pack:'EG',assignedTo:'Jane Roe',vocalistPlayer:null}];
   `);
   ev('autoLinkBandToVocalists();');
   const eg=JSON.parse(ev(`JSON.stringify(state.instruments.find(i=>i.id==='inst_eg1'))`));
   if(eg.vocalistPlayer) throw new Error('must NOT link Jane Roe(EG) to Jane Doe(vocal)');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
