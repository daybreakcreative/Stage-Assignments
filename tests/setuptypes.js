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

 setTimeout(()=>{ console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','==='); process.exit(errs.length?1:0); },20);
},60));
