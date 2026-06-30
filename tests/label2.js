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
// the CSS rule for .sf-label, extracted from source
const cssRule=(html.match(/(?:^|\})\s*\.sf-label\s*\{([^}]*)\}/)||[])[1]||'';
window.addEventListener('load',()=>setTimeout(()=>{
 ev(`state.config.stageFeatures=[{id:"b",type:"stairs",label:"Stairs",x:490,y:130,w:150,h:80,rot:180}]`);
 ev('renderStageFeatures("#stageFeatures",{interactive:false})');
 const layer=doc.getElementById('stageFeatures');
 check('CSS .sf-label transform is a plain translate with NO rotation', ()=>{
   if(!/translate\(-50%,\s*0\)/.test(cssRule)) throw new Error('CSS transform: '+cssRule);
   if(/rotate/.test(cssRule)) throw new Error('CSS has rotate: '+cssRule);
 });
 check('no label element carries an inline rotation', ()=>{
   layer.querySelectorAll('.sf-label').forEach(l=>{ if(/rotate/.test(l.style.cssText)) throw new Error('inline rotate: '+l.style.cssText); });
 });
 check('the fixture BOX still rotates 180 (icon stays rotated)', ()=>{
   const box=[...layer.querySelectorAll('.stage-feature')].find(e=>e.dataset.fid==='b');
   if(!/rotate\(180deg\)/.test(box.style.transform)) throw new Error(box.style.transform);
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
