const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const tpl0=()=>ev('JSON.parse(JSON.stringify(state.setupTemplates[0]))');
const items=key=>ev(`(state.setupItems[${JSON.stringify(key)}]||{items:[]}).items.map(i=>i.text)`);
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderSetupItemsView=function(){}');     // isolate from the items-view DOM render
 ev('state.setupTemplates=[]; state.setupItems={}');

 check('save captures clean text only (blanks + duplicates dropped)', ()=>{
   ev(`state.setupItems["mo|vocal"]={items:[{id:"a",text:"Mic stand"},{id:"b",text:"  "},{id:"c",text:"mic stand"},{id:"d",text:"DI box"}]}`);
   ev('saveCurrentItemsAsTemplate("mo|vocal","Mo default","vocal")');
   const it=tpl0().items;
   if(JSON.stringify(it)!==JSON.stringify(["Mic stand","DI box"])) throw new Error('saved items: '+JSON.stringify(it));
   if((tpl0().usage||{}).vocal!==1) throw new Error('usage not tagged');
 });
 check('apply drops the template items onto an empty person card', ()=>{
   const id=tpl0().id;
   ev(`applyTemplateToPerson(${JSON.stringify(id)},"ned|vocal","vocal")`);
   if(JSON.stringify(items("ned|vocal"))!==JSON.stringify(["Mic stand","DI box"])) throw new Error('after apply: '+JSON.stringify(items("ned|vocal")));
 });
 check('applying the SAME template again adds nothing (no duplicates)', ()=>{
   const id=tpl0().id;
   ev(`applyTemplateToPerson(${JSON.stringify(id)},"ned|vocal","vocal")`);
   const it=items("ned|vocal");
   if(it.length!==2) throw new Error('expected 2 items, got '+it.length+': '+JSON.stringify(it));
 });
 check('applying an overlapping template only adds the new items', ()=>{
   ev(`state.setupTemplates.push({id:"tpl_two",name:"Stereo rig",items:["DI box","2nd DI","Stereo pair"],usage:{}})`);
   ev(`applyTemplateToPerson("tpl_two","ned|vocal","vocal")`);
   const it=items("ned|vocal");
   if(JSON.stringify(it)!==JSON.stringify(["Mic stand","DI box","2nd DI","Stereo pair"])) throw new Error('after overlap apply: '+JSON.stringify(it));
 });
 check('apply still bumps usage even when items are deduped', ()=>{
   const id=tpl0().id; const before=(tpl0().usage||{}).vocal||0;
   ev(`applyTemplateToPerson(${JSON.stringify(id)},"ned|vocal","vocal")`);  // all dupes
   const after=(tpl0().usage||{}).vocal||0;
   if(after!==before+1) throw new Error('usage not bumped: '+before+'->'+after);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
