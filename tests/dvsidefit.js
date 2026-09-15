// The BAND block clipped on the display: 6 players, only 4 visible at 1280x720, while HANDHELDS sat
// beside it half empty. The side column split its height dead even (159/159) regardless of what
// each block held — and the column had 338px against a combined need of ~276px, so the room was
// there all along, just handed out wrong.
//
// THE TRAP, and the reason the obvious fix fails: `.dv-side-block` is `container-type:size` and its
// rows are sized in `cqh` — the block's OWN height. Give a block more room and its content grows in
// step. Measured: giving BAND 225px instead of 159px still showed 4 of 6. Growing the block cannot,
// by itself, fix clipping. So there are two mechanisms, and the second is not optional:
//   1. flex-grow by row count (+ DV_SIDE_GROW_BIAS, which stops a 2-row block being starved by a
//      6-row neighbour — at pure row-proportion HANDHELDS fell to 9px text),
//   2. a fit-scale backstop that shrinks a block's rows ONLY as far as needed to stop clipping.
// Measured with both: BAND 6/6 at 11px, HANDHELDS 2/2 at 12px, nothing clipped.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const htmlPath=process.env.SA_HTML||require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
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
 ev('toast=function(){};');

 console.log('--- how the column is shared out ---');

 check('a block asks for room in proportion to what it holds', ()=>{
   const six=ev('sideBlockGrow(6)'), two=ev('sideBlockGrow(2)');
   if(!(six>two)) throw new Error('6 rows must ask for more than 2: '+six+' vs '+two);
 });

 check('the bias keeps a small block from being starved by a big neighbour', ()=>{
   // Pure row-proportion (6 vs 2) squeezed HANDHELDS to 9px text. The bias softens the ratio.
   const bias=ev('DV_SIDE_GROW_BIAS');
   if(!(bias>0)) throw new Error('no bias defined');
   const ratio=ev('sideBlockGrow(6)')/ev('sideBlockGrow(2)');
   if(!(ratio<3)) throw new Error('ratio '+ratio+' is as harsh as raw row-proportion (3)');
   if(!(ratio>1)) throw new Error('ratio '+ratio+' gives the bigger block no advantage at all');
 });

 check('an empty or absent list never asks for zero', ()=>{
   if(!(ev('sideBlockGrow(0)')>0)) throw new Error('0 rows must still be positive');
   if(!(ev('sideBlockGrow(-3)')>0)) throw new Error('negative must not go through');
 });

 console.log('--- the fit-scale backstop ---');

 check('a floor stops the text shrinking into unreadability', ()=>{
   const min=ev('DV_SIDE_MIN_SCALE');
   if(!(min>0 && min<1)) throw new Error('floor should be a fraction below 1, got '+min);
   if(min<0.5) throw new Error('floor '+min+' would let TV text become unreadable');
 });

 // The backstop is worthless if the CSS stops honouring the variable, and nothing else would catch
 // that — jsdom does no layout, so the sizes below can only be asserted against the source.
 check('every row dimension is multiplied by --dv-side-scale', ()=>{
   const want=['.dv-list-item{font-size','.dv-list-item .pos{font-size','.dv-list-item .detail{font-size','.dv-list{gap','.dv-avatar.sm{width'];
   const missing=want.filter(sel=>{
     const i=html.indexOf('.dv-side-block '+sel);
     if(i===-1) return true;
     return html.slice(i, i+320).indexOf('--dv-side-scale')===-1;
   });
   if(missing.length) throw new Error('not scaled: '+missing.join(', '));
 });

 console.log('--- it must not fight the user, or itself ---');

 check('a block the user sized by dragging is left out of the grow pass', ()=>{
   const src=ev('String(fitSideBlocks)');
   if(src.indexOf('has-explicit-height')===-1)
     throw new Error('fitSideBlocks does not check has-explicit-height — it would override a dragged height');
 });

 check('it clears its own previous work before measuring again', ()=>{
   // Same lesson as the vocalist cap: subtracting from an already-shrunk state is sticky, and the
   // block stays small after a resize back up.
   const src=ev('String(fitSideBlocks)');
   if(src.indexOf('removeProperty')===-1 || src.indexOf('--dv-side-scale')===-1)
     throw new Error('fitSideBlocks never resets --dv-side-scale, so it is sticky across resizes');
 });

 check('running it is safe when there is no display view at all', ()=>{
   ev('fitSideBlocks()');   // jsdom: no .dv-side blocks rendered — must not throw
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
