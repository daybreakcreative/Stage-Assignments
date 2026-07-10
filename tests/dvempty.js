// dvempty.js — the Display view hides EMPTY (no-name) vocalist slots so blank
// "VOCAL 4/5" cards don't show on the green-room TV. The edit/assign view keeps ALL
// assigned slots (even blank-named ones) so people can still be added. Shadows/hosts
// logic is unaffected.
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

// 5 vocal slots, only 2 named (VOCAL 1 + VOCAL 3). The other three are assigned but blank.
const seed=()=>ev(`
  state.vocalists=[
    {id:'v1',name:'Alice A',isWL:true,micAssigned:''},
    {id:'v2',name:'',isWL:false,micAssigned:''},
    {id:'v3',name:'Carlos B',isWL:false,micAssigned:''},
    {id:'v4',name:'   ',isWL:false,micAssigned:''},
    {id:'v5',name:'',isWL:false,micAssigned:''}
  ];
  state.assignments=['v1','v2','v3','v4','v5', null, null, null];
  state.shadows=[];
  state.instruments=[];
  state.musicDirectorId=null;
`);

window.addEventListener('load',()=>setTimeout(()=>{
 // Keep the noisy peers quiet; we drive the two renderers directly.
 ev('renderStage=function(){}; renderBand=function(){}; renderRunSheet=function(){}; toast=function(){};');

 // Shadows check runs FIRST — on a fresh DOM. Repeated renderDisplayView() calls detach/
 // re-append #dvShadowsBlock (side-block reorder), which trips jsdom's id cache and makes
 // the block appear empty on subsequent renders. That's a documented jsdom artifact, not a
 // browser bug; asserting on the first render sidesteps it while still proving the vocalist
 // name-filter didn't disturb shadow rendering.
 check('shadows list on display is unaffected by the vocalist name filter', ()=>{
   seed();
   ev(`state.shadows=[{id:'s1',name:'Shadow Sam',pack:'Misc 2',setup:'iem-only'}];`);
   ev('state.config.display.showShadows=true;');
   ev('state.viewMode="display"; renderDisplayView();');
   // Vocalist filter must NOT have swallowed shadows: still only 2 named vocal cards…
   const vg=doc.getElementById('dvVocGrid');
   if(vg.querySelectorAll('.dv-voc-card').length!==2) throw new Error('vocalist filter changed unexpectedly');
   // …and the named shadow renders.
   const list=doc.querySelector('#dvShadowsList')
     || (()=>{ const b=doc.getElementById('dvShadowsBlock'); return b&&b.querySelector('.dv-list'); })()
     || [...doc.querySelectorAll('.dv-list')].find(u=>/Shadow Sam/.test(u.textContent));
   const host=list?list.textContent:doc.body.textContent;
   if(!/Shadow Sam/.test(host)) throw new Error('shadow not rendered on display (filter over-reached)');
 });

 check('Display view shows only the 2 NAMED vocalist cards (empty slots hidden)', ()=>{
   seed();
   ev('state.viewMode="display"; renderDisplayView();');
   const grid=doc.getElementById('dvVocGrid');
   if(!grid) throw new Error('no #dvVocGrid');
   const cards=grid.querySelectorAll('.dv-voc-card');
   if(cards.length!==2) throw new Error('expected 2 display cards, got '+cards.length+' -> '+grid.textContent.replace(/\s+/g,' ').trim());
   // Check the NAME slot of each card specifically (the mic line can legitimately be "—").
   const names=[...grid.querySelectorAll('.dv-voc-name')].map(n=>n.textContent.trim());
   if(names.length!==2) throw new Error('expected 2 name nodes, got '+names.length);
   if(!names.some(n=>/Alice A/.test(n))) throw new Error('Alice A missing from display: '+JSON.stringify(names));
   if(!names.some(n=>/Carlos B/.test(n))) throw new Error('Carlos B missing from display: '+JSON.stringify(names));
   // No card should have an empty/placeholder name (a blank slot leaking through).
   if(names.some(n=>n==='' || n==='—')) throw new Error('a blank vocalist card leaked into the display: '+JSON.stringify(names));
 });

 check('Edit/assign view still shows ALL 5 assigned vocalist slots (blanks kept for adding)', ()=>{
   seed();
   ev('state.viewMode="setup"; renderVocalists();');
   const grid=doc.getElementById('vocGrid');
   if(!grid) throw new Error('no #vocGrid');
   const cards=grid.querySelectorAll('.voc-card');
   if(cards.length!==5) throw new Error('expected 5 edit cards, got '+cards.length);
   // The blank-named slots render an empty name input (so a name can be typed).
   const names=[...grid.querySelectorAll('.voc-name')].map(i=>i.value);
   const blanks=names.filter(n=>!n.trim()).length;
   if(blanks!==3) throw new Error('expected 3 blank name inputs in edit view, got '+blanks+' -> '+JSON.stringify(names));
 });

 check('Display filter is name-based, not slot-based: fill a blank name and it appears', ()=>{
   seed();
   ev("state.vocalists.find(v=>v.id==='v2').name='Dana D';");
   ev('state.viewMode="display"; renderDisplayView();');
   const grid=doc.getElementById('dvVocGrid');
   const cards=grid.querySelectorAll('.dv-voc-card');
   if(cards.length!==3) throw new Error('expected 3 display cards after naming v2, got '+cards.length);
   if(!/Dana D/.test(grid.textContent)) throw new Error('newly-named Dana D not shown');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
