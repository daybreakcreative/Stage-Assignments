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
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');
 check('all 8 instrument keys present with valid shape', ()=>{
   for(const k of ['drums','bass','ag','eg','keys','md','strings','vocals']){
     const d=JSON.parse(Q(`JSON.stringify(SETUP_ITEM_PRESETS['${k}']||null)`));
     if(!d) throw new Error('missing '+k);
     if(typeof d.label!=='string') throw new Error(k+' label');
     if(!Array.isArray(d.defaults)||d.defaults.some(x=>typeof x!=='string')) throw new Error(k+' defaults');
     if(!Array.isArray(d.presets)) throw new Error(k+' presets');
     d.presets.forEach(p=>{ if(typeof p.name!=='string'||!Array.isArray(p.items)||p.items.some(x=>typeof x!=='string')) throw new Error(k+' preset shape'); });
   }
 });
 check('content spot-checks (eg default stereo+stand, mono bundle, md defaults, vocals, bass/ag autos)', ()=>{
   const eg=JSON.parse(Q("JSON.stringify(SETUP_ITEM_PRESETS.eg)"));
   if(!eg.defaults.includes('Single guitar stand')) throw new Error('eg single stand default');
   if(!eg.defaults.includes('2 XLRs for player EG rig')) throw new Error('eg stereo default');
   const mono=eg.presets.find(p=>/Mono guitar rig/.test(p.name)); if(!mono||mono.items.length!==3) throw new Error('mono bundle');
   if(JSON.parse(Q("JSON.stringify(SETUP_ITEM_PRESETS.md.defaults)")).length!==4) throw new Error('md defaults count');
   if(JSON.parse(Q("JSON.stringify(SETUP_ITEM_PRESETS.vocals.defaults)"))[0]!=='Straight mic stand on stage') throw new Error('vocals default');
   if(JSON.parse(Q("JSON.stringify(SETUP_ITEM_PRESETS.bass.defaults)"))[0]!=='Guitar stand') throw new Error('bass auto stand');
   if(!JSON.parse(Q("JSON.stringify(SETUP_ITEM_PRESETS.ag.defaults)")).includes('Wireless AG rig')) throw new Error('ag default rig');
 });
 check('detectPresetKey maps drums/bass/eg/ag/keys/md/strings, null for unknown', ()=>{
   const cases=[['Drums','','drums'],['Bass','','bass'],['EG','','eg'],['AG','','ag'],['Keys','','keys'],
     ['Strings','','strings'],['','Cello','strings'],['','Violin','strings'],['Tracks','','md'],['','MD','md'],['','Music Director','md'],['','banjo',null]];
   for(const [tag,label,exp] of cases){
     const got=Q(`detectPresetKey(${JSON.stringify({tag,label})})`);
     if(got!==exp) throw new Error(`tag='${tag}' label='${label}' → ${got} (want ${exp})`);
   }
 });
 // New model: the grouped catalog (SETUP_TEMPLATES via setupCatalogFor) exposes
 // per-instrument options. (The old flat SETUP_PRESETS wizard-chips map was retired —
 // the wizard now uses per-instrument default cards driven by SETUP_TEMPLATES.)
 check('grouped catalog exposes per-instrument options (keys→Dante, plus md/strings/vocals)', ()=>{
   const keysCat=JSON.parse(Q("JSON.stringify(setupCatalogFor('keys'))"));
   if(!keysCat||!Array.isArray(keysCat.groups)) throw new Error('keys catalog missing');
   const hasDante=keysCat.groups.some(g=>(g.options||[]).some(o=>/Dante/.test(o.text)));
   if(!hasDante) throw new Error('keys catalog missing Dante option');
   for(const k of ['md','strings','vocals']){ const c=JSON.parse(Q(`JSON.stringify(setupCatalogFor('${k}')||null)`)); if(!c||!Array.isArray(c.groups)) throw new Error('missing catalog '+k); }
 });
 // live render: keys (=MD by default) + vocalist Mo
 ev(`state.savedStages=state.savedStages||[];
     state.instruments.find(i=>i.id==='inst_keys').assignedTo='Marcus Donalson';
     state.instruments.find(i=>i.id==='inst_eg1').assignedTo='Petey Nieves';
     state.vocalists=[{id:'v1',name:'Mo'}]; state.assignments[0]='v1';
     state.setupItems={}; renderSetupItemsView();`);
 check('keys player row shows keys preset chips (incl. Dante)', ()=>{
   const btns=[...document.querySelectorAll('#setupItemsView .si-preset-btn[data-preset-key="keys"]')].map(b=>b.textContent);
   if(!btns.some(t=>/Sounds from computer \(Dante\)/.test(t))) throw new Error('no Dante chip; got '+btns.join('|'));
 });
 check('vocalist row shows the vocal "Straight mic stand" chip', ()=>{
   const btns=[...document.querySelectorAll('#setupItemsView .si-preset-btn[data-preset-key="vocals"]')].map(b=>b.textContent);
   if(!btns.some(t=>/Straight mic stand on stage/.test(t))) throw new Error('no vocal chip; got '+btns.join('|'));
 });
 check('clicking a keys preset chip adds its bundle items', ()=>{
   const btn=[...document.querySelectorAll('#setupItemsView .si-preset-btn[data-preset-key="keys"][data-preset-idx]')].find(b=>/Sounds from computer \(Dante\)/.test(b.textContent));
   const pk=btn.dataset.personKey; btn.click();
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[${JSON.stringify(pk)}]||{}).items||[])`));
   if(!items.some(it=>/Dante/.test(it.text))) throw new Error('Dante not added');
   if(!items.some(it=>/thunderbolt/.test(it.text))) throw new Error('bundle (network adapter) not added');
 });
 check('"+ Default setup" shows for a non-MD player (eg) and adds its defaults', ()=>{
   ev(`state.setupItems={}; renderSetupItemsView();`);  // eg1=Petey is not MD, not vocalist → empty bucket
   const db=[...document.querySelectorAll('#setupItemsView .si-preset-btn[data-preset-defaults="eg"]')][0];
   if(!db) throw new Error('no default-setup button for eg');
   const pk=db.dataset.personKey; db.click();
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[${JSON.stringify(pk)}]||{}).items||[])`));
   if(!items.some(it=>/Stereo DI box/.test(it.text))) throw new Error('eg defaults not added: '+JSON.stringify(items.map(i=>i.text)));
   if(!items.some(it=>/Single guitar stand/.test(it.text))) throw new Error('eg single stand default not added');
 });
 check('boom-mic auto-adds to the VOCALIST bucket for an explicitly-linked dual-role player', ()=>{
   ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});
       state.instruments.find(i=>i.id==='inst_bass').vocalistPlayer='v2';
       state.vocalists=[{id:'v1',name:'Mo'},{id:'v2',name:'Grayson Kredit'}]; state.assignments=[]; state.assignments[1]='v2';
       state.setupItems={}; renderSetupItemsView();`);
   // Boom now lands on the STABLE per-person key (name|vocalist|vocals), the same key
   // the check-off view + grouped editor share — not the legacy setupKeyForVocal(name).
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[stableSetupKey('Grayson Kredit','vocalist','vocals')]||{}).items||[])`));
   if(!items.some(it=>it.text==='Boom mic stand' && it.autoAdded)) throw new Error('boom not on vocalist bucket for linked dual-role: '+JSON.stringify(items.map(i=>i.text)));
 });
 check('boom-mic does NOT auto-add for a mere same-name match (no explicit link)', ()=>{
   ev(`state.instruments.forEach(i=>{i.assignedTo='';i.vocalistPlayer=null;});
       var eg=state.instruments.find(i=>i.id==='inst_eg1'); eg.assignedTo='Brian';
       state.vocalists=[{id:'vb',name:'Brian'}]; state.assignments=[]; state.assignments[0]='vb';
       state.setupItems={}; renderSetupItemsView();`);
   // Read the stable band key (name|band|eg) — same key the render path uses for this player.
   const items=JSON.parse(Q(`JSON.stringify((state.setupItems[stableSetupKey('Brian','band','eg')]||{}).items||[])`));
   if(items.some(it=>it.text==='Boom mic stand')) throw new Error('boom wrongly auto-added on name match: '+JSON.stringify(items.map(i=>i.text)));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
