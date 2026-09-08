// Some catalog options drag EXTRA checklist lines in with them ("Stereo guitar rig" implies
// "Amp & mic setup (stereo)", a DI box and two XLRs). Those implied lines were editable nowhere:
// Settings could rename the option itself but not the lines it implies, so a church whose stereo
// rig needs a different box had to remove the line on every single player, one at a time.
//
// The second half of this file guards the thing that makes editing them safe. Every per-person
// override -- a reword, and a removal -- is stored as `replaces: <the original catalog text>`.
// Rename the catalog text without migrating those keys and the override silently detaches: a
// removed line COMES BACK, and a reworded one renders twice. That was already true for renaming an
// option; making implied lines editable would have multiplied it.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.setPointerCapture=()=>{};w.releasePointerCapture=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const STEREO='Amp & mic setup (stereo)';

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 const reset=()=>ev(`state.config.setupCatalog={}; state.setupItems={}; catalogMaterialize('eg');`);

 console.log('--- editing the implied lines ---');

 check('an implied line can be reworded in the catalog', ()=>{
   reset();
   ev(`catalogSetAddItem('eg','rig','eg_stereo',1,'Amp & Royer 121 (stereo)')`);
   const items=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_stereo').addItems)`));
   if(items[1]!=='Amp & Royer 121 (stereo)') throw new Error('got '+JSON.stringify(items));
   if(items.length!==3) throw new Error('rewording must not add or drop lines: '+JSON.stringify(items));
 });

 check('an implied line can be added, removed and reordered', ()=>{
   reset();
   ev(`catalogAddAddItem('eg','rig','eg_house','Needs a Helix preset loaded')`);
   let house=()=>JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_house').addItems||[])`));
   if(house().length!==1) throw new Error('add to an option with NO addItems failed: '+JSON.stringify(house()));
   ev(`catalogAddAddItem('eg','rig','eg_house','Second line')`);
   if(house().join('|')!=='Needs a Helix preset loaded|Second line') throw new Error(JSON.stringify(house()));
   ev(`catalogMoveAddItem('eg','rig','eg_house',1,-1)`);
   if(house()[0]!=='Second line') throw new Error('move up failed: '+JSON.stringify(house()));
   ev(`catalogRemoveAddItem('eg','rig','eg_house',0)`);
   if(house().join('|')!=='Needs a Helix preset loaded') throw new Error('remove failed: '+JSON.stringify(house()));
 });

 check('an edited implied line shows up on the person, by its new text', ()=>{
   reset();
   ev(`catalogSetAddItem('eg','rig','eg_stereo',1,'Amp & Royer 121 (stereo)')`);
   const out=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{rig:'eg_stereo'},[]).map(i=>i.text))`));
   if(out.indexOf('Amp & Royer 121 (stereo)')===-1) throw new Error('new text missing: '+JSON.stringify(out));
   if(out.indexOf(STEREO)!==-1) throw new Error('old text still rendered: '+JSON.stringify(out));
 });

 check('a removed implied line stops reaching the person', ()=>{
   reset();
   ev(`catalogRemoveAddItem('eg','rig','eg_stereo',1)`);
   const out=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',{rig:'eg_stereo'},[]).map(i=>i.text))`));
   if(out.indexOf(STEREO)!==-1) throw new Error('still there: '+JSON.stringify(out));
   if(out.indexOf('Stereo DI box')===-1) throw new Error('siblings must survive: '+JSON.stringify(out));
 });

 console.log('--- per-person overrides survive a catalog rename ---');

 const seedPerson=(ci)=>ev(`state.setupItems['p|Jack Grubbs|eg']={selections:{rig:'eg_stereo'},customItems:${ci},items:[]};`);
 const linesFor=()=>JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',state.setupItems['p|Jack Grubbs|eg'].selections,state.setupItems['p|Jack Grubbs|eg'].customItems).map(i=>i.text))`));

 check('a line the player REMOVED stays removed after the catalog reword', ()=>{
   reset();
   seedPerson(`[{id:'c1',text:'',replaces:${JSON.stringify(STEREO)}}]`);
   if(linesFor().indexOf(STEREO)!==-1) throw new Error('precondition: should start removed');
   ev(`catalogSetAddItem('eg','rig','eg_stereo',1,'Amp & Royer 121 (stereo)')`);
   const out=linesFor();
   if(out.indexOf('Amp & Royer 121 (stereo)')!==-1) throw new Error('the removed line came back under its new name: '+JSON.stringify(out));
 });

 check('a line the player REWORDED stays reworded, and does not duplicate', ()=>{
   reset();
   seedPerson(`[{id:'c2',text:'Amp & mic — SM7B',replaces:${JSON.stringify(STEREO)}}]`);
   ev(`catalogSetAddItem('eg','rig','eg_stereo',1,'Amp & Royer 121 (stereo)')`);
   const out=linesFor();
   if(out.filter(t=>t==='Amp & mic — SM7B').length!==1) throw new Error('reword lost: '+JSON.stringify(out));
   if(out.indexOf('Amp & Royer 121 (stereo)')!==-1) throw new Error('duplicated by the new catalog text: '+JSON.stringify(out));
 });

 // The same defect, on the control that shipped weeks ago: renaming "House EG rig" -> "House Helix".
 check('renaming an OPTION also carries per-person overrides with it', ()=>{
   reset();
   ev(`state.setupItems['p|Ann|eg']={selections:{rig:'eg_house'},customItems:[{id:'c3',text:'',replaces:'House EG rig'}],items:[]};`);
   ev(`catalogRenameOption('eg','rig','eg_house','House Helix')`);
   const out=JSON.parse(ev(`JSON.stringify(resolveSetupItems('eg',state.setupItems['p|Ann|eg'].selections,state.setupItems['p|Ann|eg'].customItems).map(i=>i.text))`));
   if(out.indexOf('House Helix')!==-1) throw new Error('the removed option came back as "House Helix": '+JSON.stringify(out));
 });

 check('migration only touches the renamed text, not other overrides', ()=>{
   reset();
   seedPerson(`[{id:'c4',text:'',replaces:'Stereo DI box'},{id:'c5',text:'Keep me'}]`);
   ev(`catalogSetAddItem('eg','rig','eg_stereo',1,'Amp & Royer 121 (stereo)')`);
   const ci=JSON.parse(ev(`JSON.stringify(state.setupItems['p|Jack Grubbs|eg'].customItems)`));
   if(ci[0].replaces!=='Stereo DI box') throw new Error('unrelated override was rewritten: '+JSON.stringify(ci));
   if(ci[1].text!=='Keep me'||ci[1].replaces) throw new Error('a plain custom item was touched: '+JSON.stringify(ci));
 });

 console.log('--- the editor UI exposes it ---');

 check('the catalog editor renders an implied-line editor for each option', ()=>{
   reset();
   const host=doc.createElement('div'); doc.body.appendChild(host);
   window.renderCatalogEditor(host,'eg',null);
   const row=host.querySelector('.cat-opt-row[data-oid="eg_stereo"]');
   if(!row) throw new Error('no option row for eg_stereo');
   const inputs=row.querySelectorAll('.cat-imp-input');
   if(inputs.length!==3) throw new Error('expected 3 implied-line inputs, got '+inputs.length);
   if(inputs[1].value!==STEREO) throw new Error('wrong value: '+inputs[1].value);
   if(!row.querySelector('.cat-imp-add-input')) throw new Error('no way to add an implied line');
   // An option with none must still offer the control, else you could never add the first one.
   const houseRow=host.querySelector('.cat-opt-row[data-oid="eg_house"]');
   if(!houseRow.querySelector('.cat-imp-add-input')) throw new Error('option with no implied lines cannot gain one');
 });

 check('typing in an implied-line input writes through to the catalog', ()=>{
   reset();
   const host=doc.createElement('div'); doc.body.appendChild(host);
   window.renderCatalogEditor(host,'eg',null);
   const inp=host.querySelector('.cat-opt-row[data-oid="eg_stereo"] .cat-imp-input:nth-of-type(1)')
          || host.querySelectorAll('.cat-opt-row[data-oid="eg_stereo"] .cat-imp-input')[0];
   inp.value='Stereo DI — Radial';
   inp.dispatchEvent(new window.Event('input',{bubbles:true}));
   const items=JSON.parse(ev(`JSON.stringify(setupCatalogFor('eg').groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_stereo').addItems)`));
   if(items[0]!=='Stereo DI — Radial') throw new Error('not written through: '+JSON.stringify(items));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
