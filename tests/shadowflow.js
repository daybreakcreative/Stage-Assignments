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
const fire=(el,t)=>el.dispatchEvent(new window.Event(t,{bubbles:true}));
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');

 check('Display/Layout settings has NO enable-shadows toggle in the DOM', ()=>{
   ev('renderLayoutEditor()');
   const toggle=doc.querySelector('#layoutEdit [data-cfg-shadows]') || doc.querySelector('[data-cfg-shadows]');
   if(toggle) throw new Error('found an enable-shadows toggle: '+toggle.outerHTML);
 });

 check('shadows are processed WITHOUT setting enableShadows (mic engine handles a shadow)', ()=>{
   ev('delete state.config.enableShadows');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"SM58",total:1,rank:2},{name:"PG58",total:1,rank:3}]');
   ev('state.vocalists=[{id:"v0",name:"V0",isWL:true,leadsSongs:true,micAssigned:""}]');
   ev('state.shadows=[{id:"s1",name:"Bri",pack:"Misc 2 Pack",setup:"on-stage-mic"}]');
   ev('state.shadowPreferences={}');
   ev('assignMicsToVocalists()');
   if(ev('state.shadows[0].mic')!=='PG58') throw new Error('shadow not given a mic without enableShadows: '+ev('state.shadows[0].mic'));
 });

 check('shadow post-pull step renders a pack <select>; changing+saving sets shadows[i].pack', ()=>{
   ev('state.config.iemPackPresets=["Misc 2 Pack","Drum Pack","EG Pack"]');
   ev('state.shadows=[{id:"s1",name:"Bri",pack:"Misc 2 Pack",setup:""}]');
   ev('state.shadowPreferences={}');
   ev('postPullState={steps:[{kind:"shadow",personName:"Bri",positionName:"Vocal Shadow",shadowKind:"vocalist",shadowId:"s1",prefKey:"bri|shadow"}],idx:0}');
   ev('renderPostPullStep()');
   const sel=doc.querySelector('#postPullContent select[data-shadow-pack]');
   if(!sel) throw new Error('no pack <select> in shadow step');
   if(sel.querySelectorAll('option').length<2) throw new Error('pack select has too few options');
   // pick a mic/stage option too so save proceeds
   const opt=doc.querySelector('#postPullContent [data-shadow-opt]');
   if(opt){opt.classList.add('selected');}
   sel.value='EG Pack'; fire(sel,'change');
   ev('savePostPullStep()');
   if(ev('state.shadows[0].pack')!=='EG Pack') throw new Error('pack not saved: '+ev('state.shadows[0].pack'));
 });

 check('pack select pre-selects the shadow current pack', ()=>{
   ev('state.config.iemPackPresets=["Misc 2 Pack","Drum Pack","EG Pack"]');
   ev('state.shadows=[{id:"s2",name:"Cody",pack:"Drum Pack",setup:""}]');
   ev('state.shadowPreferences={}');
   ev('postPullState={steps:[{kind:"shadow",personName:"Cody",positionName:"Drum Shadow",shadowKind:"band",shadowId:"s2",prefKey:"cody|shadow"}],idx:0}');
   ev('renderPostPullStep()');
   const sel=doc.querySelector('#postPullContent select[data-shadow-pack]');
   if(!sel) throw new Error('no pack select');
   if(sel.value!=='Drum Pack') throw new Error('pack not pre-selected: '+sel.value);
 });

 check('band shadow (EG Shadow) choosing on-stage-playing gets a seeded setup bucket with items', ()=>{
   ev('state.setupItems={}');
   // Church has configured an EG default (as it would via the wizard) so seeding yields items.
   ev('state.config.setupDefaults={eg:{selections:{rig:"eg_house"},customOptions:[]}}');
   ev('state.shadows=[{id:"s3",name:"Cody",pack:"EG Pack",setup:""}]');
   ev('state.shadowPreferences={}');
   ev('postPullState={steps:[{kind:"shadow",personName:"Cody",positionName:"EG Shadow",shadowKind:"band",shadowId:"s3",prefKey:"cody|shadow"}],idx:0}');
   ev('renderPostPullStep()');
   // choose "on-stage-playing" (band first option)
   doc.querySelectorAll('#postPullContent [data-shadow-opt]').forEach(b=>b.classList.remove('selected'));
   const playOpt=doc.querySelector('#postPullContent [data-shadow-opt="on-stage-playing"]');
   if(!playOpt) throw new Error('no on-stage-playing option');
   playOpt.classList.add('selected');
   ev('savePostPullStep()');
   const key=ev('stableSetupKey("Cody","shadow","eg")');
   const bucket=ev(`JSON.stringify(state.setupItems[${JSON.stringify(key)}]||null)`);
   if(bucket==='null') throw new Error('no setup bucket at '+key+'; keys='+ev('JSON.stringify(Object.keys(state.setupItems))'));
   const items=ev(`(state.setupItems[${JSON.stringify(key)}].items||[]).length`);
   if(items<1) throw new Error('setup bucket has no items');
 });

 check('band shadow choosing observer does NOT get a setup bucket', ()=>{
   ev('state.setupItems={}');
   ev('state.shadows=[{id:"s4",name:"Sam",pack:"EG Pack",setup:""}]');
   ev('state.shadowPreferences={}');
   ev('postPullState={steps:[{kind:"shadow",personName:"Sam",positionName:"EG Shadow",shadowKind:"band",shadowId:"s4",prefKey:"sam|shadow"}],idx:0}');
   ev('renderPostPullStep()');
   doc.querySelectorAll('#postPullContent [data-shadow-opt]').forEach(b=>b.classList.remove('selected'));
   const obs=doc.querySelector('#postPullContent [data-shadow-opt="observer"]');
   if(!obs) throw new Error('no observer option');
   obs.classList.add('selected');
   ev('savePostPullStep()');
   const key=ev('stableSetupKey("Sam","shadow","eg")');
   const hasItems=ev(`!!(state.setupItems[${JSON.stringify(key)}] && (state.setupItems[${JSON.stringify(key)}].items||[]).length)`);
   if(hasItems) throw new Error('observer shadow wrongly got a setup bucket with items');
 });

 check('vocal shadow choosing on-stage-mic still triggers the mic path', ()=>{
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"SM58",total:1,rank:2}]');
   ev('state.vocalists=[{id:"v0",name:"V0",isWL:true,leadsSongs:true,micAssigned:""}]');
   ev('state.shadows=[{id:"s5",name:"Ana",pack:"Misc 2 Pack",setup:""}]');
   ev('state.shadowPreferences={}');
   ev('postPullState={steps:[{kind:"shadow",personName:"Ana",positionName:"Vocal Shadow",shadowKind:"vocalist",shadowId:"s5",prefKey:"ana|shadow"}],idx:0}');
   ev('renderPostPullStep()');
   doc.querySelectorAll('#postPullContent [data-shadow-opt]').forEach(b=>b.classList.remove('selected'));
   const micOpt=doc.querySelector('#postPullContent [data-shadow-opt="on-stage-mic"]');
   micOpt.classList.add('selected');
   ev('savePostPullStep()');
   if(ev('state.shadows[0].setup')!=='on-stage-mic') throw new Error('setup not on-stage-mic');
   ev('assignMicsToVocalists()');
   if(!ev('state.shadows[0].mic')) throw new Error('no mic assigned via shadowNeedsMic path');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},200));
