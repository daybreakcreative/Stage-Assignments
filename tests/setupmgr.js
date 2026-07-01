const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const fire=(el,t)=>el.dispatchEvent(new window.Event(t,{bubbles:true}));
const keys=()=>ev('Object.keys(state.setupItems)');
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderSetupItemsView=function(){}');
 // NOTE: seeds STABLE-KEY buckets (name|role|typeKey) — the current setup model.
 // (Old-format keys like "grayson|vocal" are folded into these by
 // migrateLegacySetupBuckets() at init in the real app.) renderSetupManager now
 // derives labels + in-lineup status from enumerateSetupRoles(), so buckets whose
 // stable key is not in the current enumeration are the orphans. To keep the
 // orphan test honest we DISABLE the MD entry (no musicDirectorId) so Marcus has a
 // single band/keys entry; the orphan is a former vocalist not in state.vocalists.
 const kV=()=>ev(`stableSetupKey("Grayson","vocalist","vocals")`);
 const kB=()=>ev(`stableSetupKey("Marcus","band","keys")`);
 const kO=()=>ev(`stableSetupKey("Old Singer","vocalist","vocals")`);
 const setup=()=>{
   ev(`state.vocalists=[{id:"v1",name:"Grayson",isWL:true,leadsSongs:true,micAssigned:""}]`);
   ev(`state.shadows=[]`);
   ev(`state.instruments=[{id:"inst_keys",label:"Keys",assignedTo:"Marcus",vocalistPlayer:null,tag:"Keys"}]`);
   ev(`state.musicDirectorId=null`);
   ev(`state.setupItems={
     [stableSetupKey("Grayson","vocalist","vocals")]:{items:[{id:"a",text:"Wedge"},{id:"b",text:"Music stand"}],seeded:true,selections:{},customItems:[]},
     [stableSetupKey("Marcus","band","keys")]:{items:[{id:"c",text:"MIDI cable"}],seeded:true,selections:{},customItems:[]},
     [stableSetupKey("Old Singer","vocalist","vocals")]:{items:[{id:"d",text:"Handheld"}],seeded:true,selections:{},customItems:[]}
   }`);
 };

 check('renders a group per person; orphan flagged; names resolved/title-cased', ()=>{
   setup(); ev('renderSetupManager()');
   const groups=doc.querySelectorAll('#setupMgrList .setup-person');
   if(groups.length!==3) throw new Error('expected 3 person groups, got '+groups.length);
   const orphans=doc.querySelectorAll('#setupMgrList .setup-person.orphan');
   if(orphans.length!==1) throw new Error('expected 1 orphan, got '+orphans.length);
   const txt=doc.getElementById('setupMgrList').textContent;
   if(!/Grayson/.test(txt)||!/Marcus/.test(txt)||!/Old Singer/.test(txt)) throw new Error('name resolution off: '+txt.replace(/\s+/g,' ').slice(0,160));
 });
 check('in-lineup people sort before orphans', ()=>{
   setup(); ev('renderSetupManager()');
   const names=[...doc.querySelectorAll('#setupMgrList .setup-person-name')].map(n=>n.textContent);
   if(names[names.length-1]!=='Old Singer') throw new Error('orphan should be last: '+JSON.stringify(names));
 });
 check('purge button count reflects only orphans', ()=>{
   setup(); ev('renderSetupManager()');
   const btn=doc.getElementById('setupPurgeOrphans');
   if(!btn) throw new Error('no purge button');
   if(!/\b1\b/.test(btn.textContent)) throw new Error('purge count wrong: '+btn.textContent);
 });
 check('delete a bucket removes it from state', ()=>{
   setup(); ev('renderSetupManager()');
   const del=doc.querySelector(`#setupMgrList .setup-bucket-del[data-del-key="${kO()}"]`);
   if(!del) throw new Error('no delete button for orphan bucket');
   del.click();
   if(keys().includes(kO())) throw new Error('bucket not deleted: '+JSON.stringify(keys()));
 });
 check('removing the last item drops an orphan bucket', ()=>{
   // In-lineup people always keep a (possibly empty) bucket because
   // enumerateSetupRoles() re-seeds current-roster entries on every render, so we
   // assert the drop on the ORPHAN (Old Singer), who is not re-seeded.
   setup(); ev('renderSetupManager()');
   const rm=doc.querySelector(`#setupMgrList .setup-item-rm[data-rm-key="${kO()}"][data-rm-i="0"]`);
   rm.click();
   if(keys().includes(kO())) throw new Error('emptied orphan bucket should be dropped: '+JSON.stringify(keys()));
 });
 check('editing an item updates its text', ()=>{
   setup(); ev('renderSetupManager()');
   const inp=doc.querySelector(`#setupMgrList .setup-item-input[data-key="${kV()}"][data-i="0"]`);
   inp.value='Wedge x2'; fire(inp,'change');
   if(ev(`state.setupItems[stableSetupKey("Grayson","vocalist","vocals")].items[0].text`)!=='Wedge x2') throw new Error('edit not saved');
 });
 check('purge orphans removes only people not in the lineup', ()=>{
   setup(); ev('renderSetupManager()');
   doc.getElementById('setupPurgeOrphans').click();
   const k=keys();
   if(k.includes(kO())) throw new Error('orphan not purged');
   if(!k.includes(kV())||!k.includes(kB())) throw new Error('purge removed in-lineup data: '+JSON.stringify(k));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
