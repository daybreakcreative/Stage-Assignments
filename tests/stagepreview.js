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
function captionShown(){ const cc=document.querySelector('.curvature-controls'); return !!cc && /These sliders are paused/.test(cc.innerHTML); }
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};');
 ev('buildCustomOutlinePreviewSvg=function(){return "<svg data-kind=\\"custom\\"></svg>";};');
 ev('buildStagePreviewSvg=function(){return "<svg data-kind=\\"slider\\"></svg>";};');
 ev(`startWizard(); wizardData.customStagePoints=[{x:100,y:300},{x:700,y:300},{x:700,y:120},{x:400,y:60},{x:100,y:120}]; wizardStepIdx=WIZARD_STEPS.indexOf('stage'); renderWizardStep();`);
 check('custom active → wizard preview shows the custom outline', ()=>{
   const p=document.querySelector('#wiz_curv_preview'); if(!p||!/data-kind="custom"/.test(p.innerHTML)) throw new Error('not custom');
 });
 check('custom active → "sliders paused" caption shown', ()=>{ if(!captionShown()) throw new Error('no caption'); });
 check('moving a slider while custom active keeps the custom preview', ()=>{
   const s=document.querySelector('#wiz_curv_slider'); if(s){ s.value=20; s.dispatchEvent(new window.Event('input',{bubbles:true})); }
   const p=document.querySelector('#wiz_curv_preview'); if(!/data-kind="custom"/.test(p.innerHTML)) throw new Error('slider overrode custom');
 });
 ev(`wizardData.customStagePoints=null; renderWizardStep();`);
 check('no custom → wizard preview shows the slider shape, no caption', ()=>{
   const p=document.querySelector('#wiz_curv_preview'); if(!/data-kind="slider"/.test(p.innerHTML)) throw new Error('not slider');
   if(captionShown()) throw new Error('caption shown when it should not be');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
