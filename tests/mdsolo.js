const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('JSDOM ERR',(e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 // A clean fixture: 4 IEM presets; one band inst uses "Band 1"; no vocalists; no shadows.
 const setup=()=>ev(`
   state.config.iemPackPresets=['Band 1','Band 2','Misc 1','Misc 2'];
   state.instruments=[{id:'inst_drums',label:'Drums',assignedTo:'Danny',pack:'Band 1'}];
   state.vocalists=[]; state.assignments=[]; state.shadows=[];
   state.mdSoloName=''; state.mdSoloPack=null;
 `);

 check('pickSpareIemPack prefers an unused MISC preset over an in-use band pack', ()=>{
   setup();
   const p=ev('pickSpareIemPack()');
   if(p!=='Misc 1' && p!=='Misc 2') throw new Error('expected a Misc pack, got '+p);
   if(p==='Band 1') throw new Error('picked an in-use pack');
 });

 check('ensureSoloMdPack assigns a spare pack when a solo MD exists', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; ensureSoloMdPack();");
   const pk=ev('state.mdSoloPack');
   if(!pk) throw new Error('no pack assigned');
   if(pk==='Band 1') throw new Error('assigned an in-use pack: '+pk);
 });

 check('ensureSoloMdPack keeps a still-spare pack stable across refreshes', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Misc 2'; ensureSoloMdPack();");
   if(ev('state.mdSoloPack')!=='Misc 2') throw new Error('stable spare pack was changed to '+ev('state.mdSoloPack'));
 });

 check('ensureSoloMdPack re-picks when the stored pack collides with a real consumer', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Band 1'; ensureSoloMdPack();");
   if(ev('state.mdSoloPack')==='Band 1') throw new Error('kept a colliding pack');
 });

 check('ensureSoloMdPack clears the pack when there is no solo MD', ()=>{
   setup();
   ev("state.mdSoloName=''; state.mdSoloPack='Misc 1'; ensureSoloMdPack();");
   if(ev('state.mdSoloPack')!==null) throw new Error('pack not cleared, got '+ev('state.mdSoloPack'));
 });

 check('findPackConflicts adds the solo MD as an IEM consumer (spare pack = no conflict)', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Misc 1';");
   const r=JSON.parse(ev('JSON.stringify(findPackConflicts())'));
   if(r.hasIssues) throw new Error('spare MD pack should not conflict: '+JSON.stringify(r.fixes));
 });

 check('findPackConflicts flags the solo MD when its pack collides with the band', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Band 1';"); // same as Drums
   const r=JSON.parse(ev('JSON.stringify(findPackConflicts())'));
   if(!r.hasIssues) throw new Error('expected a conflict when MD shares the band pack');
   const names=JSON.stringify(r.fixes.map(f=>f.position&&f.position.name));
   if(!names.includes('Jordan Lee')) throw new Error('MD not among the flagged consumers: '+names);
 });

 check('the summary IEM list shows the solo MD (labeled MD) with its pack', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Misc 1'; fillSummary();");
   const txt=ev("document.getElementById('s_iemList').textContent");
   if(!/Jordan Lee/.test(txt)) throw new Error('MD name missing from IEM list');
   if(!/\bMD\b/.test(txt)) throw new Error('MD label missing from IEM list');
   if(!/Misc 1/.test(txt)) throw new Error('MD pack missing from IEM list');
 });

 check('the display band list shows the solo MD (not the stage), with pack', ()=>{
   setup();
   ev("state.mdSoloName='Jordan Lee'; state.mdSoloPack='Misc 1'; renderDisplayView();");
   const list=document.getElementById('dvBandList');
   const txt=list?list.textContent:'';
   if(!/Jordan Lee/.test(txt)) throw new Error('MD missing from display band/IEM list; got: '+txt);
   if(!/Misc 1/.test(txt)) throw new Error('MD pack missing from display list');
 });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   process.exit(errs.length?1:0);
 },20);
},60));
