const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
const css=Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('\n');
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 // (1) Duplicate
 check('duplicateStageFeature clones with a new id, offset, same type/label/size/rot', ()=>{
   ev(`state.config.stageFeatures=[]; window.__src={id:'s1',type:'wedge',label:'Drum mon',x:400,y:232,w:78,h:50,rot:45};`);
   const r=JSON.parse(ev('JSON.stringify(duplicateStageFeature(window.__src))'));
   if(r.id==='s1'||!/^feat_/.test(r.id)) throw new Error('id not fresh');
   if(r.type!=='wedge'||r.label!=='Drum mon'||r.w!==78||r.h!==50||r.rot!==45) throw new Error('props not preserved');
   if(r.x!==428||r.y!==260) throw new Error('not offset by 28');
   if(JSON.parse(ev('JSON.stringify(state.config.stageFeatures)')).length!==1) throw new Error('clone not pushed');
 });
 check('duplicate offset clamps so it stays on the canvas', ()=>{
   const r=JSON.parse(ev(`JSON.stringify(duplicateStageFeature({id:'x',type:'power',label:'DI',x:800,y:380,w:44,h:44,rot:0}))`));
   if(r.x>770||r.y>360) throw new Error('offset not clamped');
 });
 // (3) Marker
 check('marker fixture has the clearer palette name "Text label"', ()=>{
   const n=ev(`getFeatureDef('marker').name||''`);
   if(n!=='Text label') throw new Error('marker name = '+n);
 });
 check('marker label renders INSIDE the box; non-marker captions below', ()=>{
   ev(`state.config.stageFeatures=[{id:'m1',type:'marker',label:'DJ Booth',x:400,y:200,w:96,h:52,rot:0}];
       var L=document.createElement('div'); L.id='__tl'; document.body.appendChild(L); renderStageFeatures(L,{interactive:false});`);
   const mc=ev(`(document.querySelector('#__tl .sf-label')||{}).className||''`);
   if(!/\binside\b/.test(mc)) throw new Error('marker label not inside: '+mc);
   ev(`state.config.stageFeatures=[{id:'w1',type:'wedge',label:'Drum mon',x:400,y:200,w:78,h:50,rot:0}];
       var L2=document.getElementById('__tl'); renderStageFeatures(L2,{interactive:false});`);
   const wc=ev(`(document.querySelector('#__tl .sf-label')||{}).className||''`);
   if(/\binside\b/.test(wc)) throw new Error('wedge label should NOT be inside: '+wc);
 });
 check('inside-label CSS variant exists', ()=>{
   if(!/\.sf-label\.inside\s*\{\s*transform:translate\(-50%,-50%\)/.test(css)) throw new Error('no .sf-label.inside rule');
 });
 // (2) Orientation note
 check('stage editors carry the "as the band sees it" caption', ()=>{
   if(!/as the band sees it/.test(html)) throw new Error('caption missing');
   const n=(html.match(/SL = stage left/g)||[]).length;
   if(n<2) throw new Error('caption not in both editors (found '+n+')');
 });
 // (4) PCO friendly errors
 check('pcoFriendlyAuthError maps known codes to actionable text', ()=>{
   const redir=ev(`pcoFriendlyAuthError('redirect_uri_mismatch','')`);
   if(!/Redirect URI/.test(redir)) throw new Error('redirect msg');
   const inv=ev(`pcoFriendlyAuthError('invalid_client','')`);
   if(!/Client ID\/Secret/.test(inv)) throw new Error('invalid_client msg');
   const den=ev(`pcoFriendlyAuthError('access_denied','')`);
   if(!/declined/.test(den)) throw new Error('access_denied msg');
   const scope=ev(`pcoFriendlyAuthError('invalid_scope','')`);
   if(!/services.*people|people.*services/.test(scope)) throw new Error('scope msg');
   const grant=ev(`pcoFriendlyAuthError('invalid_grant','')`);
   if(!/expired/.test(grant)) throw new Error('grant msg');
   const unk=ev(`pcoFriendlyAuthError('weird_thing','some detail')`);
   if(!/weird_thing/.test(unk)||!/some detail/.test(unk)) throw new Error('fallback msg');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
