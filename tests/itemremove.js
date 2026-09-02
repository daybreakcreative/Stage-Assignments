// Any line on a person's setup list must be removable — including the implied `addItems` lines a
// radio option drags in. Reported 2026-08-28: "Can't remove 'amp and mic setup for Jack Grubbs'".
// "Amp & mic setup (stereo)" is an addItems entry of the EG "Stereo guitar rig" option, so the
// only previous way to drop it was to untick the whole rig — which also removed the DI box and
// XLRs Jack still needs.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 const K="stableSetupKey('Jack Grubbs','band','eg')";
 // Jack on Electric 1 with the stereo rig selected — the exact reported state.
 const seed=()=>ev(`
   state.setupItems={}; state.config.setupCatalog=null; state.config.setupDefaults={};
   state.vocalists=[]; state.assignments=[]; state.shadows=[]; state.hosts={};
   state.mdSoloName=null; state.musicDirectorId=null;
   state.instruments=[{id:'inst_eg',label:'Electric 1',tag:'eg',assignedTo:'Jack Grubbs',pack:'EG'}];
   var k=${K};
   seedPersonSetup(k,'eg');
   state.setupItems[k].selections={ rig:'eg_stereo', stand:'eg_single' };
   state.setupItems[k].customItems=[];
   rebuildPersonItems(k,'eg');
 `);
 const texts=()=>JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].items||[]).map(i=>i.text))`));

 check('the reported state reproduces: the implied Amp & mic line is present', ()=>{
   seed();
   const t=texts();
   if(t.indexOf('Amp & mic setup (stereo)')===-1) throw new Error('did not reproduce: '+JSON.stringify(t));
   if(t.indexOf('Stereo DI box')===-1) throw new Error('DI box missing: '+JSON.stringify(t));
 });

 check('removeSetupLine drops ONLY that implied line', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)');`);
   const t=texts();
   if(t.indexOf('Amp & mic setup (stereo)')!==-1) throw new Error('still present: '+JSON.stringify(t));
   if(t.indexOf('Stereo DI box')===-1) throw new Error('sibling DI box was wrongly removed: '+JSON.stringify(t));
   if(t.indexOf('2 XLRs for player EG rig')===-1) throw new Error('sibling XLRs wrongly removed: '+JSON.stringify(t));
   if(t.indexOf('Stereo guitar rig')===-1) throw new Error('parent option wrongly removed: '+JSON.stringify(t));
 });

 check('the removal survives a rebuild (it is not just an items-array edit)', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)'); rebuildPersonItems(${K},'eg');`);
   if(texts().indexOf('Amp & mic setup (stereo)')!==-1) throw new Error('came back after rebuild');
 });

 check('the removal survives reconstruction too', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)');
       var k=${K}; state.setupItems[k].selections={}; reconstructSetupBucket(k,'eg'); rebuildPersonItems(k,'eg');`);
   if(texts().indexOf('Amp & mic setup (stereo)')!==-1) throw new Error('came back after reconstruction');
 });

 check('removeSetupLine on a REAL custom item deletes it outright', ()=>{
   seed();
   ev(`var k=${K}; state.setupItems[k].customItems.push({id:'c1',text:'Needs a stool'}); rebuildPersonItems(k,'eg');`);
   ev(`removeSetupLine(${K},'eg','Needs a stool');`);
   const cust=JSON.parse(ev(`JSON.stringify((state.setupItems[${K}].customItems||[]).map(c=>c.text))`));
   if(texts().indexOf('Needs a stool')!==-1) throw new Error('custom item not removed');
   if(cust.indexOf('Needs a stool')!==-1) throw new Error('custom item left behind in customItems');
 });

 check('restoreSetupLine brings an implied line back', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)');`);
   ev(`restoreSetupLine(${K},'eg','Amp & mic setup (stereo)');`);
   if(texts().indexOf('Amp & mic setup (stereo)')===-1) throw new Error('restore failed: '+JSON.stringify(texts()));
 });

 check('removedSetupLines lists what is suppressed', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)');`);
   const gone=JSON.parse(ev(`JSON.stringify(removedSetupLines(${K}))`));
   if(gone.length!==1 || gone[0]!=='Amp & mic setup (stereo)') throw new Error('bad list: '+JSON.stringify(gone));
 });

 check('a check-off on a surviving line is not disturbed', ()=>{
   seed();
   ev(`var k=${K}; var b=state.setupItems[k];
       (b.items.find(function(i){return i.text==='Stereo DI box'})||{}).doneThisService=true;
       removeSetupLine(k,'eg','Amp & mic setup (stereo)');`);
   const done=ev(`(function(){var b=state.setupItems[${K}];var it=b.items.find(function(i){return i.text==='Stereo DI box'});return it?!!it.doneThisService:null;})()`);
   if(done!==true) throw new Error('check-off lost on a sibling line, got '+done);
 });

 console.log('--- editor UI ---');

 check('the ⚙ editor lists every resolved line with a remove control', ()=>{
   seed();
   const host=doc.createElement('div'); host.id='__ed'; doc.body.appendChild(host);
   ev(`renderPersonSetupEditor(document.getElementById('__ed'), ${K}, 'eg');`);
   const rows=[...doc.querySelectorAll('#__ed .sp-line-row')];
   const labels=rows.map(r=>(r.querySelector('.sp-line-text')||{}).textContent);
   if(labels.indexOf('Amp & mic setup (stereo)')===-1) throw new Error('implied line not listed: '+JSON.stringify(labels));
   const row=rows.find(r=>(r.querySelector('.sp-line-text')||{}).textContent==='Amp & mic setup (stereo)');
   if(!row.querySelector('.sp-line-remove')) throw new Error('no remove control on the implied line');
 });

 check('clicking that remove control drops the line', ()=>{
   seed();
   const host=doc.getElementById('__ed')||doc.body.appendChild(Object.assign(doc.createElement('div'),{id:'__ed'}));
   ev(`renderPersonSetupEditor(document.getElementById('__ed'), ${K}, 'eg');`);
   const row=[...doc.querySelectorAll('#__ed .sp-line-row')]
     .find(r=>(r.querySelector('.sp-line-text')||{}).textContent==='Amp & mic setup (stereo)');
   row.querySelector('.sp-line-remove').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
   if(texts().indexOf('Amp & mic setup (stereo)')!==-1) throw new Error('click did not remove it');
 });

 check('a removed line shows in a restore list in the editor', ()=>{
   seed();
   ev(`removeSetupLine(${K},'eg','Amp & mic setup (stereo)');`);
   const host=doc.getElementById('__ed');
   ev(`renderPersonSetupEditor(document.getElementById('__ed'), ${K}, 'eg');`);
   const restore=doc.querySelector('#__ed .sp-restore-row .sp-line-restore');
   if(!restore) throw new Error('no restore affordance for the removed line');
   restore.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
   if(texts().indexOf('Amp & mic setup (stereo)')===-1) throw new Error('restore click did not bring it back');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
