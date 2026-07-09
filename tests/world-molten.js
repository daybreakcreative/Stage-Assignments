// Bespoke display — MOLTEN (the DEFAULT world; second per-world layout). Added 2026-07-08.
// Verifies: renderDisplayView() with state.world='molten' delegates to renderDisplay_molten,
// builds into #dvWorldRoot (an EQUAL lineup row per assigned vocalist + an ember stage <svg> +
// warm service-order rows) from the REAL data, hides the default #dvLayout, and — critically —
// the bespoke→default restore path re-shows #dvLayout and retires #dvWorldRoot.
// NOTE: EVERY world is bespoke now (concrete/molten/corporate/terra/orbit), so there is no
// non-bespoke world to switch to. To exercise the default fallback we force the default path
// directly: temporarily null the active world's renderDisplay, render, then restore it.
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
 // Seed REAL data: 3 vocalists (assigned), 2 band instruments, a host, a service order.
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

 check('WORLDS.molten.renderDisplay is wired to a function', ()=>{
   if (ev("typeof WORLDS.molten.renderDisplay") !== 'function') throw new Error('renderDisplay not a function');
 });

 check('renderDisplayView() with world=molten runs without throwing', ()=>{
   ev("state.world='molten'; applyWorld(); renderDisplayView();");
 });

 check('#dvWorldRoot exists, is shown, and carries data-world=molten', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   if (!root) throw new Error('#dvWorldRoot not created');
   if (root.getAttribute('data-world') !== 'molten') throw new Error('data-world not molten');
   if (root.style.display === 'none') throw new Error('#dvWorldRoot is hidden');
 });

 check('#dvLayout (default layout) is hidden while Molten is active', ()=>{
   const lay = doc.getElementById('dvLayout');
   if (!lay) throw new Error('#dvLayout missing');
   if (lay.style.display !== 'none') throw new Error('#dvLayout not hidden, got "'+lay.style.display+'"');
 });

 check('Molten renders one EQUAL lineup row per assigned vocalist (3), with names', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const lrows = root.querySelectorAll('.mw-lineup .mw-lrow');
   if (lrows.length !== 3) throw new Error('expected 3 lineup rows, got '+lrows.length);
   if (!/AMELIA GARCIA/i.test(root.textContent)) throw new Error('vocalist name missing');
   if (!/VOCAL 1/i.test(root.textContent)) throw new Error('VOCAL n role label missing');
   // Every voice equal — no worship-leader emphasis (no is-wl / hero markup).
   if (root.querySelector('.is-wl, .mw-hero')) throw new Error('unexpected worship-leader emphasis in Molten lineup');
 });

 check('Molten shows the mic badge from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const badges = root.querySelectorAll('.mw-lbadge');
   if (!badges.length) throw new Error('no mic/iem badges rendered');
   if (!/HH-1/i.test(root.textContent)) throw new Error('mic assignment missing');
 });

 check('Molten renders the ember stage <svg> with real people dots', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const svg = root.querySelector('.mw-stagewrap svg');
   if (!svg) throw new Error('no stage svg');
   if (!svg.querySelector('path.mw-edge')) throw new Error('no stage edge path');
   const dots = svg.querySelectorAll('circle.mw-dt');
   // 2 band + 3 vocalists = 5 markers
   if (dots.length < 5) throw new Error('expected >=5 people dots, got '+dots.length);
   if (!/BEN ROSS/i.test(root.textContent)) throw new Error('band member not on stage');
 });

 check('Molten renders band + service-order rows from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const rows = root.querySelectorAll('.mw-rows .mw-row');
   if (rows.length < 3) throw new Error('expected warm rows, got '+rows.length);
   if (!/Keep Praise/i.test(root.textContent)) throw new Error('service-order item missing');
   if (!/5m 12s|5:12|5m/i.test(root.textContent)) throw new Error('service-order duration missing');
   if (!/Carlos M/i.test(root.textContent)) throw new Error('MD band member missing from band rows');
 });

 check('honors display toggles — showBand:false drops the band rows', ()=>{
   ev("state.config.display.showBand=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   const labels = Array.from(root.querySelectorAll('.mw-label')).map(n=>n.textContent);
   if (labels.some(t=>/^Band$/i.test(t.trim()))) throw new Error('band section shown despite showBand:false');
   ev("state.config.display.showBand=true;");
 });

 check('honors display toggles — showStage:false drops the ember stage', ()=>{
   ev("state.config.display.showStage=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.mw-stagewrap svg')) throw new Error('stage svg shown despite showStage:false');
   ev("state.config.display.showStage=true; renderDisplayView();");
 });

 check('falling through to the DEFAULT skeleton re-shows #dvLayout and retires #dvWorldRoot', ()=>{
   // EVERY world is bespoke now — no non-bespoke world to switch to. Force the default path
   // directly: null the active world's renderer so renderDisplayView() falls through to the
   // default #dvLayout, then restore it.
   ev("__savedRD = WORLDS[state.world].renderDisplay; WORLDS[state.world].renderDisplay = undefined; renderDisplayView(); WORLDS[state.world].renderDisplay = __savedRD;");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!lay || lay.style.display === 'none') throw new Error('#dvLayout not re-shown for default path');
   if (root && root.style.display !== 'none') throw new Error('#dvWorldRoot not hidden for default path');
   if (root && root.innerHTML.trim() !== '') throw new Error('#dvWorldRoot not emptied for default path');
 });

 check('switching back to molten re-populates #dvWorldRoot and re-hides #dvLayout', ()=>{
   ev("state.world='molten'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!root || root.querySelectorAll('.mw-lineup .mw-lrow').length !== 3) throw new Error('#dvWorldRoot not re-populated');
   if (!lay || lay.style.display !== 'none') throw new Error('#dvLayout not re-hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
