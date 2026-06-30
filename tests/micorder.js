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
function fire(el,type){ const ev2=new window.Event(type,{bubbles:true,cancelable:true}); ev2.dataTransfer={effectAllowed:'',setData(){},getData(){}}; Object.defineProperty(ev2,'target',{value:el,configurable:true}); el.dispatchEvent(ev2); }
window.addEventListener('load',()=>setTimeout(()=>{
 ev('renderAll=function(){};toast=function(){};');
 // ---- Advanced Settings inventory reorder ----
 ev(`state.inventory=[{name:'A',total:1,rank:1,wireless:true},{name:'B',total:1,rank:2,wireless:true},{name:'C',total:1,rank:3,wireless:true},{name:'D',total:1,rank:4,wireless:true}];`);
 ev('renderInvEditor()');
 check('AS inventory rows are draggable with a grip', ()=>{
   const rows=document.querySelectorAll('#invEdit .inv-edit-row');
   if(rows.length!==4) throw new Error('rows='+rows.length);
   if(!rows[0].draggable) throw new Error('not draggable');
   if(document.querySelectorAll('#invEdit .inv-grip').length!==4) throw new Error('no grips');
 });
 check('AS: dragging row 0 onto row 2 reorders + re-ranks (A→position 3)', ()=>{
   const rows=document.querySelectorAll('#invEdit .inv-edit-row');
   fire(rows[0],'dragstart'); fire(rows[2],'dragover'); fire(rows[2],'drop');
   const order=JSON.parse(ev('JSON.stringify(state.inventory.map(m=>m.name))'));
   if(order.join('')!=='BCAD') throw new Error('order='+order.join(''));
   const ranks=JSON.parse(ev('JSON.stringify(state.inventory.map(m=>m.rank))'));
   if(ranks.join('')!=='1234') throw new Error('ranks not resequenced: '+ranks.join(''));
 });
 check('AS: dragstart from an input is ignored (lets you edit the name)', ()=>{
   ev('renderInvEditor()');
   const inp=document.querySelector('#invEdit .inv-edit-row input');
   const before=ev('JSON.stringify(state.inventory.map(m=>m.name))');
   fire(inp,'dragstart'); // target is input → guard preventDefault, no drag begins
   const rows=document.querySelectorAll('#invEdit .inv-edit-row');
   fire(rows[2],'drop'); // nothing should move (dragFrom never set)
   if(ev('JSON.stringify(state.inventory.map(m=>m.name))')!==before) throw new Error('input drag wrongly reordered');
 });
 // ---- Wizard mics step ----
 ev(`startWizard(); wizardData.mics=[{name:'M1',total:1,wireless:true},{name:'M2',total:1,wireless:true},{name:'M3',total:1,wireless:true}]; wizardStepIdx=WIZARD_STEPS.indexOf('mics'); renderWizardStep();`);
 check('wizard mic cards render draggable, with grips + a priority hint', ()=>{
   const cards=document.querySelectorAll('.wiz-mic-card');
   if(cards.length!==3) throw new Error('cards='+cards.length);
   if(!cards[0].draggable) throw new Error('card not draggable');
   if(document.querySelectorAll('.wmic-grip').length!==3) throw new Error('no grips');
   if(!/first choice/i.test(document.querySelector('#wizardBody, .wizard-body, body').innerHTML)) throw new Error('no priority hint text');
 });
 check('wizard: dragging mic 1 onto mic 3 reorders wizardData.mics', ()=>{
   const cards=document.querySelectorAll('.wiz-mic-card');
   fire(cards[0],'dragstart'); fire(cards[2],'dragover'); fire(cards[2],'drop');
   const order=JSON.parse(ev('JSON.stringify(wizardData.mics.map(m=>m.name))'));
   if(order.join('')!=='M2M3M1') throw new Error('order='+order.join(''));
 });
 check('priority order still flows into applyWizardChoices as rank 1..n', ()=>{
   ev('state.vocalists=[]; applyWizardChoices();');
   const inv=JSON.parse(ev('JSON.stringify(state.inventory.map(m=>({n:m.name,r:m.rank})))'));
   // first mic in the (reordered) wizard list should be rank 1
   if(inv[0].r!==1) throw new Error('rank not 1-based: '+JSON.stringify(inv));
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
