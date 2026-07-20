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

 check('placeLinkedInstrumentalists moves a non-leader keys player to the stage-right-nearest non-leader slot', ()=>{
   ev(`
     state.vocalists=[
       {id:'vk',name:'Kay Board',leadsSongs:false,isWL:false,micAssigned:''},
       {id:'vl1',name:'Lea One',leadsSongs:true,isWL:true,micAssigned:''},
       {id:'vl2',name:'Lou Two',leadsSongs:true,isWL:false,micAssigned:''},
       {id:'ve',name:'Ed Edge',leadsSongs:false,isWL:false,micAssigned:''}
     ];
     state.serviceOrder=[];
     state.assignments=computePositions(state.vocalists);
     state.instruments=[{id:'inst_keys',label:'Keys',pack:'Keys',assignedTo:'',vocalistPlayer:'vk'}];
     state.musicDirectorId='inst_keys';
   `);
   ev('placeLinkedInstrumentalists();');
   const after=JSON.parse(ev(`(function(){
     var filled=state.assignments.filter(a=>a!==null);
     var vp=getVoxPositions(filled.length);
     var byId={}; var k=0;
     for(var i=0;i<state.assignments.length;i++){ if(state.assignments[i]) byId[state.assignments[i]]=vp[k++].x; }
     return JSON.stringify(byId);
   })()`));
   // keys player's slot X after placement must be >= the other non-leader's slot X (stage-right)
   if(!(after['vk'] >= after['ve'])) throw new Error('keys player not moved stage-right: vk='+after['vk']+' ve='+after['ve']);
   // a leader should not sit at the stage-right extreme (they stay centered)
   const xs=Object.keys(after).map(k=>after[k]).sort((a,b)=>a-b);
   const maxX=xs[xs.length-1];
   if(after['vl1']===maxX && after['vk']!==maxX) throw new Error('leader vl1 should not sit at the stage-right extreme');
 });

 function renderStageMarks(setup){
   ev('renderAll=function(){};saveState=function(){};toast=function(){};');
   ev(setup);
   ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup";');
   return [].slice.call(doc.querySelectorAll('#dvStagePeople .dv-sp')).map(el=>({
     role:(el.querySelector('.dv-sp-role')||{}).textContent||'',
     name:(el.querySelector('.dv-sp-name')||{}).textContent||''
   }));
 }

 check('a singing drummer keeps the kit mark and gets NO front-line vocal mark', ()=>{
   const marks=renderStageMarks(`
     state.vocalists=[{id:'vd',name:'Drew Kit',leadsSongs:false,isWL:false,micAssigned:''},
                      {id:'vs',name:'Sam Sing',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='vd'; state.assignments[1]='vs';
     state.instruments=[{id:'inst_drums',label:'Drums',pack:'Drum',assignedTo:'',vocalistPlayer:'vd'}];
     state.musicDirectorId='inst_keys';
   `);
   const drumKit=marks.find(m=>/DRUMS/i.test(m.role));
   if(!drumKit) throw new Error('drum-kit stage mark should still render for a singing drummer');
   if(!/Drew Kit/.test(drumKit.name)) throw new Error('drum-kit mark should be labelled with the drummer name, got: '+drumKit.name);
   const drummerVocal=marks.filter(m=>/VOCAL/i.test(m.role) && /Drew Kit/.test(m.name));
   if(drummerVocal.length) throw new Error('drummer must NOT get a front-line VOCAL mark');
   if(!marks.some(m=>/VOCAL/i.test(m.role) && /Sam Sing/.test(m.name))) throw new Error('non-drummer singer should still show at a vocal position');
 });

 check('a linked MELODIC instrument still has NO band stage mark (player shows at vocal pos)', ()=>{
   const marks=renderStageMarks(`
     state.vocalists=[{id:'vb',name:'Bo Bass',leadsSongs:false,isWL:false,micAssigned:''}];
     state.assignments=new Array(MAX_VOCALISTS).fill(null); state.assignments[0]='vb';
     state.instruments=[{id:'inst_bass',label:'Bass',pack:'Bass',assignedTo:'',vocalistPlayer:'vb'}];
     state.musicDirectorId='inst_keys';
   `);
   // Only band-kind marks carry a bare instrument-label role; the vocal mark legitimately shows
   // a "VOCAL N / Bass" tag suffix for a linked instrument, so exclude VOCAL roles from this check.
   if(marks.some(m=>!/^VOCAL/i.test(m.role) && /BASS/i.test(m.role))) throw new Error('a linked bass should NOT get a band stage mark');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
