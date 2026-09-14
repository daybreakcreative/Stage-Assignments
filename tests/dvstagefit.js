// At 1280x720 with a full team (8 vocalists + a 6-piece band) two names overlapped, and - found
// while chasing that - NINE of the fourteen cards were drawn OUTSIDE the stage outline entirely.
// One cause for both.
//
// The stage plot is an SVG with viewBox 0 0 800 380 and preserveAspectRatio="xMidYMid meet", so the
// SVG letterboxes ITSELF. The people layer over it is plain HTML positioned in percentages, and it
// had width:100% + max-height:100%, which SQUASHES instead of letterboxing. At 1280x720 the wrap
// was 503x131: the SVG drew its outline 276px wide while the card layer spanned the full 503, so
// cards at the edges floated off the stage.
//
// Letterboxing the layer alone makes the overlaps far WORSE (measured: 2 -> 17), because the layer
// drops to 275x131. The room has to come from somewhere: the vocalist block was eating 328px of a
// 720px screen - 46% - leaving the plot 131px. Fourteen 20px cards do not fit in 131px under any
// arrangement. Measured: cap the vocalist block at 280px -> 0 overlaps; at 240px the stage reaches
// its ceiling of 503x239 (width-bound, full 2.11 aspect) and shrinking further buys the stage
// nothing.
//
// So the rule is not a magic number: never starve the plot below the height its own width implies.
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

 console.log('--- the letterbox the card layer must match ---');

 check('a wrap FLATTER than the viewBox is limited by its height', ()=>{
   // 503x131 at 1280x720: the SVG draws 276x131 and centres it. The card layer must do the same.
   const b=JSON.parse(ev('JSON.stringify(stagePlotBox(503,131))'));
   if(Math.round(b.h)!==131) throw new Error('height should bind: '+JSON.stringify(b));
   if(Math.round(b.w)!==276) throw new Error('width should be 276, got '+JSON.stringify(b));
 });

 check('a wrap TALLER than the viewBox is limited by its width', ()=>{
   const b=JSON.parse(ev('JSON.stringify(stagePlotBox(503,400))'));
   if(Math.round(b.w)!==503) throw new Error('width should bind: '+JSON.stringify(b));
   if(Math.round(b.h)!==239) throw new Error('height should be 239, got '+JSON.stringify(b));
 });

 check('a wrap already at the viewBox aspect is untouched (the 1920 booth TV)', ()=>{
   const b=JSON.parse(ev('JSON.stringify(stagePlotBox(602,286))'));
   if(Math.round(b.w)!==602||Math.round(b.h)!==286) throw new Error(JSON.stringify(b));
 });

 check('a degenerate wrap returns nothing rather than NaN', ()=>{
   ['stagePlotBox(0,131)','stagePlotBox(503,0)','stagePlotBox(-5,-5)'].forEach(expr=>{
     const b=JSON.parse(ev('JSON.stringify('+expr+')'));
     if(b && (b.w>0||b.h>0)) throw new Error(expr+' gave '+JSON.stringify(b));
   });
 });

 console.log('--- how much room the plot is owed ---');

 check('a plot at or above its aspect height is owed nothing', ()=>{
   if(ev('stageHeightDeficit(503,239)')!==0) throw new Error('503x239 is exactly right');
   if(ev('stageHeightDeficit(503,400)')!==0) throw new Error('a tall plot is not starved');
   if(ev('stageHeightDeficit(602,286)')!==0) throw new Error('the 1920 layout must be a no-op');
 });

 check('a crushed plot is owed the difference', ()=>{
   // 503 wide implies 239 tall; it has 131.
   const d=ev('stageHeightDeficit(503,131)');
   if(Math.round(d)!==108) throw new Error('expected 108, got '+d);
 });

 check('a degenerate wrap is owed nothing', ()=>{
   if(ev('stageHeightDeficit(0,0)')!==0) throw new Error('0x0');
   if(ev('stageHeightDeficit(503,-1)')!==0) throw new Error('negative height');
 });

 console.log('--- what the vocalist block gives up ---');

 check('the block gives up exactly the deficit', ()=>{
   if(ev('cappedVocalsHeight(328,108)')!==220) throw new Error('328-108 should be 220, got '+ev('cappedVocalsHeight(328,108)'));
 });

 check('it never shrinks past the floor, however starved the stage', ()=>{
   const floor=ev('DV_VOCALS_MIN_H');
   if(!(floor>0)) throw new Error('no floor defined');
   if(ev('cappedVocalsHeight(328,9999)')!==floor) throw new Error('should clamp to '+floor);
   // and a block already at/below the floor is left alone
   if(ev(`cappedVocalsHeight(${floor},50)`)!==floor) throw new Error('must not go below the floor');
 });

 check('no deficit means no change — the block keeps its natural height', ()=>{
   if(ev('cappedVocalsHeight(328,0)')!==328) throw new Error('should be untouched');
   if(ev('cappedVocalsHeight(328,-20)')!==328) throw new Error('a negative deficit must not grow it');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},400));
