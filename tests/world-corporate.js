// Bespoke display — CORPORATE (editorial / premium list layout). Added 2026-07-08.
// Verifies: renderDisplayView() with state.world='corporate' delegates to
// renderDisplay_corporate, builds into #dvWorldRoot (a typographic vocalist LIST +
// a thin-line stage <svg> with a FRONT highlight + a roman-numeral Run of Service)
// from the REAL data, hides the default #dvLayout, honors a display toggle, and —
// critically — switching to a non-bespoke world (terra) re-shows #dvLayout and
// retires #dvWorldRoot. (Mirrors tests/world-concrete.js.)
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

 check('WORLDS.corporate.renderDisplay is wired to a function', ()=>{
   if (ev("typeof WORLDS.corporate.renderDisplay") !== 'function') throw new Error('renderDisplay not a function');
 });

 check('renderDisplayView() with world=corporate runs without throwing', ()=>{
   ev("state.world='corporate'; applyWorld(); renderDisplayView();");
 });

 check('#dvWorldRoot exists, is shown, and carries data-world=corporate', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   if (!root) throw new Error('#dvWorldRoot not created');
   if (root.getAttribute('data-world') !== 'corporate') throw new Error('data-world not corporate');
   if (root.style.display === 'none') throw new Error('#dvWorldRoot is hidden');
 });

 check('#dvLayout (default layout) is hidden while Corporate is active', ()=>{
   const lay = doc.getElementById('dvLayout');
   if (!lay) throw new Error('#dvLayout missing');
   if (lay.style.display !== 'none') throw new Error('#dvLayout not hidden, got "'+lay.style.display+'"');
 });

 check('Corporate renders a typographic list row per assigned vocalist (3), with names', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const rows = root.querySelectorAll('.pw-vlist .pw-vrow');
   if (rows.length !== 3) throw new Error('expected 3 vocalist list rows, got '+rows.length);
   if (!/Amelia Garcia/i.test(root.textContent)) throw new Error('vocalist name missing');
   if (!/Vocal 1/i.test(root.textContent)) throw new Error('Vocal n role label missing');
   // Editorial layout = a LIST, not cards: there must be NO card-style cells here.
   if (root.querySelector('.cw-cell') || root.querySelector('.mw-lrow')) throw new Error('leaked card/lineup markup from another world');
 });

 check('Corporate renders the thin-line stage <svg> with real people dots + a FRONT highlight', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const svg = root.querySelector('.pw-stage svg');
   if (!svg) throw new Error('no stage svg');
   if (!svg.querySelector('path.pw-edge')) throw new Error('no stage edge path');
   if (!svg.querySelector('.pw-front')) throw new Error('no FRONT highlight element');
   const dots = svg.querySelectorAll('circle.pw-dt');
   // 2 band + 3 vocalists = 5 markers
   if (dots.length < 5) throw new Error('expected >=5 people dots, got '+dots.length);
   if (!/Ben Ross/i.test(root.textContent)) throw new Error('band member not on stage');
 });

 check('Corporate renders band list rows + a roman-numeral Run of Service from real data', ()=>{
   const root = doc.getElementById('dvWorldRoot');
   const bandRows = root.querySelectorAll('.pw-list .pw-lrow');
   if (bandRows.length < 2) throw new Error('expected band list rows, got '+bandRows.length);
   if (!/Carlos M/i.test(root.textContent)) throw new Error('MD band member missing from band list');
   const orderRows = root.querySelectorAll('.pw-order .pw-orow');
   if (orderRows.length < 3) throw new Error('expected run-of-service rows, got '+orderRows.length);
   if (!/Keep Praise/i.test(root.textContent)) throw new Error('run sheet item missing');
   if (!/5m 12s|5:12|5m/i.test(root.textContent)) throw new Error('run sheet duration missing');
   // Roman numerals: I, II, III on the three items.
   const nums = Array.from(root.querySelectorAll('.pw-order .pw-onum')).map(n=>n.textContent.trim());
   if (!(nums.includes('I.') && nums.includes('II.') && nums.includes('III.'))) throw new Error('roman numerals missing/incorrect: '+JSON.stringify(nums));
 });

 check('honors display toggles — showBand:false drops the band list', ()=>{
   // Count the band list rows before + after. Band + Hosts share .pw-list markup and band
   // members also appear on the stage, so assert on the delta in .pw-list rows (band = 2 rows,
   // hosts = 1 row) plus the disappearance of the "Band" section label specifically.
   ev("state.config.display.showBand=true; renderDisplayView();");
   const rootOn = doc.getElementById('dvWorldRoot');
   const rowsOn = rootOn.querySelectorAll('.pw-list .pw-lrow').length;
   const labelsOn = Array.from(rootOn.querySelectorAll('.pw-label')).map(n=>n.textContent.trim());
   if (!labelsOn.includes('Band')) throw new Error('Band label absent when showBand:true');
   ev("state.config.display.showBand=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   const rowsOff = root.querySelectorAll('.pw-list .pw-lrow').length;
   const labelsOff = Array.from(root.querySelectorAll('.pw-label')).map(n=>n.textContent.trim());
   if (labelsOff.includes('Band')) throw new Error('Band label shown despite showBand:false');
   if (rowsOff >= rowsOn) throw new Error('band list rows not dropped ('+rowsOn+' -> '+rowsOff+')');
   ev("state.config.display.showBand=true;");
 });

 check('honors display toggles — showStage:false drops the thin-line stage', ()=>{
   ev("state.config.display.showStage=false; renderDisplayView();");
   const root = doc.getElementById('dvWorldRoot');
   if (root.querySelector('.pw-stage svg')) throw new Error('stage svg shown despite showStage:false');
   ev("state.config.display.showStage=true; renderDisplayView();");
 });

 check('switching to a non-bespoke world (terra) re-shows #dvLayout and retires #dvWorldRoot', ()=>{
   // terra is still a default-skeleton fallback — use it to exercise the bespoke→default restore path.
   ev("state.world='terra'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!lay || lay.style.display === 'none') throw new Error('#dvLayout not re-shown for terra');
   if (root && root.style.display !== 'none') throw new Error('#dvWorldRoot not hidden for terra');
   if (root && root.innerHTML.trim() !== '') throw new Error('#dvWorldRoot not emptied for terra');
 });

 check('switching back to corporate re-populates #dvWorldRoot and re-hides #dvLayout', ()=>{
   ev("state.world='corporate'; applyWorld(); renderDisplayView();");
   const lay = doc.getElementById('dvLayout');
   const root = doc.getElementById('dvWorldRoot');
   if (!root || root.querySelectorAll('.pw-vlist .pw-vrow').length !== 3) throw new Error('#dvWorldRoot not re-populated');
   if (!lay || lay.style.display !== 'none') throw new Error('#dvLayout not re-hidden');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
