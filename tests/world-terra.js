// Bespoke display — TERRA (organic / natural). Added 2026-07-08. Mirrors tests/world-concrete.js.
// Verifies: renderDisplayView() with state.world='terra' delegates to renderDisplay_terra, builds
// into #dvWorldRoot (river-stone roster rows + a topographic-contour stage <svg> with a FRONT
// highlight + seed-dot run-sheet items) from the REAL data, hides the default #dvLayout, honors a
// display toggle, and — critically — switching to a non-bespoke world (orbit) re-shows #dvLayout
// and retires #dvWorldRoot, then switching back to terra re-populates it.
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
 ev('renderAll=function(){}; toast=function(){}; saveState=function(){};');
 // Seed REAL data: 3 vocalists (assigned), 2 band instruments, hosts, a service order.
 ev(`
   state.viewMode='display';
   state.vocalists=[{id:'v1',name:'Amelia Garcia',micAssigned:'HH-1'},{id:'v2',name:'Emma Johnson',micAssigned:'HH-2'},{id:'v3',name:'Jake Williams',micAssigned:'HH-3'}];
   state.assignments=new Array(MAX_VOCALISTS).fill(null);
   state.assignments[0]='v1'; state.assignments[1]='v2'; state.assignments[2]='v3';
   state.instruments=[{id:'inst_dr',label:'Drums',assignedTo:'Ben Ross',pack:'Drums'},{id:'inst_kb',label:'Keys',assignedTo:'Carlos M',pack:'Keys'}];
   state.musicDirectorId='inst_kb';
   state.hosts={}; state.hosts[hostChannels()[0].id]='John R';
   state.shadows=[];
   state.serviceOrder=[{id:'o1',kind:'song',title:'Keep Praise',length:312,key:'G'},{id:'o2',kind:'song',title:'Great Are You',length:280},{id:'o3',kind:'item',title:'Welcome',length:120}];
   state.config.showMicCapsules=true;
   state.config.display.showServiceOrder=true;
   state.config.display.runSheetPosition='right';
 `);

 check('WORLDS.terra.renderDisplay is wired to a function', ()=>{
   if (ev("typeof WORLDS.terra.renderDisplay") !== 'function') throw new Error('renderDisplay not a function');
 });

 check('renderDisplayView() with world=terra runs without throwing', ()=>{
   ev("state.world='terra'; applyWorld(); renderDisplayView();");
 });

 check('#dvWorldRoot exists, is shown, and carries data-world=terra', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   if (!root) throw new Error('#dvWorldRoot not created');
   if (root.getAttribute('data-world') !== 'terra') throw new Error('data-world not terra');
   if (root.style.display === 'none') throw new Error('#dvWorldRoot is hidden');
 });

 check('#dvLayout (default layout) is hidden while Terra is active', ()=>{
   const lay = doc.getElementById('dvLayout');
   if (!lay) throw new Error('#dvLayout missing');
   if (lay.style.display !== 'none') throw new Error('#dvLayout not hidden, got "'+lay.style.display+'"');
 });

 check('Terra renders a river-stone per assigned vocalist (3), with names + role', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const stones = root.querySelectorAll('.tw-stones .tw-stone');
   if (stones.length !== 3) throw new Error('expected 3 river-stones, got '+stones.length);
   if (!/Amelia Garcia/i.test(root.textContent)) throw new Error('vocalist name missing');
   if (!/Vocal 1/i.test(root.textContent)) throw new Error('Vocal n role label missing');
 });

 check('Terra renders the topographic stage <svg> with contours, a FRONT highlight, and real people dots', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const svg = root.querySelector('.tw-stage svg');
   if (!svg) throw new Error('no stage svg');
   if (svg.querySelectorAll('path.tw-contour').length < 2) throw new Error('expected nested contour paths');
   if (!svg.querySelector('path.tw-front')) throw new Error('no FRONT-edge highlight path');
   const dots = svg.querySelectorAll('circle.tw-dt');
   // 2 band + 3 vocalists = 5 markers
   if (dots.length < 5) throw new Error('expected >=5 people dots, got '+dots.length);
   if (!/Ben Ross/i.test(root.textContent)) throw new Error('band member not on stage');
 });

 check('Terra renders band list + seed-dot run-sheet items from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const bandRows = root.querySelectorAll('.tw-list .tw-lrow');
   if (bandRows.length < 2) throw new Error('expected band list rows, got '+bandRows.length);
   const runItems = root.querySelectorAll('.tw-order .tw-li');
   if (runItems.length < 3) throw new Error('expected run-of-service items, got '+runItems.length);
   if (!root.querySelector('.tw-order .tw-seed')) throw new Error('run sheet seed dot missing');
   if (!/Keep Praise/i.test(root.textContent)) throw new Error('run sheet item missing');
   if (!/5m 12s|5:12|5m/i.test(root.textContent)) throw new Error('run sheet duration missing');
   if (!/Carlos M/i.test(root.textContent)) throw new Error('MD band member missing from band list');
 });

 check('honors display toggles — showBand:false drops the band block', ()=>{
   ev("state.config.display.showBand=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   // The Band section label should be gone; the roster/run sheet remain.
   const labels = Array.from(root.querySelectorAll('.tw-label')).map(n=>n.textContent.trim());
   if (labels.some(t=>/^Band$/i.test(t))) throw new Error('band block shown despite showBand:false');
   ev("state.config.display.showBand=true;");
 });

 check('honors display toggles — showStage:false drops the topographic stage', ()=>{
   ev("state.config.display.showStage=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.tw-stage svg')) throw new Error('stage svg shown despite showStage:false');
   ev("state.config.display.showStage=true; renderDisplayView();");
 });

 check('switching to a non-bespoke world (orbit) re-shows #dvLayout and retires #dvWorldRoot', ()=>{
   // orbit is still a default-skeleton fallback (no bespoke renderDisplay), so it restores #dvLayout.
   ev("state.world='orbit'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!lay || lay.style.display === 'none') throw new Error('#dvLayout not re-shown for orbit');
   if (root && root.style.display !== 'none') throw new Error('#dvWorldRoot not hidden for orbit');
   if (root && root.innerHTML.trim() !== '') throw new Error('#dvWorldRoot not emptied for orbit');
 });

 check('switching back to terra re-populates #dvWorldRoot and re-hides #dvLayout', ()=>{
   ev("state.world='terra'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!root || root.querySelectorAll('.tw-stone').length !== 3) throw new Error('#dvWorldRoot not re-populated');
   if (!lay || lay.style.display !== 'none') throw new Error('#dvLayout not re-hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
