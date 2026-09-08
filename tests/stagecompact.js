// At 1280x720 the stage box is ~373x177 CSS px. A .dv-sp card cannot shrink past its CSS floors
// (min-width:72px, and the clamp() lower bounds on the role/name font sizes), so each card measures
// ~70 of the 380 stage units tall. Eight of those do not fit in 380 units under ANY arrangement --
// the resolver was being handed impossible geometry and two pairs of names printed on top of each
// other. The display now detects the leftover overlap and drops to a compact card (name only,
// tighter padding), which halves card height and makes the layout solvable.
//
// This covers the PURE half: the leftover-overlap detector. The compact retry itself needs real
// browser layout (it is gated on `measurable`, which is deliberately false under jsdom's stubbed
// rects), so it is verified in the browser, not here.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 // Use the display's OWN card metrics -- the resolver's bare defaults are far smaller than a real
 // .dv-sp card, so with them the geometry looks solvable and the bug never reproduces.
 ev('window.DM = stageLabelMetrics();');
 console.log('  metrics:', ev('JSON.stringify(DM)'));

 console.log('--- leftover-overlap detector ---');

 check('a clean layout reports zero overlaps', ()=>{
   const n=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,  w:80,h:30,anchor:'center'},
     {labelX:400,labelY:0,  w:80,h:30,anchor:'center'},
     {labelX:100,labelY:200,w:80,h:30,anchor:'center'}])`);
   if(n!==0) throw new Error('expected 0, got '+n);
 });

 check('two boxes sharing x and y are counted once', ()=>{
   const n=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0, w:80,h:30,anchor:'center'},
     {labelX:120,labelY:10,w:80,h:30,anchor:'center'}])`);
   if(n!==1) throw new Error('expected 1, got '+n);
 });

 check('boxes that only share x, or only share y, do not count', ()=>{
   const sameX=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,  w:80,h:30,anchor:'center'},
     {labelX:100,labelY:200,w:80,h:30,anchor:'center'}])`);
   if(sameX!==0) throw new Error('same column, far apart vertically: expected 0, got '+sameX);
   const sameY=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,w:80,h:30,anchor:'center'},
     {labelX:600,labelY:0,w:80,h:30,anchor:'center'}])`);
   if(sameY!==0) throw new Error('same row, far apart horizontally: expected 0, got '+sameY);
 });

 // The whole reason the earlier fix missed real collisions: an edge-anchored card sits entirely to
 // one side of its point, not centred on it. The detector has to use the same rule the renderer does.
 check('anchor is respected, not assumed to be centre', ()=>{
   // Two cards whose POINTS are 90 apart. Centred, their 80-wide boxes would overlap.
   const centred=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,w:100,h:30,anchor:'center'},
     {labelX:190,labelY:0,w:100,h:30,anchor:'center'}])`);
   if(centred!==1) throw new Error('centred pair should overlap, got '+centred);
   // Same points, but the left one grows right and the right one grows left -> they separate.
   const anchored=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,w:100,h:30,anchor:'right'},
     {labelX:190,labelY:0,w:100,h:30,anchor:'left'}])`);
   if(anchored!==0) throw new Error('anchored apart should not overlap, got '+anchored);
 });

 check('counts every colliding pair, not just the first', ()=>{
   const n=ev(`stageLayoutOverlapCount([
     {labelX:100,labelY:0,w:80,h:30,anchor:'center'},
     {labelX:110,labelY:5,w:80,h:30,anchor:'center'},
     {labelX:500,labelY:0,w:80,h:30,anchor:'center'},
     {labelX:510,labelY:5,w:80,h:30,anchor:'center'}])`);
   if(n!==2) throw new Error('expected 2, got '+n);
 });

 console.log('--- the resolver hands the detector what it needs ---');

 check('resolved layout entries carry their anchor through', ()=>{
   const out=ev(`JSON.stringify(resolveStageLabelLayout(
     [{x:40,y:100,name:'Simon Mugarami',role:'DRUMS',anchor:'left'},
      {x:760,y:100,name:'Mo Maldonado',role:'KEYS',anchor:'right'}],
     {anchor:'center',dotR:0}).map(r=>r.anchor))`);
   if(JSON.parse(out).join(',')!=='left,right') throw new Error('anchors lost: '+out);
 });

 // Shortening a name does NOT shrink the card past its CSS min-width. The resolver used to
 // recompute the shortened width from character count -- "Mo Maldonado" -> "Mo" -> 28 units -- while
 // the real card stayed 154 units wide because of min-width:72px. It then declared the layout clean
 // and two pairs of names printed on top of each other at 1280x720. Both overlapping pairs were
 // exactly the two cards it had shortened. Measured callers pass the observed floor as opts.minW.
 check('a shortened card never claims to be narrower than the measured floor', ()=>{
   const out=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(
     [[90,330,'Simon Mugarami','Drums','left',182],[297,314,'Abraham Mata','Bass','center',164],
      [503,314,'Jack Grubbs','EG 1','center',154],[710,330,'Mo Maldonado','Keys','right',166],
      [685,141,'Libby McDonald','VOCAL 1','right',175],[495,89,'Caleb Quirino','VOCAL 2','center',157],
      [305,89,'Grayson Kredit','VOCAL 3','center',167],[115,141,'Ella Graves','VOCAL 4','left',154]]
      .map(function(r){return {x:r[0],y:r[1],name:r[2],role:r[3],anchor:r[4],wUnits:r[5],hUnits:70}}),
     {anchor:'center',dotR:0,minW:154,charW:DM.charW,lineH:DM.lineH,gap:DM.gap}).map(r=>({n:r.name,w:r.w})))`));
   const short=out.filter(r=>r.n.indexOf(' ')===-1);
   if(!short.length) throw new Error('expected the resolver to shorten at least one name here');
   short.forEach(r=>{ if(r.w<154) throw new Error(r.n+' claims w='+r.w+', below the 154 floor'); });
 });

 // The real 1280x720 case, in the numbers measured from the live browser: the stage box is 373x177
 // CSS px, every card measures 70.4 of the 380 stage units tall, and the narrowest card is 154 units
 // (its min-width floor). Eight of those cannot be arranged cleanly -- which is the signal the
 // display uses to go compact. Halving the card height makes the same set solvable.
 check('the measured 1280x720 geometry is unsolvable; compact cards resolve it', ()=>{
   const marks=(h)=>`[[90,330,'Simon Mugarami','Drums','left',182],[297,314,'Abraham Mata','Bass','center',164],
     [503,314,'Jack Grubbs','EG 1','center',154],[710,330,'Mo Maldonado','Keys','right',166],
     [685,141,'Libby McDonald','VOCAL 1','right',175],[495,89,'Caleb Quirino','VOCAL 2','center',157],
     [305,89,'Grayson Kredit','VOCAL 3','center',167],[115,141,'Ella Graves','VOCAL 4','left',154]]
     .map(function(r){return {x:r[0],y:r[1],name:r[2],role:r[3],anchor:r[4],wUnits:r[5],hUnits:${h}}})`;
   const run=(h)=>ev(`stageLayoutOverlapCount(resolveStageLabelLayout(${marks(h)},{anchor:'center',dotR:0,minW:154,charW:DM.charW,lineH:DM.lineH,gap:DM.gap}))`);
   const tall=run(70);
   if(tall===0) throw new Error('70-unit cards should NOT fit -- this is the bug that shipped');
   const compact=run(32);
   if(compact!==0) throw new Error('compact cards should resolve cleanly, got '+compact);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
