// "Grayson is always VOCAL 3." Positions were re-derived from scratch on every add, remove and
// Planning Center pull, so a person's slot was whatever the fan-out happened to give them that
// week -- you could drag them into place, then lose it on the next pull. A pin remembers it.
//
// Pins are keyed by NORMALISED NAME, not vocalist id: ids are minted per service, so an id-keyed
// pin would evaporate on the next PCO pull, which is exactly the case this exists for.
//
// Gap-free still wins. Dillon chose "always gap-free" when the numbering bug was fixed, so a pin is
// honoured only where it doesn't punch a hole: pinning someone to VOCAL 5 in a four-person band
// puts them last, not at 5 with a gap. That is a deliberate clamp, not a rounding error.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 // Four vocalists, deliberately in an order that does NOT already satisfy the pins.
 const seed=(names)=>ev(`state.config.vocalPins={};
   state.vocalists=${JSON.stringify(names)}.map((n,i)=>({id:'v'+i,name:n}));
   state.assignments=computePositions(state.vocalists);`);
 const order=()=>JSON.parse(ev(`JSON.stringify(state.assignments.map(id=>{
   var v=(state.vocalists||[]).find(x=>x&&x.id===id); return v?v.name:null;}))`));
 const NAMES=['Libby McDonald','Caleb Quirino','Grayson Kredit','Ella Graves'];

 console.log('--- the pin itself ---');

 check('pinning a vocalist records their slot by normalised name', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Grayson Kredit', 2)`);
   const pins=JSON.parse(ev(`JSON.stringify(state.config.vocalPins)`));
   if(pins['grayson kredit']!==2) throw new Error(JSON.stringify(pins));
 });

 check('pins are keyed by name, so they survive new vocalist ids', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Grayson Kredit', 2)`);
   // A fresh PCO pull mints brand-new ids for the same humans.
   ev(`state.vocalists=${JSON.stringify(NAMES)}.map((n,i)=>({id:'pco_'+i,name:n}));
       state.assignments=computePositions(state.vocalists);`);
   if(order()[2]!=='Grayson Kredit') throw new Error('pin lost across new ids: '+JSON.stringify(order()));
 });

 check('unpinning clears it', ()=>{
   seed(NAMES); ev(`setVocalPin('Grayson Kredit',2)`); ev(`clearVocalPin('Grayson Kredit')`);
   const pins=JSON.parse(ev(`JSON.stringify(state.config.vocalPins)`));
   if('grayson kredit' in pins) throw new Error('still pinned: '+JSON.stringify(pins));
 });

 check('vocalPinFor reports the pin, or null', ()=>{
   seed(NAMES); ev(`setVocalPin('Grayson Kredit',2)`);
   if(ev(`vocalPinFor('grayson  KREDIT')`)!==2) throw new Error('normalisation not applied');
   if(ev(`vocalPinFor('Nobody At All')`)!==null) throw new Error('unpinned should be null');
 });

 console.log('--- pins drive the positions ---');

 check('a pinned vocalist lands in their slot after a recompute', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Ella Graves',0)`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   if(order()[0]!=='Ella Graves') throw new Error(JSON.stringify(order()));
 });

 // Compared against the UNPINNED baseline, not a guessed order: positions come from a centred
 // fan-out, so the natural order is not the order the vocalists were added in.
 check('everyone else keeps their relative order around the pin', ()=>{
   seed(NAMES);
   const base=order().filter(Boolean).filter(n=>n!=='Ella Graves');
   ev(`setVocalPin('Ella Graves',0)`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   const rest=order().filter(Boolean).filter(n=>n!=='Ella Graves');
   if(rest.join('|')!==base.join('|')) throw new Error('was '+JSON.stringify(base)+' now '+JSON.stringify(rest));
 });

 check('two pins are both honoured', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Ella Graves',0); setVocalPin('Libby McDonald',3);`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   const o=order();
   if(o[0]!=='Ella Graves'||o[3]!=='Libby McDonald') throw new Error(JSON.stringify(o));
 });

 check('the result is always gap-free', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Ella Graves',3)`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   const a=JSON.parse(ev(`JSON.stringify(state.assignments)`));
   const firstNull=a.indexOf(null);
   if(firstNull!==-1 && a.slice(firstNull).some(Boolean)) throw new Error('hole in the numbering: '+JSON.stringify(a));
 });

 check('a pin past the end of the roster clamps to last, and makes no hole', ()=>{
   seed(NAMES.slice(0,3));                 // only three people
   ev(`setVocalPin('Grayson Kredit',7)`);  // pinned to VOCAL 8
   ev(`state.assignments=computePositions(state.vocalists)`);
   const o=order();
   if(o[2]!=='Grayson Kredit') throw new Error('should clamp to last slot: '+JSON.stringify(o));
   if(o[3]!==null) throw new Error('should not leave a hole: '+JSON.stringify(o));
 });

 check('two people pinned to the SAME slot do not collide or vanish', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Ella Graves',1); setVocalPin('Grayson Kredit',1);`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   const o=order().filter(Boolean);
   if(o.length!==4) throw new Error('someone was dropped: '+JSON.stringify(o));
   if(new Set(o).size!==4) throw new Error('someone was duplicated: '+JSON.stringify(o));
   if(o.indexOf('Ella Graves')!==1) throw new Error('the first-declared pin should win slot 1: '+JSON.stringify(o));
 });

 check('an unpinned roster is completely unchanged', ()=>{
   seed(NAMES);
   const before=order();
   ev(`state.assignments=computePositions(state.vocalists)`);
   if(order().join('|')!==before.join('|')) throw new Error('pins changed behaviour when none are set');
 });

 check('a pin for someone not on the roster this week is simply ignored', ()=>{
   seed(NAMES);
   const base=order();
   ev(`setVocalPin('Someone Away',0)`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   if(order().join('|')!==base.join('|')) throw new Error('absent pin moved people: '+JSON.stringify(order()));
 });

 console.log('--- dragging re-pins ---');

 // Otherwise the next recompute yanks them back to the pin and the drag looks broken.
 check('dragging a PINNED vocalist moves their pin to the new slot', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Grayson Kredit',2)`);
   ev(`state.assignments=computePositions(state.vocalists)`);
   const gid=ev(`(state.vocalists.find(v=>v.name==='Grayson Kredit')||{}).id`);
   ev(`vocalDropOnSlot(${JSON.stringify(gid)},0)`);
   if(ev(`vocalPinFor('Grayson Kredit')`)!==0) throw new Error('pin not followed to slot 0: '+ev(`vocalPinFor('Grayson Kredit')`));
   ev(`state.assignments=computePositions(state.vocalists)`);
   if(order()[0]!=='Grayson Kredit') throw new Error('recompute pulled them back: '+JSON.stringify(order()));
 });

 check('dragging an UNPINNED vocalist does not silently pin them', ()=>{
   seed(NAMES);
   const cid=ev(`(state.vocalists.find(v=>v.name==='Caleb Quirino')||{}).id`);
   ev(`vocalDropOnSlot(${JSON.stringify(cid)},0)`);
   if(ev(`vocalPinFor('Caleb Quirino')`)!==null) throw new Error('drag must not create a pin on its own');
 });

 console.log('--- the control ---');

 check('each vocalist card carries a pin toggle showing its state', ()=>{
   seed(NAMES);
   ev(`setVocalPin('Grayson Kredit',2); state.assignments=computePositions(state.vocalists); renderVocalists&&renderVocalists();`);
   ev(`renderAll()`);
   const btns=doc.querySelectorAll('.voc-card .voc-pin');
   if(!btns.length) throw new Error('no pin control on the vocalist cards');
   const active=Array.from(doc.querySelectorAll('.voc-card .voc-pin.active'));
   if(active.length!==1) throw new Error('expected exactly one active pin, got '+active.length);
   if(active[0].getAttribute('aria-pressed')!=='true') throw new Error('aria-pressed not set on the active pin');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
