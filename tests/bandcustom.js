// FIX #6 — AUTO-placed band must follow the CUSTOM stage outline (not the
// slider-derived D-shape). Vocalists already do (getVoxPositions reads
// getStageShape); band did not (getBandStagePositions recomputed Y from sliders).
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
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('6a) auto band Y follows the CUSTOM outline (shape.backY), not the slider D-shape', ()=>{
   // Slider D-shape at these values: edgeY=30+170*0.7=149, backY=180+180*1.0=360.
   ev('state.config.stageCurvature=70; state.config.stageDepth=100; state.config.customStageEnabled=false;');
   ev('state.config.customStagePositions=null;');
   ev(`state.instruments=[{id:'i_drums',label:'Drums',tag:'Drums',assignedTo:'D'},{id:'i_bass',label:'Bass',tag:'Bass',assignedTo:'B'}];`);
   // baseline (slider) band Y for a member:
   const slider = J('getBandStagePositions()');
   const sliderY = slider['i_drums'].y;
   // Now set a SHALLOW custom outline whose back wall is much higher up (y≈200) than the
   // slider back wall (360). Front edge ~120, back ~200.
   ev('state.config.customStagePoints=[{x:60,y:120},{x:740,y:120},{x:740,y:200},{x:60,y:200}];');
   const shape = J('getStageShape()');           // edgeY≈120, backY≈200 for this outline
   const custom = J('getBandStagePositions()');
   const cy = custom['i_drums'].y;
   // With the custom outline, band Y must sit within the OUTLINE's band, near shape.backY (200),
   // NOT down at the slider's ~330 (which would be OFF this shallow stage).
   if (cy > shape.backY) throw new Error('band Y '+cy+' sits BELOW the custom back wall '+shape.backY+' (off-stage)');
   if (cy >= sliderY - 30) throw new Error('band Y '+cy+' still tracks the slider Y '+sliderY+' — ignored the custom outline');
   if (cy < shape.edgeY) throw new Error('band Y '+cy+' is in front of the custom front edge '+shape.edgeY);
 });
 check('6b) with NO custom outline, band Y is unchanged (slider basis preserved)', ()=>{
   ev('state.config.customStagePoints=null; state.config.customStageEnabled=false;');
   ev('state.config.stageCurvature=70; state.config.stageDepth=100;');
   ev(`state.instruments=[{id:'i_drums',label:'Drums',tag:'Drums',assignedTo:'D'},{id:'i_bass',label:'Bass',tag:'Bass',assignedTo:'B'}];`);
   const p = J('getBandStagePositions()');
   // slider basis: edgeY=149, backY=360, stageHeight=211, centerY≈305, member (edge) up to ~330 clamped <=342
   if (p['i_drums'].y < 149 || p['i_drums'].y > 360) throw new Error('slider-basis band Y out of range: '+p['i_drums'].y);
 });
 check('6c) X / keys-stage-right logic is untouched under a custom outline', ()=>{
   ev('state.config.customStagePoints=[{x:60,y:120},{x:740,y:120},{x:740,y:260},{x:60,y:260}]; state.config.customStageEnabled=false; state.config.customStagePositions=null;');
   ev(`state.instruments=[{id:'i_keys',label:'Keys',tag:'Keys',assignedTo:'K'},{id:'i_drums',label:'Drums',tag:'Drums',assignedTo:'D'},{id:'i_eg',label:'EG',tag:'EG',assignedTo:'E'}];`);
   const p = J('getBandStagePositions()');
   if (p['i_keys'].x <= p['i_drums'].x || p['i_keys'].x <= p['i_eg'].x) throw new Error('Keys not stage-right anymore: '+JSON.stringify(p));
 });
 check('6d) hand-placed band is still honored under a custom outline', ()=>{
   ev('state.config.customStagePoints=[{x:60,y:120},{x:740,y:120},{x:740,y:260},{x:60,y:260}];');
   ev('state.config.customStageEnabled=true; state.config.customStagePositions={ i_drums:{x:333,y:333} };');
   ev(`state.instruments=[{id:'i_drums',label:'Drums',tag:'Drums',assignedTo:'D'}];`);
   const p = J('getBandStagePositions()');
   if (p['i_drums'].x!==333 || p['i_drums'].y!==333) throw new Error('hand-placed band overridden: '+JSON.stringify(p['i_drums']));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
