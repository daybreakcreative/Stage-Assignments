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
function pe(type,x,y){const e=new window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true});return e;}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};showStageEditUndoToast=function(){};');
 // give some people on stage
 ev(`state.instruments.find(i=>i.id==='inst_drums').assignedTo='Danny';
     state.vocalists=[{id:'v1',name:'Mo'},{id:'v2',name:'Ella'}];
     state.assignments=computePositions(state.vocalists); renderStage();`);

 check('one Edit Layout button exists; old three are gone', ()=>{
   if(!document.getElementById('stageEditBtn')) throw new Error('#stageEditBtn missing');
   if(document.getElementById('stageOutlineBtn')||document.getElementById('stageFeaturesBtn')) throw new Error('old buttons still present');
   if(!/Edit Layout/.test(document.getElementById('stageEditBtn').textContent)) throw new Error('label not Edit Layout');
 });
 check('toolbar has "Edit Outline or Features" + Reset + Done (old Outline/Features removed)', ()=>{
   ['stageEditOutlineFeaturesBtn','stageEditResetBtn','stageEditDoneBtn'].forEach(id=>{ if(!document.getElementById(id)) throw new Error('missing '+id); });
   if(document.getElementById('stageEditOutlineBtn')||document.getElementById('stageEditFeaturesBtn')) throw new Error('old Outline/Features toolbar buttons still present');
 });
 check('"Edit Outline or Features" opens Advanced Settings → Display and leaves edit mode', ()=>{
   document.getElementById('stageEditBtn').dispatchEvent(pe('click',0,0)); // enter edit mode
   document.getElementById('stageEditOutlineFeaturesBtn').dispatchEvent(pe('click',0,0));
   const ov=document.getElementById('settingsOverlay');
   if(!ov||!ov.classList.contains('show')) throw new Error('settings not opened');
   if(document.body.classList.contains('stage-editing')) throw new Error('should have left edit mode');
   ev('closeSettings()');
 });
 check('seedPolygonPoints seeds the CURRENT curved shape (front-edge curve, not a 5-point peak)', ()=>{
   ev('state.config.stageCurvature=70; state.config.stageDepth=50; state.config.customStagePoints=null;');
   const pts=JSON.parse(ev('JSON.stringify(seedPolygonPoints())'));
   if(pts.length!==4) throw new Error('expected 4 corners (no peak point), got '+pts.length);
   if(!pts[0].c || typeof pts[0].c.y!=='number') throw new Error('front edge not curved (no control point on corner 0)');
 });
 check('Advanced Settings backdrop click does NOT close it (force the ✕)', ()=>{
   if(/settingsOverlay'\)\.addEventListener\('click', e => \{ if \(e\.target\.id === 'settingsOverlay'\) closeSettings/.test(html)) throw new Error('backdrop still wired to close settings');
 });
 check('Edit Layout enters INLINE edit mode (body class + toolbar shown, modal NOT shown)', ()=>{
   document.getElementById('stageEditBtn').dispatchEvent(pe('click',0,0));
   if(!document.body.classList.contains('stage-editing')) throw new Error('no stage-editing class');
   if(document.getElementById('stageEditToolbar').style.display==='none') throw new Error('toolbar hidden');
   const modal=document.getElementById('stageEditModal');
   if(modal && modal.style.display==='flex') throw new Error('modal was opened (should stay closed)');
 });
 check('main-stage slots are wired for drag (data-custom-key) and not native-draggable in edit mode', ()=>{
   ev('renderStage();');
   const slots=[...document.querySelectorAll('#stagePeople .sp')];
   if(slots.length===0) throw new Error('no slots rendered');
   if(!slots.every(s=>s.dataset.customKey)) throw new Error('a slot missing data-custom-key');
   if(slots.some(s=>s.draggable===true)) throw new Error('a slot is still native-draggable in edit mode');
 });
 check('dragging a slot updates customStagePositions', ()=>{
   const slot=document.querySelector('#stagePeople .sp[data-custom-key]');
   const key=slot.dataset.customKey;
   const before=JSON.stringify((ev('state.config.customStagePositions')||{})[key]||null);
   slot.dispatchEvent(pe('pointerdown',400,300));
   document.dispatchEvent(pe('pointermove',180,120));
   document.dispatchEvent(pe('pointerup',180,120));
   const after=(ev('state.config.customStagePositions')||{})[key];
   if(!after) throw new Error('no custom position written for '+key);
   if(JSON.stringify(after)===before) throw new Error('position did not change');
 });
 check('Done exits edit mode', ()=>{
   document.getElementById('stageEditDoneBtn').dispatchEvent(pe('click',0,0));
   if(document.body.classList.contains('stage-editing')) throw new Error('still editing after Done');
   if(document.getElementById('stageEditToolbar').style.display!=='none') throw new Error('toolbar still shown');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
}, 200));
