// Bespoke display — ORBIT (deep-space / radial). Added 2026-07-08. Mirrors tests/world-terra.js.
// Verifies: renderDisplayView() with state.world='orbit' delegates to renderDisplay_orbit, builds
// into #dvWorldRoot (a glowing constellation star-map stage <svg> with REAL people nodes + a FRONT
// highlight + a vertical "mission timeline" run sheet + a vocalist star legend) from the REAL data,
// hides the default #dvLayout, honors a display toggle, and — critically — the bespoke→default
// restore path re-shows #dvLayout and retires #dvWorldRoot. EVERY world is bespoke now (orbit
// included), so there is no non-bespoke world to switch to; the default fallback is forced by
// temporarily nulling the active world's renderDisplay, rendering, then restoring it.
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

 check('WORLDS.orbit.renderDisplay is wired to a function', ()=>{
   if (ev("typeof WORLDS.orbit.renderDisplay") !== 'function') throw new Error('renderDisplay not a function');
 });

 check('renderDisplayView() with world=orbit runs without throwing', ()=>{
   ev("state.world='orbit'; applyWorld(); renderDisplayView();");
 });

 check('#dvWorldRoot exists, is shown, and carries data-world=orbit', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   if (!root) throw new Error('#dvWorldRoot not created');
   if (root.getAttribute('data-world') !== 'orbit') throw new Error('data-world not orbit');
   if (root.style.display === 'none') throw new Error('#dvWorldRoot is hidden');
 });

 check('#dvLayout (default layout) is hidden while Orbit is active', ()=>{
   const lay = doc.getElementById('dvLayout');
   if (!lay) throw new Error('#dvLayout missing');
   if (lay.style.display !== 'none') throw new Error('#dvLayout not hidden, got "'+lay.style.display+'"');
 });

 check('Orbit renders a star chip per assigned vocalist (3), with names + role', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const chips = root.querySelectorAll('.ow-stars .ow-star');
   if (chips.length !== 3) throw new Error('expected 3 star chips, got '+chips.length);
   if (!/Amelia Garcia/i.test(root.textContent)) throw new Error('vocalist name missing');
   if (!/Vocal 1/i.test(root.textContent)) throw new Error('Vocal n role label missing');
 });

 check('Orbit renders the constellation stage <svg> with a real outline, a FRONT highlight, a link arc, and real people nodes', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const svg = root.querySelector('.ow-map svg');
   if (!svg) throw new Error('no stage svg');
   if (!svg.querySelector('path.ow-stage')) throw new Error('no real stage outline path');
   if (!svg.querySelector('path.ow-front')) throw new Error('no FRONT-edge highlight path');
   if (!svg.querySelector('polyline.ow-link')) throw new Error('no constellation link arc through vocalist nodes');
   const nodes = svg.querySelectorAll('circle.ow-node');
   // 2 band + 3 vocalists = 5 star-nodes
   if (nodes.length < 5) throw new Error('expected >=5 people nodes, got '+nodes.length);
   // band nodes are faint (ow-node-band); at least the 2 band members should be present
   if (svg.querySelectorAll('circle.ow-node-band').length < 2) throw new Error('expected faint band nodes upstage');
   if (!/Ben Ross/i.test(root.textContent)) throw new Error('band member not on stage');
   if (!/▲ AUDIENCE/i.test(root.textContent)) throw new Error('audience-at-top caption missing');
 });

 check('Orbit renders band list + vertical mission-timeline run-sheet items from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const bandRows = root.querySelectorAll('.ow-list .ow-lrow');
   if (bandRows.length < 2) throw new Error('expected band list rows, got '+bandRows.length);
   const steps = root.querySelectorAll('.ow-time .ow-steps .ow-step');
   if (steps.length < 3) throw new Error('expected timeline run-of-service steps, got '+steps.length);
   if (!/Keep Praise/i.test(root.textContent)) throw new Error('run sheet item missing');
   if (!/5m 12s|5:12|5m/i.test(root.textContent)) throw new Error('run sheet duration missing');
   if (!/Carlos M/i.test(root.textContent)) throw new Error('MD band member missing from band list');
 });

 check('honors display toggles — showBand:false drops the band block', ()=>{
   ev("state.config.display.showBand=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   const labels = Array.from(root.querySelectorAll('.ow-label')).map(n=>n.textContent.trim());
   if (labels.some(t=>/^Band$/i.test(t))) throw new Error('band block shown despite showBand:false');
   ev("state.config.display.showBand=true;");
 });

 check('honors display toggles — showStage:false drops the constellation stage', ()=>{
   ev("state.config.display.showStage=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.ow-map svg')) throw new Error('stage svg shown despite showStage:false');
   ev("state.config.display.showStage=true; renderDisplayView();");
 });

 check('honors display toggles — runSheetPosition:hidden drops the mission timeline', ()=>{
   ev("state.config.display.runSheetPosition='hidden'; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.ow-time')) throw new Error('timeline shown despite runSheetPosition:hidden');
   ev("state.config.display.runSheetPosition='right'; renderDisplayView();");
 });

 check('falling through to the DEFAULT skeleton re-shows #dvLayout and retires #dvWorldRoot', ()=>{
   // EVERY world is bespoke now (orbit included) — no non-bespoke world to switch to. Force the
   // default path directly: null the active world's renderer so renderDisplayView() falls through
   // to the default #dvLayout, then restore it.
   ev("__savedRD = WORLDS[state.world].renderDisplay; WORLDS[state.world].renderDisplay = undefined; renderDisplayView(); WORLDS[state.world].renderDisplay = __savedRD;");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!lay || lay.style.display === 'none') throw new Error('#dvLayout not re-shown for default path');
   if (root && root.style.display !== 'none') throw new Error('#dvWorldRoot not hidden for default path');
   if (root && root.innerHTML.trim() !== '') throw new Error('#dvWorldRoot not emptied for default path');
 });

 check('rendering Orbit again after the default fall-through re-populates #dvWorldRoot and re-hides #dvLayout', ()=>{
   ev("renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!root || root.querySelectorAll('.ow-star').length !== 3) throw new Error('#dvWorldRoot not re-populated');
   if (!lay || lay.style.display !== 'none') throw new Error('#dvLayout not re-hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
