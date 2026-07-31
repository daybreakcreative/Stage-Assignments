const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=w.confirm||(()=>true); w.prompt=w.prompt||(()=>null);
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function optionValues(sel){return Array.from(sel.querySelectorAll('option')).map(o=>o.value).filter(v=>v!=='');}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 check('explicit inst.setupKey wins over everything', ()=>{
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog={custom_perc:{label:'Percussion',groups:[]}};");
   const k=ev("detectPresetKey({label:'Drums', tag:'drums', setupKey:'custom_perc'})");
   if(k!=='custom_perc') throw new Error('setupKey override ignored, got '+k);
 });

 check('a keyword rule maps a matching label to its key', ()=>{
   ev("state.config.setupCatalog={custom_perc:{label:'Percussion',groups:[]}}; state.config.setupTypeRules=[{id:'r1',keyword:'percussion',key:'custom_perc'}];");
   const k=ev("detectPresetKey({label:'Percussion 1', tag:''})");
   if(k!=='custom_perc') throw new Error('keyword rule not applied, got '+k);
 });

 check('a garbage setupKey (not built-in, not in overlay) falls through to rules then regex', ()=>{
   ev("state.config.setupCatalog={custom_perc:{label:'Percussion',groups:[]}}; state.config.setupTypeRules=[];");
   const k1=ev("detectPresetKey({label:'Bass', tag:'bass', setupKey:'nonexistent_key'})");
   if(k1!=='bass') throw new Error('garbage setupKey did not fall through to built-in regex, got '+k1);
   ev("state.config.setupTypeRules=[{id:'r1',keyword:'perc',key:'custom_perc'}];");
   const k2=ev("detectPresetKey({label:'Percussion 1', tag:'', setupKey:'nonexistent_key'})");
   if(k2!=='custom_perc') throw new Error('garbage setupKey did not fall through to a matching rule, got '+k2);
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog=null;");
 });

 check('built-in regex still works when no override/rule matches', ()=>{
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog=null;");
   if(ev("detectPresetKey({label:'Bass', tag:'bass'})")!=='bass') throw new Error('built-in bass detection broke');
   if(ev("detectPresetKey({label:'Electric Guitar', tag:''})")!=='eg') throw new Error('built-in eg detection broke');
 });

 check('a rule does not override an explicit setupKey', ()=>{
   ev("state.config.setupTypeRules=[{id:'r1',keyword:'drum',key:'custom_perc'}]; state.config.setupCatalog={custom_perc:{label:'Percussion',groups:[]}};");
   const k=ev("detectPresetKey({label:'Drums', tag:'drums', setupKey:'drums'})");
   if(k!=='drums') throw new Error('setupKey should win over rule, got '+k);
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog=null;");
 });

 check('catalogAddType creates a custom key present in allSetupKeys', ()=>{
   ev("state.config.setupCatalog=null;");
   const k=ev("catalogAddType('Percussion')");
   if(!/^custom_/.test(k)) throw new Error('unexpected key '+k);
   if(!ev(`allSetupKeys().includes('${k}')`)) throw new Error('custom key not enumerated');
   if(ev(`setupCatalogFor('${k}').label`)!=='Percussion') throw new Error('label not set');
 });

 check('bulkRoleOpts() includes custom types', ()=>{
   ev("state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   const opts=JSON.parse(ev("JSON.stringify(bulkRoleOpts().map(o=>o.v))"));
   if(!opts.includes(ev('window.__pk'))) throw new Error('custom type missing from bulkRoleOpts: '+opts.join(','));
 });

 check('catalogRemoveType deletes the type and its keyword rules', ()=>{
   ev("state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion'); state.config.setupTypeRules=[{id:'r',keyword:'perc',key:window.__pk}];");
   ev("catalogRemoveType(window.__pk);");
   if(ev(`allSetupKeys().includes(window.__pk)`)) throw new Error('type not removed');
   if(ev("state.config.setupTypeRules.some(r=>r.key===window.__pk)")) throw new Error('dangling rule left behind');
 });

 check('catalogRemoveType refuses to delete a built-in key', ()=>{
   ev("state.config.setupCatalog=null; catalogMaterialize('eg'); catalogRemoveType('eg');");
   // eg is built-in; removeType must be a no-op (overlay entry may remain, key still enumerated)
   if(!ev("allSetupKeys().includes('eg')")) throw new Error('built-in eg wrongly removed');
 });

 check('BUILTIN_BULK_ROLE_OPTS labels are verbatim identical to the pre-refactor BULK_ROLE_OPTS', ()=>{
   const expected=[
     {v:'vocalist',label:'Vocalist'},
     {v:'drums',label:'Drums'},{v:'bass',label:'Bass'},{v:'keys',label:'Keys'},
     {v:'eg',label:'Electric Gtr'},{v:'ag',label:'Acoustic Gtr'},{v:'strings',label:'Strings'},
     {v:'md',label:'MD (tracks, no instrument)'}
   ];
   const actual=JSON.parse(ev('JSON.stringify(BUILTIN_BULK_ROLE_OPTS)'));
   if(JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error('label/order regression: '+JSON.stringify(actual));
 });

 check('bulkRoleOpts() custom entry carries the catalog label, not the raw key', ()=>{
   ev("state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   const opts=JSON.parse(ev("JSON.stringify(bulkRoleOpts())"));
   const mine=opts.find(o=>o.v===ev('window.__pk'));
   if(!mine) throw new Error('custom type missing from bulkRoleOpts');
   if(mine.label!=='Percussion') throw new Error('custom type label wrong, got '+mine.label);
   // built-ins must still be present alongside the custom addition
   if(!opts.some(o=>o.v==='drums'&&o.label==='Drums')) throw new Error('built-in drums entry dropped');
 });

 check('renderCatalogEditor on a fresh custom type (empty groups) renders without throwing', ()=>{
   ev("state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   const host=doc.createElement('div'); host.id='__catEditCustom'; doc.body.appendChild(host);
   ev("renderCatalogEditor(document.getElementById('__catEditCustom'), window.__pk);");
   if(doc.querySelectorAll('#__catEditCustom .cat-group').length!==0) throw new Error('expected zero sections for an empty custom type');
   if(!doc.querySelector('#__catEditCustom .cat-add-group')) throw new Error('missing add-section control');
   const resetBtn=doc.querySelector('#__catEditCustom .cat-reset');
   if(!resetBtn) throw new Error('missing footer action button');
   if(resetBtn.textContent!=='Delete this type') throw new Error('custom type footer button should read "Delete this type", got '+resetBtn.textContent);
   host.remove();
 });

 check('renderSetupDefaultsEditor enumerates a custom type as a full card and its Edit-questions disclosure renders lazily', ()=>{
   ev("state.config.setupDefaults={}; state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   ev("renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));");
   const card=doc.querySelector(`#setupDefaultsEditor .wiz-setup-inst[data-def-key="${ev('window.__pk')}"]`);
   if(!card) throw new Error('custom type card not rendered by allSetupKeys() enumeration');
   const disc=card.querySelector('.cat-edit-disclosure');
   if(!disc) throw new Error('custom card missing Edit-questions disclosure');
   disc.open=true; disc.dispatchEvent(new window.Event('toggle'));
   if(!card.querySelector('.cat-edit-mount .cat-reset')) throw new Error('lazy catalog editor did not render on toggle');
 });

 check('"＋ New instrument type" button wires prompt() -> catalogAddType -> re-render', ()=>{
   ev("state.config.setupDefaults={}; state.config.setupCatalog=null;");
   ev("renderSetupDefaultsEditor(document.getElementById('setupDefaultsEditor'));");
   const before=doc.querySelectorAll('#setupDefaultsEditor .wiz-setup-inst').length;
   ev("window.prompt=()=>'Percussion';");
   const btn=doc.getElementById('catAddTypeBtn');
   if(!btn) throw new Error('no ＋ New instrument type button rendered');
   btn.dispatchEvent(new window.Event('click',{bubbles:true}));
   ev("window.prompt=()=>null;");
   const after=doc.querySelectorAll('#setupDefaultsEditor .wiz-setup-inst').length;
   if(after!==before+1) throw new Error(`expected one new card after add (before=${before}, after=${after})`);
   const added=Object.keys(JSON.parse(ev('JSON.stringify(state.config.setupCatalog||{})'))).some(k=>/^custom_/.test(k));
   if(!added) throw new Error('catalogAddType was not invoked by the button');
 });

 check('renderSetupTypeRules lists rules and adds a new one', ()=>{
   ev("state.config.setupTypeRules=[]; state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   const host=doc.createElement('div'); host.id='__rules'; doc.body.appendChild(host);
   ev("renderSetupTypeRules(document.getElementById('__rules'));");
   const kw=doc.querySelector('#__rules .rule-kw'); const sel=doc.querySelector('#__rules .rule-key'); const add=doc.querySelector('#__rules .rule-add');
   if(!kw||!sel||!add) throw new Error('rules editor controls missing');
   kw.value='percussion'; kw.dispatchEvent(new window.Event('input',{bubbles:true}));
   sel.value=Array.from(sel.options).map(o=>o.value).find(v=>/^custom_/.test(v)); sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   add.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
   if(!ev("state.config.setupTypeRules.some(r=>r.keyword==='percussion')")) throw new Error('rule not added');
 });

 check('instrument card exposes a Setup type override (only when custom types exist) that sets inst.setupKey', ()=>{
   ev("state.instruments=[{id:'inst_x',label:'Thing',tag:'',assignedTo:'',pack:''}]; state.config.setupCatalog=null; window.__pk=catalogAddType('Percussion');");
   ev("renderInstrumentsEditor();");
   const sel=doc.querySelector('.inst-setupkey[data-id=\"inst_x\"]');
   if(!sel) throw new Error('no setup-type override select on instrument card');
   const custom=Array.from(sel.options).map(o=>o.value).find(v=>/^custom_/.test(v));
   sel.value=custom; sel.dispatchEvent(new window.Event('change',{bubbles:true}));
   if(ev("state.instruments.find(i=>i.id==='inst_x').setupKey")!==custom) throw new Error('setupKey not written, got '+ev("state.instruments.find(i=>i.id==='inst_x').setupKey"));
 });

 check('no Setup type override select when there are NO custom types (clean default UI)', ()=>{
   ev("state.instruments=[{id:'inst_y',label:'Keys',tag:'keys',assignedTo:'',pack:''}]; state.config.setupCatalog=null;");
   ev("renderInstrumentsEditor();");
   if(doc.querySelector('.inst-setupkey[data-id=\"inst_y\"]')) throw new Error('override select shown with no custom types');
 });

 setTimeout(()=>{ console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','==='); process.exit(errs.length?1:0); },20);
},60));
