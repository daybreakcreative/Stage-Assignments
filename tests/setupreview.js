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
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');
 console.log('--- consolidated review dialog ---');
 check('dialog lists new people with defaults pre-checked; save clears needsReview', ()=>{
   ev(`state.config.setupDefaults={ bass:{selections:{rig:'b_house'},customOptions:[]} };`);
   ev(`state.setupItems={};`);
   const k = ev(`stableSetupKey('New Guy','band','bass')`);
   ev(`seedPersonSetup('${k}','bass'); state.setupItems['${k}'].needsReview=true;`);
   ev(`openSetupReviewDialog([{name:'New Guy',role:'band',typeKey:'bass',stableKey:'${k}'}])`);
   const modal = doc.querySelector('.setup-review-modal');
   if (!modal) throw new Error('no dialog');
   const houseRadio = modal.querySelector('input[value="b_house"]');
   if (!houseRadio || !houseRadio.checked) throw new Error('default not pre-checked');
   modal.querySelector('.srv-save').click();
   if (ev(`state.setupItems['${k}'].needsReview`) !== false) throw new Error('needsReview not cleared');
   if (doc.querySelector('.setup-review-modal')) throw new Error('modal not closed after save');
 });
 check('editing a person in the dialog updates their selections + items on save', ()=>{
   ev(`state.config.setupDefaults={ keys:{selections:{source:'k_house'},customOptions:[]} };`);
   ev(`state.setupItems={};`);
   const k = ev(`stableSetupKey('Pat','band','keys')`);
   ev(`seedPersonSetup('${k}','keys'); state.setupItems['${k}'].needsReview=true;`);
   ev(`openSetupReviewDialog([{name:'Pat',role:'band',typeKey:'keys',stableKey:'${k}'}])`);
   const modal = doc.querySelector('.setup-review-modal');
   const dante = modal.querySelector('input[type=radio][value="k_dante"]');
   dante.checked = true; dante.dispatchEvent(new window.Event('change',{bubbles:true}));
   modal.querySelector('.srv-save').click();
   if (ev(`state.setupItems['${k}'].selections.source`) !== 'k_dante') throw new Error('edit not saved');
   if (!ev(`state.setupItems['${k}'].items.some(i=>i.text==='Needs network — thunderbolt adapter')`)) throw new Error('items not rebuilt');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
