const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}; renderStage=function(){}; renderBand=function(){}; renderDisplayView=function(){}; toast=function(){};');

 check('vocalist rename moves their check-offs to the new name (old key gone)', ()=>{
   ev(`
     state.vocalists=[{id:'vx',name:'Grayson',isWL:true,setupItems:['Tune in-ears','Set monitor mix']}];
     state.instruments=[]; state.pcoConfig.selectedPlanId='PLANX';
     var cs=getChecklistState(); cs['Grayson|Tune in-ears|v0']=true; cs['Grayson|Set monitor mix|v1']=true;
     updateVocName('vx','Grayson Kredit'); finalizeVocName('vx','Grayson');
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Grayson|Tune in-ears|v0']) throw new Error('old key remains');
   if(!o['Grayson Kredit|Tune in-ears|v0']) throw new Error('item0 not migrated');
   if(!o['Grayson Kredit|Set monitor mix|v1']) throw new Error('item1 not migrated');
 });

 check('migration covers every plan, not just the current one', ()=>{
   ev(`
     state.vocalists=[{id:'vy',name:'Ella',setupItems:['Soundcheck']}]; state.instruments=[];
     state.checklistState={}; 
     state.checklistState['PLAN_A']={'Ella|Soundcheck|v0':true};
     state.checklistState['PLAN_B']={'Ella|Soundcheck|v0':true};
     state.pcoConfig.selectedPlanId='PLAN_A';
     updateVocName('vy','Ella M'); finalizeVocName('vy','Ella');
   `);
   const a=JSON.parse(ev("JSON.stringify(state.checklistState['PLAN_A'])"));
   const b=JSON.parse(ev("JSON.stringify(state.checklistState['PLAN_B'])"));
   if(!a['Ella M|Soundcheck|v0']||a['Ella|Soundcheck|v0']) throw new Error('plan A not migrated');
   if(!b['Ella M|Soundcheck|v0']||b['Ella|Soundcheck|v0']) throw new Error('plan B not migrated');
 });

 check('renaming a vocalist who PLAYS an instrument also moves the band-row check-off', ()=>{
   ev(`
     state.vocalists=[{id:'vz',name:'Grayson',setupItems:[]}];
     state.instruments=[{id:'inst_ag',label:'Acoustic',pack:'Acoustic Pack',placeholder:'AG',tag:'AG',assignedTo:'',vocalistPlayer:'vz',optional:true,setupItems:['Plug in DI']}];
     state.pcoConfig.selectedPlanId='P';
     var cs=getChecklistState(); cs['Acoustic|Grayson|Plug in DI|b0']=true;
     updateVocName('vz','Grayson Kredit'); finalizeVocName('vz','Grayson');
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Acoustic|Grayson|Plug in DI|b0']) throw new Error('old band-player key remains');
   if(!o['Acoustic|Grayson Kredit|Plug in DI|b0']) throw new Error('band-player key not migrated');
 });

 check('band member rename moves their check-offs (helper path)', ()=>{
   ev(`
     state.instruments=[{id:'inst_drums',label:'Drums',pack:'Drum Pack',placeholder:'Drummer',tag:'Drums',assignedTo:'Danny',vocalistPlayer:null,optional:false,setupItems:['Check kick mic']}];
     state.pcoConfig.selectedPlanId='P2';
     var cs=getChecklistState(); cs['Drums|Danny|Check kick mic|b0']=true;
     var inst=instById('inst_drums'); inst.assignedTo='Danny Barragan';
     remapChecklistKeys(checklistPairsForBandRename(inst,'Danny','Danny Barragan'));
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(o['Drums|Danny|Check kick mic|b0']) throw new Error('old band key remains');
   if(!o['Drums|Danny Barragan|Check kick mic|b0']) throw new Error('band item not migrated');
 });

 check('no-op when name is unchanged or prevName missing (no crash, no loss)', ()=>{
   ev(`
     state.vocalists=[{id:'vq',name:'Mo',setupItems:['X']}]; state.instruments=[];
     state.pcoConfig.selectedPlanId='P3'; var cs=getChecklistState(); cs['Mo|X|v0']=true;
     finalizeVocName('vq','Mo');         // same name
     finalizeVocName('vq', undefined);   // missing prevName
   `);
   const o=JSON.parse(ev('JSON.stringify(getChecklistState())'));
   if(!o['Mo|X|v0']) throw new Error('check-off lost on no-op rename');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
