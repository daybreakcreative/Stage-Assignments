const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){};toast=function(){};');
 ev(`postPullState={steps:[{kind:'pref-band',personName:'Louis Vaca',instId:'inst_drums_test',instLabel:'Drums',prefKey:'louis vaca|drums'}],idx:0};`);
 check('new-on-instrument step renders a structured item list (not a free-text box)', ()=>{
   ev('renderPostPullStep()');
   if(document.querySelector('#pp_notes')) throw new Error('old free-text box still present');
   const list=document.querySelector('#pp_setup_list');
   if(!list) throw new Error('no setup-item list');
   if(document.querySelectorAll('.pp-setup-item').length!==3) throw new Error('expected 3 starter rows, got '+document.querySelectorAll('.pp-setup-item').length);
   if(!document.querySelector('#pp_setup_add')) throw new Error('no add button');
 });
 check('+ Add item appends a row; remove deletes one', ()=>{
   document.querySelector('#pp_setup_add').click();
   if(document.querySelectorAll('.pp-setup-item').length!==4) throw new Error('add did not append');
   document.querySelector('.pp-setup-rm').click();
   if(document.querySelectorAll('.pp-setup-item').length!==3) throw new Error('remove did not delete');
 });
 check('saving turns entries into real ✓ Items checklist items for that person+instrument', ()=>{
   const inputs=document.querySelectorAll('.pp-setup-item');
   inputs[0].value='Run MIDI cable for Nord';
   inputs[1].value='Tune kick mic';
   inputs[2].value='   '; // blank/whitespace ignored
   ev('savePostPullStep()');
   const key=ev(`setupKeyForBand('Louis Vaca','inst_drums_test')`);
   const items=JSON.parse(ev(`JSON.stringify((state.setupItems[${JSON.stringify(key)}]||{}).items||[])`));
   const texts=items.map(i=>i.text);
   if(!(texts.includes('Run MIDI cable for Nord')&&texts.includes('Tune kick mic'))) throw new Error('items not saved: '+JSON.stringify(texts));
   if(texts.length!==2) throw new Error('expected exactly 2 (blank ignored), got '+texts.length);
   if(!items.every(i=>i.id&&typeof i.doneThisService==='boolean')) throw new Error('item shape wrong');
 });
 check('the person is marked asked (not re-prompted next pull)', ()=>{
   if(!ev(`!!state.musicianPreferences['louis vaca|drums']`)) throw new Error('not marked asked');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
