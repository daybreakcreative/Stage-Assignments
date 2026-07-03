// Host mics: auto-assign from the shared pool AFTER vocalists and BEFORE shadows,
// per-host manual override (lock), display view + print summary rendering.
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
const hm=slot=>ev(`state.hostMics.${slot}`);
const fire=(el,type)=>el.dispatchEvent(new window.Event(type,{bubbles:true}));
window.addEventListener('load',()=>setTimeout(()=>{
 const setup=()=>{
   ev('state.inventory=[{name:"KMS105",total:1,rank:1,wireless:true},{name:"Beta 58A",total:1,rank:2,wireless:true},{name:"SM58",total:4,rank:3,wireless:false},{name:"D:Facto",total:1,rank:4,wireless:false}]');
   ev('state.config.micPrefs={leaderMics:[],people:{}}');
   ev('state.shadows=[]');
   ev('state.vocalists=[{id:"v1",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""}]');
   ev('state.hosts={speaker:"Pastor Dave",welcomeHost1:"",welcomeHost2:"",hh3:"",hh3IsBaptismal:false}');
   ev('state.hostMics={speaker:"",welcomeHost1:"",welcomeHost2:"",hh3:""}');
 };

 check('state.hostMics exists in the default shape', ()=>{
   const r=ev('JSON.stringify(state.hostMics)');
   if(!r) throw new Error('state.hostMics missing');
   const o=JSON.parse(r);
   ['speaker','welcomeHost1','welcomeHost2','hh3'].forEach(k=>{ if(!(k in o)) throw new Error('missing slot '+k); });
 });

 check('auto: named host gets a mic AFTER vocalists (next best); empty slots stay ""', ()=>{
   setup(); ev('assignMicsToVocalists()');
   if(ev('state.vocalists[0].micAssigned')!=='KMS105') throw new Error('vocalist should take best mic, got '+ev('state.vocalists[0].micAssigned'));
   if(hm('speaker')!=='Beta 58A') throw new Error('speaker should take next best (Beta 58A) after vocalist, got '+hm('speaker'));
   if(hm('welcomeHost1')!=='') throw new Error('empty host slot should be "", got '+hm('welcomeHost1'));
   if(hm('welcomeHost2')!=='') throw new Error('empty host slot should be ""');
   if(hm('hh3')!=='') throw new Error('empty host slot should be ""');
 });

 check('auto: host mic differs from the vocalist mic (pool consumed)', ()=>{
   setup(); ev('assignMicsToVocalists()');
   if(hm('speaker')===ev('state.vocalists[0].micAssigned')) throw new Error('host and vocalist share a mic');
 });

 check('override: setMicLock on a host wins even when a better mic is free', ()=>{
   setup(); ev('setMicLock("Pastor Dave","SM58")'); ev('assignMicsToVocalists()');
   if(hm('speaker')!=='SM58') throw new Error('locked host should keep SM58, got '+hm('speaker'));
   if(ev('state.vocalists[0].micAssigned')!=='KMS105') throw new Error('vocalist should still take best, got '+ev('state.vocalists[0].micAssigned'));
 });

 check('order: shadows still take the LOWEST mic AFTER hosts', ()=>{
   setup();
   ev('state.shadows=[{id:"s1",name:"Sam",setup:"on-stage-mic",mic:""}]');
   ev('assignMicsToVocalists()');
   // vocalist KMS105 (rank1), speaker Beta 58A (rank2) → shadow takes lowest free = D:Facto (rank4)
   if(ev('state.shadows[0].mic')!=='D:Facto') throw new Error('shadow should take lowest free mic, got '+ev('state.shadows[0].mic'));
   if(hm('speaker')!=='Beta 58A') throw new Error('host order preserved: speaker should still be Beta 58A, got '+hm('speaker'));
 });

 check('display: host row detail shows the assigned host mic', ()=>{
   setup(); ev('assignMicsToVocalists()');
   ev('state.viewMode="display"; renderDisplayView(); state.viewMode="setup"');
   // NOTE: document.getElementById('dvHostsList') returns null here — the display render
   // detaches/re-appends #dvHostsBlock, which trips the jsdom id-cache bug (see CLAUDE.md).
   // The still-connected block is reachable via #displayView, so read the list through it.
   const block=doc.querySelector('#displayView #dvHostsBlock') || doc.getElementById('dvHostsBlock');
   const list=block && block.querySelector('.dv-list');
   if(!list) throw new Error('#dvHostsList missing');
   const txt=list.textContent;
   if(!/Beta 58A/.test(txt)) throw new Error('host mic not shown in display detail: '+txt);
 });

 check('roster: renderHosts shows a per-host mic dropdown only for named slots; change locks the host', ()=>{
   setup(); ev('assignMicsToVocalists()');
   ev('renderAll=function(){}');   // isolate the change handler from a full re-render
   ev('renderHosts()');
   const speakerRow=doc.getElementById('speaker').closest('.host-row');
   const sel=speakerRow.querySelector('.host-mic-select');
   if(!sel) throw new Error('named speaker has no mic dropdown');
   const hh1Row=doc.getElementById('welcomeHost1').closest('.host-row');
   if(hh1Row.querySelector('.host-mic-select')) throw new Error('empty HH1 slot should have no mic dropdown');
   sel.value='SM58'; fire(sel,'change');
   const r=ev(`JSON.stringify(micPrefFor("Pastor Dave"))`);
   if(!r || JSON.parse(r).lock!=='SM58') throw new Error('dropdown change did not lock host: '+r);
   if(hm('speaker')!=='SM58') throw new Error('after override, hostMics.speaker should be SM58, got '+hm('speaker'));
 });

 check('summary: print summary host list includes the assigned host mic', ()=>{
   setup(); ev('assignMicsToVocalists()');
   ev('fillSummary()');
   const list=doc.getElementById('s_hhList');
   if(!list) throw new Error('#s_hhList missing');
   if(!/Beta 58A/.test(list.textContent)) throw new Error('host mic not in print summary: '+list.textContent);
 });

 // --- regression: a person in two roles / two slots carries ONE mic (no double-claim) ---
 check('dedupe: a vocalist who is also a host shows the SAME mic (pool not double-consumed)', ()=>{
   setup();
   ev('state.hosts={speaker:"Grayson",welcomeHost1:"",welcomeHost2:"",hh3:"",hh3IsBaptismal:false}'); // same name as the vocalist
   ev('assignMicsToVocalists()');
   const vmic=ev('state.vocalists[0].micAssigned');
   if(vmic!=='KMS105') throw new Error('vocalist Grayson should hold KMS105, got '+vmic);
   if(hm('speaker')!==vmic) throw new Error('host Grayson should reuse the vocalist mic '+vmic+', got '+hm('speaker'));
 });

 check('dedupe: the same name in two host slots shares one mic', ()=>{
   setup();
   ev('state.vocalists=[]'); // isolate hosts from the vocalist pool
   ev('state.hosts={speaker:"Dave",welcomeHost1:"Dave",welcomeHost2:"",hh3:"",hh3IsBaptismal:false}');
   ev('assignMicsToVocalists()');
   if(!hm('speaker')) throw new Error('speaker Dave should get a mic');
   if(hm('welcomeHost1')!==hm('speaker')) throw new Error('both Dave slots should share one mic; got '+hm('speaker')+' vs '+hm('welcomeHost1'));
 });

 // --- regression: dropdown distinguishes auto from lock and lets you pin the auto mic ---
 check('dropdown: an unlocked host sits on "Auto (<mic>)", not the mic shown as a fake lock', ()=>{
   setup(); ev('assignMicsToVocalists()');
   ev('renderAll=function(){}');
   ev('renderHosts()');
   const sel=doc.getElementById('speaker').closest('.host-row').querySelector('.host-mic-select');
   if(!sel) throw new Error('named speaker has no mic dropdown');
   if(sel.value!=='') throw new Error('unlocked host dropdown should rest on Auto (value ""), got "'+sel.value+'"');
   const autoOpt=sel.querySelector('option[value=""]');
   if(!autoOpt || !/Auto/.test(autoOpt.textContent) || !/Beta 58A/.test(autoOpt.textContent))
     throw new Error('Auto option should name the auto-picked mic, got: '+(autoOpt&&autoOpt.textContent));
 });

 check('dropdown: picking the very mic auto chose LOCKS it (no silent no-op)', ()=>{
   setup(); ev('assignMicsToVocalists()');
   ev('renderAll=function(){}');
   ev('renderHosts()');
   const sel=doc.getElementById('speaker').closest('.host-row').querySelector('.host-mic-select');
   if(hm('speaker')!=='Beta 58A') throw new Error('precondition: speaker auto mic should be Beta 58A, got '+hm('speaker'));
   sel.value='Beta 58A'; fire(sel,'change'); // the same mic auto already picked
   const r=ev('JSON.stringify(micPrefFor("Pastor Dave"))');
   if(!r || JSON.parse(r).lock!=='Beta 58A') throw new Error('picking the auto mic should lock it, got: '+r);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
