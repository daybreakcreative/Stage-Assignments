// Aurora is the only look now ("the new classic"): always applied via [data-look="aurora"].
// 2026-07-09: the color mood is LOCKED to "platinum" — the mood picker was removed from both
// Settings→Display and the wizard (intentional behavior change). data-mood is always "platinum"
// regardless of state.auroraMood; the only user color choice left is dark/light (independent axis).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 const html=doc.documentElement;

 check('defaults: look=aurora (applied), theme=dark, mood LOCKED to platinum', ()=>{
   if(ev('state.look')!=='aurora') throw new Error('look default not aurora: '+ev('state.look'));
   if(ev('state.auroraMood')!=='platinum') throw new Error('mood default not platinum: '+ev('state.auroraMood'));
   if(html.getAttribute('data-look')!=='aurora') throw new Error('data-look not aurora on <html>');
   if(html.getAttribute('data-mood')!=='platinum') throw new Error('data-mood not platinum');
 });

 check('applyLook is unconditional — migrates a legacy look:"classic" save to aurora', ()=>{
   ev('state.look="classic"; applyLook()');
   if(html.getAttribute('data-look')!=='aurora') throw new Error('classic save not migrated to aurora');
   if(ev('state.look')!=='aurora') throw new Error('state.look not forced to aurora');
 });

 check('mood is LOCKED: applyLook always yields platinum regardless of state.auroraMood', ()=>{
   // Mood picker removed 2026-07-09. Even if a legacy save carries another mood, applyLook
   // forces data-mood=platinum. (setMood is retained as harmless dead machinery.)
   ev('state.auroraMood="dusk"; applyLook()');
   if(html.getAttribute('data-mood')!=='platinum') throw new Error('data-mood not forced to platinum: '+html.getAttribute('data-mood'));
   ev('state.auroraMood="frost"; applyLook()');
   if(html.getAttribute('data-mood')!=='platinum') throw new Error('data-mood not forced to platinum for frost');
   ev('state.auroraMood="platinum"'); // restore default
 });

 check('dark/light axis stays independent of aurora', ()=>{
   ev('setTheme("light")');
   if(html.getAttribute('data-theme')!=='light') throw new Error('theme axis broke');
   if(html.getAttribute('data-look')!=='aurora') throw new Error('look lost on theme change');
   ev('setTheme("dark")');
 });

 check('settings has NO mood picker and no Classic/Aurora look buttons (color choice removed)', ()=>{
   ev('renderLayoutEditor()');
   // Mood picker removed 2026-07-09 — Settings→Display no longer offers a color choice.
   if(doc.querySelector('.mood-picker [data-mood-opt]')) throw new Error('mood swatches should be gone from Settings');
   if(doc.querySelector('[data-look-opt]')) throw new Error('Classic/Aurora look buttons should be gone');
 });

 check('wizard look step has NO mood swatches but KEEPS the dark/light toggle', ()=>{
   ev('startWizard(); wizardStepIdx=WIZARD_STEPS.indexOf("look"); renderWizardStep();');
   // Mood picker removed 2026-07-09; only the dark/light mode toggle remains in the look step.
   if(doc.querySelector('.mood-picker [data-mood-opt]')) throw new Error('wizard look step should have no mood swatches');
   if(!doc.querySelector('[data-wtheme]')) throw new Error('wizard look step missing dark/light toggle');
 });

 check('aurora clears the brand inline vars so its stylesheet tokens win', ()=>{
   ev('document.documentElement.style.setProperty("--accent","#d4a147")');
   ev("document.documentElement.style.setProperty('--ff-display', \"'Fraunces', Georgia, serif\")");
   ev('applyLook()');
   if(ev('document.documentElement.style.getPropertyValue("--accent")')) throw new Error('aurora must clear inline --accent');
   if(ev('document.documentElement.style.getPropertyValue("--ff-display")')) throw new Error('aurora must clear inline --ff-display');
   if(ev('document.documentElement.style.getPropertyValue("--wl")')!=='var(--c2)') throw new Error('aurora should set --wl to var(--c2)');
 });

 check('applyBrand is a no-op while Aurora is active (no clobber)', ()=>{
   ev('state.brand={accent:"#d4a147"}; applyBrand()');
   if(ev('document.documentElement.style.getPropertyValue("--accent")')) throw new Error('applyBrand must not set --accent under aurora');
   ev('state.brand={}');
 });

 check('display view carries the aurora drift background (dialed in)', ()=>{
   const css=ev('document.querySelector("style").textContent');
   if(!/\[data-look="aurora"\][^{]*\.display-view/.test(css)) throw new Error('aurora background not extended to .display-view');
 });

 check('print stylesheet is not scoped to a look (prints plain regardless)', ()=>{
   const css=ev('document.querySelector("style").textContent');
   const printIdx=css.indexOf('@media print');
   if(printIdx<0) throw new Error('no @media print block');
   if(/data-look/.test(css.slice(printIdx))) throw new Error('print block must not depend on look');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
