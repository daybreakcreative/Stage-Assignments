// Cleanup: the Brand settings tab was retired (Aurora owns colors + fonts, so its presets,
// color pickers, and font dropdown were all inert). The one still-useful control — Display
// Name Format — was folded into the Display tab. This asserts the tab is gone, the picker
// moved, still works, and the dead render functions are removed.
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
 ev('toast=function(){}; saveState=function(){}; renderDisplayView=function(){};');

 check('Brand settings tab button + panel are gone (folded into Display)', ()=>{
   if(doc.querySelector('[data-tab="brand"]')) throw new Error('Brand tab button still present');
   if(doc.getElementById('tab-brand')) throw new Error('#tab-brand panel still present');
   if(doc.getElementById('brandEdit')) throw new Error('#brandEdit container still present');
 });

 check('the dead render functions are removed', ()=>{
   if(ev('typeof renderBrandEditor')!=='undefined') throw new Error('renderBrandEditor still defined');
   if(ev('typeof renderFontPicker')!=='undefined') throw new Error('renderFontPicker still defined');
 });

 check('Display tab renders the Name Format picker (4 options)', ()=>{
   ev('renderLayoutEditor()');
   const cards=doc.querySelectorAll('#layoutEdit [data-name-fmt]');
   if(cards.length!==4) throw new Error('expected 4 name-fmt cards in the Display tab, got '+cards.length);
 });

 check('clicking a Name Format option updates state.config.displayNameFormat + active state', ()=>{
   const first=doc.querySelector('#layoutEdit [data-name-fmt="first"]');
   if(!first) throw new Error('no "first" name-fmt card');
   first.click();
   if(ev("state.config.displayNameFormat")!=='first') throw new Error('displayNameFormat not set to "first"');
   if(!first.classList.contains('active')) throw new Error('clicked card not marked active');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
