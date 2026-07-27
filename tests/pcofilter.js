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
 ev(`
   renderAll=function(){}; toast=function(){}; pcoLoadPlans=function(){};
   pcoServiceTypes=[
     {id:'st1',name:'Sunday Main',folderName:''},
     {id:'st2',name:'Sunday Student',folderName:''},
     {id:'st3',name:'Wednesday Youth',folderName:''},
     {id:'st4',name:'Sunday Kids',folderName:''}
   ];
   state.pcoConfig.favoriteServiceTypeIds=[];
   state.pcoConfig.selectedServiceTypeId='';
   pcoStFilter='';
 `);

 check('favorites [] shows all 4 options', ()=>{
   ev('populateServiceTypeSelect()');
   const vals=optionValues(doc.getElementById('pcoServiceTypeSelect'));
   const expected=['st1','st2','st3','st4'];
   if(vals.sort().join(',')!==expected.sort().join(',')) throw new Error('got: '+vals.join(','));
 });

 check('favorites [st1,st3] narrows to just those', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=['st1','st3']; populateServiceTypeSelect();");
   const vals=optionValues(doc.getElementById('pcoServiceTypeSelect'));
   const expected=['st1','st3'];
   if(vals.sort().join(',')!==expected.sort().join(',')) throw new Error('got: '+vals.join(','));
 });

 check('currently-selected id is always kept even if not a favorite', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=['st1','st3']; state.pcoConfig.selectedServiceTypeId='st2'; populateServiceTypeSelect();");
   const vals=optionValues(doc.getElementById('pcoServiceTypeSelect')).sort();
   const expected=['st1','st2','st3'].sort();
   if(vals.join(',')!==expected.join(',')) throw new Error('got: '+vals.join(','));
   if(doc.getElementById('pcoServiceTypeSelect').value!=='st2') throw new Error('selection not kept, value='+doc.getElementById('pcoServiceTypeSelect').value);
 });

 check('bar search filter narrows by name (selected still kept)', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=[]; state.pcoConfig.selectedServiceTypeId='st3'; pcoStFilter='sun'; populateServiceTypeSelect();");
   const vals=optionValues(doc.getElementById('pcoServiceTypeSelect')).sort();
   // 'sun' matches st1, st2, st4 by name; st3 (Wednesday Youth) kept because selected
   const expected=['st1','st2','st3','st4'].sort();
   if(vals.join(',')!==expected.join(',')) throw new Error('got: '+vals.join(','));
   ev("pcoStFilter='';");
 });

 check('#pcoServiceTypeSearch input exists and is enabled after populate', ()=>{
   ev('populateServiceTypeSelect()');
   const f=doc.getElementById('pcoServiceTypeSearch');
   if(!f) throw new Error('missing #pcoServiceTypeSearch');
   if(f.disabled) throw new Error('should be enabled after populate');
 });

 check('typing into #pcoServiceTypeSearch sets pcoStFilter and re-narrows', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=[]; state.pcoConfig.selectedServiceTypeId=''; populateServiceTypeSelect();");
   const f=doc.getElementById('pcoServiceTypeSearch');
   f.value='youth';
   f.dispatchEvent(new window.Event('input',{bubbles:true}));
   if(ev('pcoStFilter')!=='youth') throw new Error('pcoStFilter not updated, got: '+ev('pcoStFilter'));
   const vals=optionValues(doc.getElementById('pcoServiceTypeSelect'));
   if(vals.join(',')!=='st3') throw new Error('got: '+vals.join(','));
   ev("pcoStFilter=''; document.getElementById('pcoServiceTypeSearch').value='';");
 });

 // --- Task 2: favorites picker in Advanced Settings ---
 check('renderPCOSettings renders one #stFavList checkbox row per service type', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=[]; renderPCOSettings();");
   const rows=doc.querySelectorAll('#stFavList .st-fav-cb');
   if(rows.length!==4) throw new Error('expected 4 rows, got '+rows.length);
 });

 check('checking a box adds its id to favoriteServiceTypeIds', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=[]; renderPCOSettings();");
   const cb=doc.querySelector('#stFavList .st-fav-cb[value="st2"]');
   cb.checked=true;
   cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const arr=ev('state.pcoConfig.favoriteServiceTypeIds');
   if(arr.indexOf('st2')===-1) throw new Error('st2 not added, got: '+JSON.stringify(arr));
 });

 check('unchecking a box removes its id from favoriteServiceTypeIds', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=['st2','st3']; renderPCOSettings();");
   const cb=doc.querySelector('#stFavList .st-fav-cb[value="st2"]');
   cb.checked=false;
   cb.dispatchEvent(new window.Event('change',{bubbles:true}));
   const arr=ev('state.pcoConfig.favoriteServiceTypeIds');
   if(arr.indexOf('st2')!==-1) throw new Error('st2 not removed, got: '+JSON.stringify(arr));
   if(arr.indexOf('st3')===-1) throw new Error('st3 should remain, got: '+JSON.stringify(arr));
 });

 check('#stFavSearch filters visible rows by name', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=[]; renderPCOSettings();");
   const search=doc.getElementById('stFavSearch');
   if(!search) throw new Error('missing #stFavSearch');
   search.value='youth';
   search.dispatchEvent(new window.Event('input',{bubbles:true}));
   const rows=Array.from(doc.querySelectorAll('#stFavList .st-fav-row'));
   const visible=rows.filter(r=>r.style.display!=='none');
   if(visible.length!==1) throw new Error('expected 1 visible row, got '+visible.length);
   if(!/wednesday youth/.test(visible[0].dataset.name)) throw new Error('wrong row visible: '+visible[0].dataset.name);
 });

 check('#stFavClear resets favorites to empty', ()=>{
   ev("state.pcoConfig.favoriteServiceTypeIds=['st1','st3']; renderPCOSettings();");
   const clearBtn=doc.getElementById('stFavClear');
   if(!clearBtn) throw new Error('missing #stFavClear');
   clearBtn.dispatchEvent(new window.Event('click',{bubbles:true}));
   const arr=ev('state.pcoConfig.favoriteServiceTypeIds');
   if(arr.length!==0) throw new Error('expected empty, got: '+JSON.stringify(arr));
 });

 check('renderPCOSettings shows a connect-first hint when no service types', ()=>{
   ev("pcoServiceTypes=[]; state.pcoConfig.favoriteServiceTypeIds=[]; renderPCOSettings();");
   const list=doc.getElementById('stFavList');
   if(list) throw new Error('should not render a checkbox list with no service types');
   const container=doc.getElementById('pcoSettingsContent');
   if(!/Connect to Planning Center/i.test(container.textContent)) throw new Error('missing connect-first hint');
   ev(`pcoServiceTypes=[
     {id:'st1',name:'Sunday Main',folderName:''},
     {id:'st2',name:'Sunday Student',folderName:''},
     {id:'st3',name:'Wednesday Youth',folderName:''},
     {id:'st4',name:'Sunday Kids',folderName:''}
   ];`);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
