// 2026-10-01, Dillon: "do the same for every position if MD is assigned to it" — ONE checklist per
// person. A Keys player who is also the MD used to hold band|keys AND md|md: one card merged them,
// the editor stacked two section sets (two line lists, two add rows, two restore lists), and a
// remove had to be fanned across buckets. Now the MD role FOLDS into the instrument bucket:
// `selections.md` holds the MD catalog picks, MD church customs are tagged md:true, and the MD lines
// print only while that person IS the MD on that instrument. A solo MD (no instrument) and a
// tracks-type MD keep their single bucket as before.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const J=c=>JSON.parse(ev('JSON.stringify('+c+')'));

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');
 const reset=()=>ev(`state._firstRun=false; state.config.setupCatalog=null; state.config.setupDefaults={}; state.setupItems={};
   state.vocalists=[]; state.assignments=new Array(8).fill(null); state.shadows=[]; state.config.enableShadows=false; state.config.stageAreas=[];
   state.mdSoloName=null; state.musicDirectorId=null;
   state.instruments=[{id:'i_keys',label:'Keys',assignedTo:'Pat Player',pack:'Keys',tag:'Keys'},{id:'i_bass',label:'Bass',assignedTo:'Bo Low',tag:'Bass'}];`);
 const KK=()=>ev(`stableSetupKey('Pat Player','band','keys')`), MK=()=>ev(`stableSetupKey('Pat Player','md','md')`);
 const rows=()=>J(`enumerateSetupRoles().map(r=>({name:r.name,role:r.role,typeKey:r.typeKey,stableKey:r.stableKey,label:r.label,mdFolded:!!r.mdFolded}))`);
 const lines=k=>J(`(state.setupItems[${JSON.stringify(k)}].items||[]).map(i=>i.text)`);

 console.log('--- one row, one bucket, one card ---');
 check('MD on Keys → exactly ONE enumerated row for that person, flagged mdFolded, keyed band|keys; no md|md bucket', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   const mine=rows().filter(r=>/pat player/.test(r.stableKey));
   if(mine.length!==1) throw new Error('expected 1 row, got '+JSON.stringify(mine));
   if(mine[0].stableKey!==KK()||!mine[0].mdFolded) throw new Error(JSON.stringify(mine[0]));
   if(ev(`!!state.setupItems[${JSON.stringify(MK())}]`)) throw new Error('a separate md|md bucket was minted');
 });
 check('getStageAreas: no separate MD area; the Keys entry carries mdFolded', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   const areas=J(`getStageAreas().map(a=>({id:a.id,people:a.people.map(p=>({key:p.key,mdFolded:!!p.mdFolded}))}))`);
   if(areas.some(a=>a.id==='area_md')) throw new Error('area_md still emitted');
   const keys=areas.find(a=>a.people.some(p=>p.key===KK()));
   if(!keys||!keys.people[0].mdFolded) throw new Error('keys entry not flagged: '+JSON.stringify(areas));
 });
 check('the ✓ Items card reads "Keys · MD" and there is one card', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   const ps=J(`collectChecklistItems().flatMap(s=>(s.people||[]).filter(p=>p.name==='Pat Player').map(p=>({roleLabel:p.roleLabel,buckets:p.buckets.length})))`);
   if(ps.length!==1) throw new Error('cards: '+JSON.stringify(ps));
   if(!/Keys/.test(ps[0].roleLabel)||!/MD/.test(ps[0].roleLabel)) throw new Error('role label: '+ps[0].roleLabel);
   if(ps[0].buckets!==1) throw new Error('card still carries '+ps[0].buckets+' buckets');
 });

 console.log('--- both catalogs resolve into the one list ---');
 check('a keys radio implication AND an md check line both print; a line in both catalogs prints once', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`enumerateSetupRoles(); const b=state.setupItems[${JSON.stringify(KK())}];
       b.selections.extras=['k_music']; b.selections.md={rig:['md_tracks'],extras:['md_music']}; rebuildPersonItems(${JSON.stringify(KK())},'keys');`);
   const l=lines(KK());
   if(l.indexOf('House tracks computer')===-1) throw new Error('md line missing: '+JSON.stringify(l));
   if(l.indexOf('Music stand')===-1) throw new Error('keys line missing: '+JSON.stringify(l));
   if(l.filter(t=>t==='Music stand').length!==1) throw new Error('Music stand printed twice: '+JSON.stringify(l));
 });
 check('MD church defaults seed selections.md and md customs once (tagged md), not on every pass', ()=>{
   reset(); ev(`state.config.setupDefaults={md:{selections:{rig:['md_tracks']},customOptions:[{text:'Bring click track'}]}}; state.musicDirectorId='i_keys'`);
   ev(`enumerateSetupRoles(); enumerateSetupRoles(); getStageAreas();`);
   const b=J(`state.setupItems[${JSON.stringify(KK())}]`);
   if(!b.selections.md||(b.selections.md.rig||[]).indexOf('md_tracks')===-1) throw new Error('selections.md not seeded: '+JSON.stringify(b.selections));
   const customs=b.customItems.filter(c=>c.text==='Bring click track');
   if(customs.length!==1||!customs[0].md) throw new Error('md custom seeded wrong: '+JSON.stringify(b.customItems));
   const l=lines(KK()); if(l.indexOf('House tracks computer')===-1||l.indexOf('Bring click track')===-1) throw new Error(JSON.stringify(l));
 });
 check('removing a line that the MD catalog contributes needs ONE record and it stays gone', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`enumerateSetupRoles(); const k=${JSON.stringify(KK())}; state.setupItems[k].selections.md={rig:['md_stand']}; rebuildPersonItems(k,'keys'); removeSetupLine(k,'keys','Laptop stand'); enumerateSetupRoles();`);
   if(lines(KK()).indexOf('Laptop stand')!==-1) throw new Error('still printed');
   const rec=J(`state.setupItems[${JSON.stringify(KK())}].customItems.filter(c=>c.replaces==='Laptop stand'&&!c.text)`);
   if(rec.length!==1) throw new Error('records: '+rec.length);
 });

 console.log('--- the MD lines follow the MD role, not the person ---');
 check('when the MD moves from Keys to Bass, Keys loses the md lines and Bass gains them; Keys keeps its picks dormant', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`enumerateSetupRoles(); state.setupItems[${JSON.stringify(KK())}].selections.md={rig:['md_tracks']}; rebuildPersonItems(${JSON.stringify(KK())},'keys');`);
   if(lines(KK()).indexOf('House tracks computer')===-1) throw new Error('precondition');
   ev(`state.musicDirectorId='i_bass'; enumerateSetupRoles(); rebuildPersonItems(${JSON.stringify(KK())},'keys');`);
   if(lines(KK()).indexOf('House tracks computer')!==-1) throw new Error('ex-MD still prints md lines');
   if(!J(`state.setupItems[${JSON.stringify(KK())}].selections.md`)) throw new Error('picks were thrown away');
   const bk=ev(`stableSetupKey('Bo Low','band','bass')`);
   if(!J(`state.setupItems[${JSON.stringify(bk)}].selections.md`)) throw new Error('new MD not folded');
   if(rows().filter(r=>/bo low/.test(r.stableKey)).length!==1) throw new Error('new MD got a second row');
 });

 console.log('--- legacy md|md buckets fold into the instrument bucket ---');
 check('an existing md|md (selections + custom + removal + a done tick) folds into band|keys and is deleted', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`const mk=${JSON.stringify(MK())}; state.setupItems[mk]={seeded:true,selections:{rig:['md_tracks','md_stand']},customItems:[{id:'c1',text:'Spare USB-C'},{id:'c2',text:'',replaces:'Laptop stand'}],items:[]};
       rebuildPersonItems(mk,'md'); state.setupItems[mk].items.find(i=>i.text==='House tracks computer').doneThisService=true;
       enumerateSetupRoles();`);
   if(ev(`!!state.setupItems[${JSON.stringify(MK())}]`)) throw new Error('md|md not deleted');
   const b=J(`state.setupItems[${JSON.stringify(KK())}]`);
   const l=b.items.map(i=>i.text);
   if(l.indexOf('House tracks computer')===-1||l.indexOf('Spare USB-C')===-1) throw new Error('lines lost: '+JSON.stringify(l));
   if(l.indexOf('Laptop stand')!==-1) throw new Error('removal lost');
   if(!b.items.find(i=>i.text==='House tracks computer').doneThisService) throw new Error('done tick lost');
 });
 check('a legacy md|md whose items were never reconstructed (items only) still folds by text', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`state.setupItems[${JSON.stringify(MK())}]={seeded:true,selections:{},customItems:[],items:[{id:'x',text:'House tracks computer',doneThisService:false},{id:'y',text:'Odd one',doneThisService:false}]}; enumerateSetupRoles();`);
   const l=lines(KK());
   if(l.indexOf('House tracks computer')===-1||l.indexOf('Odd one')===-1) throw new Error(JSON.stringify(l));
   if(ev(`!!state.setupItems[${JSON.stringify(MK())}]`)) throw new Error('md|md not deleted');
 });
 check('bootRepairSetupItems folds too (so the fold reaches the card without opening anything)', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'`);
   ev(`state.setupItems[${JSON.stringify(MK())}]={seeded:true,selections:{rig:['md_tracks']},customItems:[],items:[]}; bootRepairSetupItems();`);
   if(ev(`!!state.setupItems[${JSON.stringify(MK())}]`)) throw new Error('md|md survived boot');
   if(lines(KK()).indexOf('House tracks computer')===-1) throw new Error('md line not on the keys bucket after boot');
 });

 console.log('--- the editor is ONE section set ---');
 check('renderPersonSetupEditor on the folded bucket: instrument groups + an MD block, one line list, one add row', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'; enumerateSetupRoles();`);
   const host=doc.createElement('div'); doc.body.appendChild(host);
   window.__host=host; ev(`renderPersonSetupEditor(__host, ${JSON.stringify(KK())}, 'keys')`);
   if(!host.querySelector('input[value="md_tracks"]')) throw new Error('MD options not rendered');
   if(!host.querySelector('input[value="k_music"]')) throw new Error('keys options not rendered');
   if(host.querySelectorAll('.sp-customs').length!==1) throw new Error('line lists: '+host.querySelectorAll('.sp-customs').length);
   if(host.querySelectorAll('.sp-custom-add-row').length!==1) throw new Error('add rows: '+host.querySelectorAll('.sp-custom-add-row').length);
   if(!host.querySelector('.sp-md-block')) throw new Error('no labelled MD block');
   host.remove();
 });
 check('ticking an MD option in that editor writes selections.md and keeps the instrument picks', ()=>{
   reset(); ev(`state.musicDirectorId='i_keys'; enumerateSetupRoles(); state.setupItems[${JSON.stringify(KK())}].selections.extras=['k_music'];`);
   const host=doc.createElement('div'); doc.body.appendChild(host); window.__host=host;
   ev(`renderPersonSetupEditor(__host, ${JSON.stringify(KK())}, 'keys')`);
   const cb=host.querySelector('input[value="md_tracks"]'); cb.checked=true; cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const sel=J(`state.setupItems[${JSON.stringify(KK())}].selections`);
   if((sel.md.rig||[]).indexOf('md_tracks')===-1) throw new Error('md pick not stored: '+JSON.stringify(sel));
   if((sel.extras||[]).indexOf('k_music')===-1) throw new Error('instrument pick lost: '+JSON.stringify(sel));
   // and the other way round: changing an instrument option must not drop selections.md
   const kb=host.querySelector('input[value="k_laptop"]'); kb.checked=true; kb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const sel2=J(`state.setupItems[${JSON.stringify(KK())}].selections`);
   if(!sel2.md||(sel2.md.rig||[]).indexOf('md_tracks')===-1) throw new Error('instrument change dropped selections.md: '+JSON.stringify(sel2));
   host.remove();
 });
 check('a non-MD Keys player gets NO MD block', ()=>{
   reset(); ev(`enumerateSetupRoles();`);
   const host=doc.createElement('div'); doc.body.appendChild(host); window.__host=host;
   ev(`renderPersonSetupEditor(__host, ${JSON.stringify(KK())}, 'keys')`);
   if(host.querySelector('.sp-md-block')) throw new Error('MD block on a non-MD');
   host.remove();
 });

 console.log('--- untouched shapes ---');
 // Found 2026-10-01 by probe: `md` was missing from the migration's stable-role list, so every
 // name|md|md bucket was re-keyed to |band|none (pre-db690fb) or deleted (db690fb) on each boot.
 check('migrateLegacySetupBuckets leaves a name|md|md bucket alone', ()=>{
   reset(); ev(`state.setupItems={'solo em|md|md':{seeded:true,selections:{rig:['md_tracks']},customItems:[],items:[]}}; migrateLegacySetupBuckets();`);
   if(!ev(`!!state.setupItems['solo em|md|md']`)) throw new Error('md|md bucket destroyed by the migration: '+ev('JSON.stringify(Object.keys(state.setupItems))'));
 });
 check('a solo MD (no instrument) keeps a single md|md row', ()=>{
   reset(); ev(`state.mdSoloName='Solo Em';`);
   const mine=rows().filter(r=>/solo em/.test(r.stableKey));
   if(mine.length!==1||!/\|md\|md$/.test(mine[0].stableKey)) throw new Error(JSON.stringify(mine));
 });
 check('an MD on a Tracks instrument keeps its single band|md bucket', ()=>{
   reset(); ev(`state.instruments=[{id:'i_tr',label:'Tracks',tag:'Tracks',assignedTo:'Jo Vane'}]; state.musicDirectorId='i_tr';`);
   const mine=rows().filter(r=>/jo vane/.test(r.stableKey));
   if(mine.length!==1||mine[0].typeKey!=='md'||mine[0].mdFolded) throw new Error(JSON.stringify(mine));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
