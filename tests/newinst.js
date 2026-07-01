const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){};toast=function(){};');
 // New-on-instrument step now shows the GROUPED per-instrument setup editor (church defaults
 // pre-checked), not a free-text box. Set up a real drums instrument so typeKey resolves.
 ev(`
   state.config.setupDefaults = { drums:{ selections:{ options:['d_music'] }, customOptions:[] } };
   state.setupItems = {};
   state.musicianPreferences = {};
   state.instruments = [{ id:'inst_drums_test', label:'Drums', tag:'Drums', assignedTo:'Louis Vaca', vocalistPlayer:null }];
   postPullState = { steps:[{kind:'pref-band', personName:'Louis Vaca', instId:'inst_drums_test', instLabel:'Drums', prefKey:'louis vaca|drums'}], idx:0 };
 `);

 check('new-on-instrument step renders the grouped setup editor (no free-text box)', ()=>{
   ev('renderPostPullStep()');
   if(document.querySelector('#pp_notes')) throw new Error('band step should not have a notes box');
   if(document.querySelector('#pp_setup_list')||document.querySelector('.pp-setup-item')) throw new Error('old free-text list still present');
   const ed=document.querySelector('#pp_setup_editor');
   if(!ed) throw new Error('no grouped setup editor');
   if(!ed.querySelector('input[value="d_housesnare"]')) throw new Error('drums catalog options not shown');
 });
 check('church default is pre-checked in the step', ()=>{
   const music=document.querySelector('#pp_setup_editor input[value="d_music"]');
   if(!music||!music.checked) throw new Error('church default (d_music) not pre-checked');
 });
 check('ticking an option adds it to the person’s stable bucket checklist items', ()=>{
   const snare=document.querySelector('#pp_setup_editor input[value="d_housesnare"]');
   snare.checked=true; snare.dispatchEvent(new window.Event('change',{bubbles:true}));
   const k=ev(`stableSetupKey('Louis Vaca','band','drums')`);
   const texts=JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(k)}]||{}).items||[])`)).map(i=>i.text);
   if(!texts.includes('House snare')) throw new Error('ticked option not in stable bucket items: '+JSON.stringify(texts));
   if(!texts.includes('Needs music stand')) throw new Error('pre-checked default missing from items: '+JSON.stringify(texts));
 });
 check('saving marks the person asked (not re-prompted next pull)', ()=>{
   ev('savePostPullStep()');
   if(!ev(`!!state.musicianPreferences['louis vaca|drums']`)) throw new Error('not marked asked');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
