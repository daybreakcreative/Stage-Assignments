// #4 — one merged checklist card per person: a person in two roles (MD+Keys, AG+Vocals
// linked or not) should appear ONCE with all their setup items combined + deduped.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const reset=()=>ev(`state.setupItems={}; state.checklistState={}; state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.shadows=[]; state.instruments=[]; state.musicDirectorId=null;`);
// find a person entry (merged card) by name across all sections' people
const findPerson = name => ev(`(function(){var secs=collectChecklistItems();for(var s of secs){for(var p of (s.people||[])){if(p.name===${JSON.stringify(name)})return {roleLabel:p.roleLabel,texts:p.items.map(i=>i.itemText),section:s.key,count:p.items.length};}}return null;})()`);
const countCards = name => ev(`(function(){var n=0,secs=collectChecklistItems();for(var s of secs){for(var p of (s.people||[]))if(p.name===${JSON.stringify(name)})n++;}return n;})()`);

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');

 check('MD + Keys → ONE merged card (keys + tracks items, deduped)', ()=>{
   reset();
   ev(`state.instruments=[{id:'inst_keys',label:'Keys',tag:'Keys',assignedTo:'Marcus',vocalistPlayer:null}]; state.musicDirectorId='inst_keys';`);
   const kB=ev(`stableSetupKey('Marcus','band','keys')`), kM=ev(`stableSetupKey('Marcus','md','md')`);
   ev(`state.setupItems['${kB}']={seeded:true,selections:{},customItems:[],items:[{id:'a',text:'MIDI cable',doneThisService:false},{id:'b',text:'Music stand',doneThisService:false}]};`);
   ev(`state.setupItems['${kM}']={seeded:true,selections:{},customItems:[],items:[{id:'c',text:'House tracks computer',doneThisService:false},{id:'d',text:'Music stand',doneThisService:false}]};`);
   if (countCards('Marcus')!==1) throw new Error('expected 1 merged card, got '+countCards('Marcus'));
   const p=findPerson('Marcus');
   if(!p) throw new Error('no Marcus card');
   ['MIDI cable','House tracks computer','Music stand'].forEach(t=>{ if(!p.texts.includes(t)) throw new Error('missing item '+t+' in '+JSON.stringify(p.texts)); });
   if(p.texts.filter(t=>t==='Music stand').length!==1) throw new Error('Music stand not deduped: '+JSON.stringify(p.texts));
 });

 check('AG (unlinked) + Vocals → ONE card under vocalists, both item sets', ()=>{
   reset();
   ev(`state.vocalists=[{id:'v1',name:'Sam',isWL:true,micAssigned:''}]; state.assignments[0]='v1';`);
   ev(`state.instruments=[{id:'inst_ag',label:'Acoustic Guitar',tag:'Acoustic',assignedTo:'Sam',vocalistPlayer:null}];`);
   const kV=ev(`stableSetupKey('Sam','vocalist','vocals')`), kA=ev(`stableSetupKey('Sam','band','ag')`);
   ev(`state.setupItems['${kV}']={seeded:true,selections:{},customItems:[],items:[{id:'a',text:'Straight mic stand',doneThisService:false}]};`);
   ev(`state.setupItems['${kA}']={seeded:true,selections:{},customItems:[],items:[{id:'b',text:'Wireless AG rig',doneThisService:false}]};`);
   if (countCards('Sam')!==1) throw new Error('expected 1 merged card, got '+countCards('Sam'));
   const p=findPerson('Sam');
   if(p.section!=='vocalists') throw new Error('multi-role vocalist should sit in vocalists section, got '+p.section);
   ['Straight mic stand','Wireless AG rig'].forEach(t=>{ if(!p.texts.includes(t)) throw new Error('missing '+t); });
 });

 check('AG LINKED to vocalist (vocalistPlayer) → AG items appear in the vocalist card', ()=>{
   reset();
   ev(`state.vocalists=[{id:'v1',name:'Sam',isWL:true,micAssigned:''}]; state.assignments[0]='v1';`);
   ev(`state.instruments=[{id:'inst_ag',label:'Acoustic Guitar',tag:'Acoustic',assignedTo:'',vocalistPlayer:'v1'}];`);
   const kV=ev(`stableSetupKey('Sam','vocalist','vocals')`), kA=ev(`stableSetupKey('Sam','band','ag')`);
   ev(`state.setupItems['${kV}']={seeded:true,selections:{},customItems:[],items:[{id:'a',text:'Straight mic stand',doneThisService:false}]};`);
   ev(`state.setupItems['${kA}']={seeded:true,selections:{},customItems:[],items:[{id:'b',text:'Wireless AG rig',doneThisService:false}]};`);
   const p=findPerson('Sam');
   if(!p) throw new Error('no Sam card');
   if(!p.texts.includes('Wireless AG rig')) throw new Error('linked AG items missing from vocalist card: '+JSON.stringify(p.texts));
   if(countCards('Sam')!==1) throw new Error('linked player should still be ONE card, got '+countCards('Sam'));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
