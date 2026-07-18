const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const Q=e=>ev(e);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
// NOTE: The old flat SETUP_ITEM_PRESETS map + its quick-add preset chips / "+ Default
// setup" button were RETIRED (flat setup UI removed; person card is grouped-only).
// This file now covers only the behavior that survived the retirement: detectPresetKey
// mapping, the grouped SETUP_TEMPLATES catalog, and boom-mic auto-add.
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');
 check('flat SETUP_ITEM_PRESETS map is gone (retired)', ()=>{
   if(Q("typeof SETUP_ITEM_PRESETS")!=='undefined') throw new Error('SETUP_ITEM_PRESETS still defined');
   if(Q("typeof getSetupPresets")!=='undefined') throw new Error('getSetupPresets still defined');
 });
 check('detectPresetKey maps drums/bass/eg/ag/keys/md/strings, null for unknown', ()=>{
   const cases=[['Drums','','drums'],['Bass','','bass'],['EG','','eg'],['AG','','ag'],['Keys','','keys'],
     ['Strings','','strings'],['','Cello','strings'],['','Violin','strings'],['Tracks','','md'],['','MD','md'],['','Music Director','md'],['','banjo',null]];
   for(const [tag,label,exp] of cases){
     const got=Q(`detectPresetKey(${JSON.stringify({tag,label})})`);
     if(got!==exp) throw new Error(`tag='${tag}' label='${label}' → ${got} (want ${exp})`);
   }
 });
 // The grouped catalog (SETUP_TEMPLATES via setupCatalogFor) exposes per-instrument options.
 check('grouped catalog exposes per-instrument options (keys→Dante, plus md/strings/vocals)', ()=>{
   const keysCat=JSON.parse(Q("JSON.stringify(setupCatalogFor('keys'))"));
   if(!keysCat||!Array.isArray(keysCat.groups)) throw new Error('keys catalog missing');
   const hasDante=keysCat.groups.some(g=>(g.options||[]).some(o=>/Dante/.test(o.text)));
   if(!hasDante) throw new Error('keys catalog missing Dante option');
   for(const k of ['md','strings','vocals']){ const c=JSON.parse(Q(`JSON.stringify(setupCatalogFor('${k}')||null)`)); if(!c||!Array.isArray(c.groups)) throw new Error('missing catalog '+k); }
 });
 check('boom-mic auto-adds to the VOCALIST bucket for an explicitly-linked dual-role player', ()=>{
   ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});
       state.instruments.find(i=>i.id==='inst_bass').vocalistPlayer='v2';
       state.vocalists=[{id:'v1',name:'Mo'},{id:'v2',name:'Grayson Kredit'}]; state.assignments=[]; state.assignments[1]='v2';
       state.setupItems={}; collectChecklistItems();`);
   // Boom lands on the STABLE per-person key (name|vocalist|vocals), the same key
   // the check-off view + grouped editor share — not the legacy setupKeyForVocal(name).
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[stableSetupKey('Grayson Kredit','vocalist','vocals')]||{}).items||[])`));
   if(!items.some(it=>it.text==='Boom mic stand' && it.autoAdded)) throw new Error('boom not on vocalist bucket for linked dual-role: '+JSON.stringify(items.map(i=>i.text)));
 });
 check('boom-mic does NOT auto-add for a mere same-name match (no explicit link)', ()=>{
   ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});
       var eg=state.instruments.find(i=>i.id==='inst_eg1'); eg.assignedTo='Brian';
       state.vocalists=[{id:'vb',name:'Brian'}]; state.assignments=[]; state.assignments[0]='vb';
       state.setupItems={}; collectChecklistItems();`);
   // Read the stable band key (name|band|eg) — same key the render path uses for this player.
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[stableSetupKey('Brian','band','eg')]||{}).items||[])`));
   if(items.some(it=>it.text==='Boom mic stand')) throw new Error('boom wrongly auto-added on name match: '+JSON.stringify(items.map(i=>i.text)));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
