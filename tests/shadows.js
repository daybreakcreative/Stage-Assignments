const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const fire=(el,t)=>el.dispatchEvent(new window.Event(t,{bubbles:true}));
const smic=i=>ev(`(state.shadows[${i}]||{}).mic`);
const vmics=()=>ev('state.vocalists.map(v=>v.micAssigned)');
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){}');
 const setup=(nVoc,shadows)=>{
   // NOTE: enableShadows is now a harmless legacy field — shadows are always processed
   // regardless (see tests/shadowflow.js). Setting it here is a no-op but kept so this
   // suite's assertions remain unchanged.
   ev('state.config.enableShadows=true; state.config.micPrefs={leaderMics:[],people:{}}; state.config.iemPackPresets=["Misc 2 Pack","Drum Pack"]');
   ev('state.inventory=[{name:"KMS105",total:1,rank:1},{name:"SM58",total:1,rank:2},{name:"PG58",total:1,rank:3}]'); // 3 mics, PG58 lowest
   const vs=[]; for(let i=0;i<nVoc;i++) vs.push(`{id:"v${i}",name:"V${i}",isWL:${i===0},leadsSongs:${i===0},micAssigned:""}`);
   ev(`state.vocalists=[${vs.join(',')}]`);
   ev(`state.shadows=${JSON.stringify(shadows)}`);
   ev('state.shadowPreferences={}');
 };

 check('on-stage-mic shadow gets the LOWEST mic (PG58), reserved from vocalists', ()=>{
   setup(2,[{id:"s1",name:"Bri",pack:"Misc 2 Pack",setup:"on-stage-mic"}]);
   ev('assignMicsToVocalists()');
   if(smic(0)!=='PG58') throw new Error('shadow got '+smic(0)+' (want PG58)');
   if(vmics().includes('PG58')) throw new Error('a vocalist was given the reserved shadow mic: '+JSON.stringify(vmics()));
 });
 check('IEM-only / observing shadows get NO mic', ()=>{
   setup(1,[{id:"s1",name:"A",setup:"on-stage-iem"},{id:"s2",name:"B",setup:"off-stage"}]);
   ev('assignMicsToVocalists()');
   if(smic(0)!=='') throw new Error('on-stage-iem shadow got a mic: '+smic(0));
   if(smic(1)!=='') throw new Error('observing shadow got a mic: '+smic(1));
 });
 check('two mic shadows take the two lowest leftover mics', ()=>{
   setup(1,[{id:"s1",name:"A",setup:"on-stage-mic"},{id:"s2",name:"B",setup:"on-stage-mic"}]); // 1 vocalist takes KMS105
   ev('assignMicsToVocalists()');
   const got=[smic(0),smic(1)].sort();
   if(JSON.stringify(got)!==JSON.stringify(["PG58","SM58"])) throw new Error('shadow mics: '+JSON.stringify([smic(0),smic(1)]));
 });
 check('if no mics remain, a mic shadow gets none (vocalists have priority)', ()=>{
   setup(3,[{id:"s1",name:"A",setup:"on-stage-mic"}]); // 3 vocalists take all 3 mics
   ev('assignMicsToVocalists()');
   if(smic(0)!=='') throw new Error('shadow took a mic that should have gone to a vocalist: '+smic(0));
 });
 check('updateShadowSetup toggles the mic on and off', ()=>{
   setup(1,[{id:"s1",name:"A",setup:""}]);
   ev('updateShadowSetup("s1","on-stage-mic")');
   if(!smic(0)) throw new Error('no mic after setting on-stage-mic');
   ev('updateShadowSetup("s1","off-stage")');
   if(smic(0)!=='') throw new Error('mic not released after switching to observing: '+smic(0));
 });
 check('popup saves the choice (no mic picker); engine assigns on completion', ()=>{
   setup(1,[{id:"s1",name:"Bri",setup:""}]);
   doc.getElementById('postPullContent').innerHTML='<button data-shadow-opt="on-stage-mic" class="selected"></button>';
   ev('postPullState={steps:[{kind:"shadow",personName:"Bri",shadowKind:"vocalist",shadowId:"s1",prefKey:"bri|shadow"}],idx:0}');
   ev('savePostPullStep()');
   if(ev('state.shadows[0].setup')!=='on-stage-mic') throw new Error('setup not saved');
   if(ev('state.shadowPreferences["bri"].choice')!=='on-stage-mic') throw new Error('pref not saved');
   ev('assignMicsToVocalists()');
   if(!smic(0)) throw new Error('engine did not assign a mic post-completion');
 });
 check('shadows are asked EVERY week (not skipped once configured)', ()=>{
   setup(1,[{id:"s1",name:"Bri",setup:"on-stage-iem"}]);
   ev('state.shadowPreferences={"bri":{role:"vocalist",choice:"on-stage-iem"}}'); // already configured
   const steps=ev('JSON.stringify(buildPostPullSteps({}).filter(s=>s.kind==="shadow").map(s=>s.personName))');
   if(!JSON.parse(steps).includes('Bri')) throw new Error('Bri was skipped; steps='+steps);
 });
 check('card renders an editable setup dropdown reflecting the shadow setup', ()=>{
   setup(1,[{id:"s1",name:"Bri",setup:"on-stage-mic"}]);
   ev('state.assignments=computePositions(state.vocalists)');
   ev('renderVocalists()');
   const sel=doc.querySelector('#vocGrid .shadow-setup-sel[data-shadow-id="s1"]');
   if(!sel) throw new Error('no setup dropdown on shadow card');
   if(sel.value!=='on-stage-mic') throw new Error('dropdown value='+sel.value);
   sel.value='off-stage'; fire(sel,'change');
   if(ev('state.shadows[0].setup')!=='off-stage') throw new Error('card change not applied');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
