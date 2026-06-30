const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev(`
   state.vocalists=[{id:'v1',name:'Grayson Kredit',isWL:true,micAssigned:'KMS105'},{id:'v2',name:'Ella Vox',isWL:false,micAssigned:'QLXD'}];
   var a=new Array(MAX_VOCALISTS).fill(null); a[0]='v1'; a[1]='v2'; state.assignments=a;
   if(state.instruments&&state.instruments.length){ state.instruments[0].assignedTo='Danny Barragan'; state.instruments[0].vocalistPlayer=null; }
   state.serviceOrder=[];
 `);

 check('fillSummary() runs and places markers for vocalists + band in #s_stagePeople', ()=>{
   ev('fillSummary()');
   const people=doc.getElementById('s_stagePeople');
   if(!people) throw new Error('#s_stagePeople missing');
   const markers=people.querySelectorAll('.dv-sp');
   if(markers.length < 3) throw new Error('expected >=3 markers (2 vox + 1 band), got '+markers.length);
   const txt=people.textContent;
   if(!/Grayson/.test(txt)) throw new Error('WL vocalist not rendered');
   if(!/Danny/.test(txt)) throw new Error('band member not rendered');
 });
 check('WL vocalist marker carries the is-wl class', ()=>{
   const wl=doc.querySelectorAll('#s_stagePeople .dv-sp.is-wl');
   if(wl.length !== 1) throw new Error('expected exactly 1 is-wl marker, got '+wl.length);
 });
 check('stage fixtures render into #s_stageFeatures (non-interactive)', ()=>{
   ev('ensureStageFeatures().length=0; addStageFeature("wedge")');
   ev('fillSummary()');
   const feats=doc.getElementById('s_stageFeatures').querySelectorAll('.stage-feature');
   if(feats.length !== 1) throw new Error('expected 1 fixture, got '+feats.length);
   // non-interactive => no delete/resize handles
   if(doc.querySelector('#s_stageFeatures .feat-del')) throw new Error('interactive handles leaked into print summary');
 });
 check('summary stage outline path is populated by renderStageShape', ()=>{
   const p=doc.querySelector('.s-stage-frame > svg.dv-stage-svg path');
   if(!p || !p.getAttribute('d') || p.getAttribute('d').indexOf('M')<0) throw new Error('stage path not drawn');
 });
 check('empty roster: no markers, no crash', ()=>{
   ev('state.vocalists=[]; state.assignments=new Array(MAX_VOCALISTS).fill(null); state.instruments.forEach(i=>{i.assignedTo="";i.vocalistPlayer=null;});');
   ev('fillSummary()');
   const markers=doc.getElementById('s_stagePeople').querySelectorAll('.dv-sp');
   if(markers.length !== 0) throw new Error('expected 0 markers on empty roster, got '+markers.length);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
