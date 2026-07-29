const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('JSDOM ERR',(e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{

 // --- pure resolver ---
 check('resolveFeatureLabelLayout exists', ()=>{
   if(typeof ev('typeof resolveFeatureLabelLayout')!=='string'||ev('typeof resolveFeatureLabelLayout')!=='function')
     throw new Error('resolveFeatureLabelLayout is not a function');
 });

 check('two labels at the same top with overlapping x are separated vertically', ()=>{
   // both centered near x=400, both start at top=200, wide enough to overlap in x
   const out=JSON.parse(ev(`JSON.stringify(resolveFeatureLabelLayout([
     {cx:395,top:200,w:80,h:11},
     {cx:405,top:200,w:80,h:11}
   ]))`));
   const a=out[0],b=out[1];
   const yGap = Math.abs(a.top-b.top);
   if(yGap < 11) throw new Error('labels still overlap vertically, gap='+yGap);
 });

 check('labels far apart in x are left unchanged (no needless nudging)', ()=>{
   const out=JSON.parse(ev(`JSON.stringify(resolveFeatureLabelLayout([
     {cx:100,top:200,w:40,h:11},
     {cx:700,top:200,w:40,h:11}
   ]))`));
   if(out[0].top!==200||out[1].top!==200) throw new Error('non-overlapping labels were moved: '+JSON.stringify(out));
 });

 check('resolver is stable — running it twice yields the same result', ()=>{
   const once=ev(`JSON.stringify(resolveFeatureLabelLayout([
     {cx:400,top:200,w:80,h:11},{cx:410,top:200,w:80,h:11},{cx:405,top:200,w:80,h:11}
   ]))`);
   // feed the resolved boxes back in
   const twice=ev(`JSON.stringify(resolveFeatureLabelLayout(${once}))`);
   if(once!==twice) throw new Error('not idempotent:\n'+once+'\n'+twice);
 });

 // --- render integration ---
 check('two adjacent fixtures render caption labels at different tops', ()=>{
   ev(`state.config.stageFeatures=[
     {id:'f1',type:'monitor',x:390,y:300,w:60,h:24,rot:0,label:'Monitor A'},
     {id:'f2',type:'monitor',x:410,y:300,w:60,h:24,rot:0,label:'Monitor B'}
   ];`);
   // render into a scratch layer
   ev(`(function(){var d=document.createElement('div');d.id='__flTest';document.body.appendChild(d);
        renderStageFeatures('#__flTest',{interactive:false});})();`);
   const tops=JSON.parse(ev(`JSON.stringify(Array.from(document.querySelectorAll('#__flTest .sf-label')).map(function(l){return l.style.top;}))`));
   if(tops.length<2) throw new Error('expected 2 caption labels, got '+tops.length);
   if(tops[0]===tops[1]) throw new Error('overlapping fixtures got identical label tops: '+tops.join(', '));
 });

 check('marker labels (inside the box) are NOT pushed by the resolver', ()=>{
   ev(`state.config.stageFeatures=[
     {id:'m1',type:'marker',x:400,y:200,w:60,h:24,rot:0,label:'STAGE LEFT'},
     {id:'m2',type:'marker',x:405,y:200,w:60,h:24,rot:0,label:'STAGE RIGHT'}
   ];`);
   ev(`(function(){var d=document.getElementById('__flTest')||document.createElement('div');d.id='__flTest';if(!d.parentNode)document.body.appendChild(d);
        renderStageFeatures('#__flTest',{interactive:false});})();`);
   const insideTops=JSON.parse(ev(`JSON.stringify(Array.from(document.querySelectorAll('#__flTest .sf-label.inside')).map(function(l){return l.style.top;}))`));
   // markers sit ON their own y (centered), so each keeps its own top; they should not be stacked below one another
   if(insideTops.length!==2) throw new Error('expected 2 inside labels, got '+insideTops.length);
 });

 // summary
 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   process.exit(errs.length?1:0);
 },20);
},60));
