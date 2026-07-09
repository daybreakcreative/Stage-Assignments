// Bespoke display — CONCRETE (the first per-world layout). Added 2026-07-08.
// Verifies: renderDisplayView() with state.world='concrete' delegates to renderDisplay_concrete,
// builds into #dvWorldRoot (voice cells + a blueprint stage <svg> + run-sheet manifest rows) from
// the REAL data, hides the default #dvLayout, and — critically — switching to a non-bespoke
// world (orbit) re-shows #dvLayout and retires #dvWorldRoot.
// NOTE: this round-trip used to switch to molten, then corporate, then terra — but all of those
// are now bespoke worlds with their own renderDisplay, so none restore #dvLayout. Use orbit — the
// last remaining default-skeleton fallback — to exercise the bespoke→default restore path.
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

 check('WORLDS.concrete.renderDisplay is wired to a function', ()=>{
   if (ev("typeof WORLDS.concrete.renderDisplay") !== 'function') throw new Error('renderDisplay not a function');
 });

 check('renderDisplayView() with world=concrete runs without throwing', ()=>{
   ev("state.world='concrete'; applyWorld(); renderDisplayView();");
 });

 check('#dvWorldRoot exists, is shown, and carries data-world=concrete', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   if (!root) throw new Error('#dvWorldRoot not created');
   if (root.getAttribute('data-world') !== 'concrete') throw new Error('data-world not concrete');
   if (root.style.display === 'none') throw new Error('#dvWorldRoot is hidden');
 });

 check('#dvLayout (default layout) is hidden while Concrete is active', ()=>{
   const lay = doc.getElementById('dvLayout');
   if (!lay) throw new Error('#dvLayout missing');
   if (lay.style.display !== 'none') throw new Error('#dvLayout not hidden, got "'+lay.style.display+'"');
 });

 check('Concrete renders a voice cell per assigned vocalist (3), with names', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const cells = root.querySelectorAll('.cw-cell');
   if (cells.length !== 3) throw new Error('expected 3 voice cells, got '+cells.length);
   if (!/AMELIA GARCIA/i.test(root.textContent)) throw new Error('vocalist name missing');
   if (!/VOCAL 1/i.test(root.textContent)) throw new Error('VOCAL n role label missing');
 });

 check('Concrete renders the blueprint stage <svg> with real people dots', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const svg = root.querySelector('.cw-stage svg');
   if (!svg) throw new Error('no stage svg');
   if (!svg.querySelector('path.cw-edge')) throw new Error('no stage edge path');
   const dots = svg.querySelectorAll('circle.cw-dt');
   // 2 band + 3 vocalists = 5 markers
   if (dots.length < 5) throw new Error('expected >=5 people dots, got '+dots.length);
   if (!/BEN ROSS/i.test(root.textContent)) throw new Error('band member not on stage');
 });

 check('Concrete renders band + run-sheet manifest rows from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const rows = root.querySelectorAll('.cw-manifest .cw-mrow');
   if (rows.length < 3) throw new Error('expected manifest rows, got '+rows.length);
   if (!/KEEP PRAISE/i.test(root.textContent)) throw new Error('run sheet item missing');
   if (!/5m 12s|5:12|5m/i.test(root.textContent)) throw new Error('run sheet duration missing');
   if (!/CARLOS M/i.test(root.textContent)) throw new Error('MD band member missing from manifest');
 });

 check('honors display toggles — showBand:false drops the band manifest', ()=>{
   ev("state.config.display.showBand=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (/Band — Manifest/i.test(root.textContent)) throw new Error('band manifest shown despite showBand:false');
   ev("state.config.display.showBand=true;");
 });

 check('honors display toggles — showStage:false drops the blueprint stage', ()=>{
   ev("state.config.display.showStage=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.cw-stage svg')) throw new Error('stage svg shown despite showStage:false');
   ev("state.config.display.showStage=true; renderDisplayView();");
 });

 check('switching to a non-bespoke world (orbit) re-shows #dvLayout and retires #dvWorldRoot', ()=>{
   // molten + corporate + terra are all bespoke now, so we switch to orbit (the last default-skeleton fallback) here.
   ev("state.world='orbit'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!lay || lay.style.display === 'none') throw new Error('#dvLayout not re-shown for orbit');
   if (root && root.style.display !== 'none') throw new Error('#dvWorldRoot not hidden for orbit');
   if (root && root.innerHTML.trim() !== '') throw new Error('#dvWorldRoot not emptied for orbit');
 });

 check('switching back to concrete re-populates #dvWorldRoot and re-hides #dvLayout', ()=>{
   ev("state.world='concrete'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!root || root.querySelectorAll('.cw-cell').length !== 3) throw new Error('#dvWorldRoot not re-populated');
   if (!lay || lay.style.display !== 'none') throw new Error('#dvLayout not re-hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
