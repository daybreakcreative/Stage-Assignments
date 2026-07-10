// FEATURE: stage label/name overlap resolver (resolveStageLabelLayout).
// When people sit close together on the stage their name cards used to print on top of each
// other. This verifies the pure resolver de-overlaps a crowded crafted input, preserves order,
// and is actually wired into the Display + Print stage render sites.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
// Label rectangle for a resolved item L, centered horizontally on labelX, top at labelY.
function rect(L){return{x0:L.labelX-L.w/2,x1:L.labelX+L.w/2,y0:L.labelY,y1:L.labelY+L.h};}
function overlap(a,b){return !(a.x1<=b.x0||b.x1<=a.x0||a.y1<=b.y0||b.y1<=a.y0);}
function anyOverlap(layout){for(let i=0;i<layout.length;i++)for(let j=i+1;j<layout.length;j++){if(overlap(rect(layout[i]),rect(layout[j])))return[i,j];}return null;}

window.addEventListener('load',()=>setTimeout(()=>{
 check('function exists', ()=>{ if(ev('typeof resolveStageLabelLayout')!=='function') throw new Error('not a function'); });

 check('resolves overlaps on a crowded input (3 people stacked at nearly the same point)', ()=>{
   // Three markers within ~10px of each other — their default boxes fully overlap.
   const marks='[{"x":400,"y":200,"name":"Jordan Michaels","role":"VOCAL 1"},{"x":404,"y":204,"name":"Alex Rivera","role":"VOCAL 2"},{"x":398,"y":208,"name":"Sam Taylor Brown","role":"VOCAL 3"}]';
   const layout=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(${marks}, { anchor:'center', charW:8.5, lineH:11, gap:4, dotR:0 }))`));
   const bad=anyOverlap(layout);
   if(bad) throw new Error('labels still overlap at indices '+bad.join(',')+' -> '+JSON.stringify([layout[bad[0]],layout[bad[1]]]));
 });

 check('resolves a tight horizontal cluster (5 people in a narrow row)', ()=>{
   const marks='[{"x":380,"y":300,"name":"Christopher Long","role":"AG"},{"x":410,"y":300,"name":"Elizabeth Anne","role":"Keys"},{"x":440,"y":300,"name":"Benjamin","role":"Bass"},{"x":470,"y":300,"name":"Alexandra Kensington","role":"Drums"},{"x":500,"y":300,"name":"Mackenzie","role":"EG"}]';
   const layout=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(${marks}, { anchor:'center', charW:8.5, lineH:11, gap:4, dotR:0 }))`));
   const bad=anyOverlap(layout);
   if(bad) throw new Error('row still overlaps at '+bad.join(','));
 });

 check('returns items in ORIGINAL marker order', ()=>{
   const marks='[{"x":700,"y":90,"name":"Zed"},{"x":100,"y":90,"name":"Amy"},{"x":400,"y":90,"name":"Mo"}]';
   const layout=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(${marks}, {}))`));
   // fullName preserves the input name at each index even though internal packing sorts by position.
   if(layout[0].fullName!=='Zed'||layout[1].fullName!=='Amy'||layout[2].fullName!=='Mo') throw new Error('order not preserved: '+layout.map(l=>l.fullName).join(','));
 });

 check('shortens to last name to reclaim horizontal room when crowded', ()=>{
   const marks='[{"x":400,"y":200,"name":"Jonathan Livingston","role":"VOCAL 1"},{"x":405,"y":200,"name":"Kimberly Anderson","role":"VOCAL 2"}]';
   const layout=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(${marks}, { anchor:'center' }))`));
   // At least one of the crowded pair should have been shortened to its last word.
   if(!layout.some(l=>l.useLast && !/\s/.test(l.name))) throw new Error('no last-name shortening applied: '+JSON.stringify(layout.map(l=>({n:l.name,u:l.useLast}))));
 });

 check('non-overlapping input is left essentially in place (no needless nudging)', ()=>{
   const marks='[{"x":120,"y":300,"name":"A"},{"x":680,"y":300,"name":"B"}]';
   const layout=JSON.parse(ev(`JSON.stringify(resolveStageLabelLayout(${marks}, { anchor:'center', lineH:11 }))`));
   // Both centered on their dot: labelY + h/2 ≈ y (200/300). dy should be ~ -h/2 with no extra push.
   layout.forEach(L=>{ const centerY=L.labelY+L.h/2; if(Math.abs(centerY-300)>1) throw new Error('a non-crowded label got pushed: centerY='+centerY); });
 });

 // ---- wired into the live render sites ----
 // Seed a roster with several vocalists forced to the same custom position so their cards would
 // collide, then render the Display view and assert no two .dv-sp cards share a top coordinate.
 check('Display view: crowded vocalists get de-overlapped cards (distinct tops)', ()=>{
   ev(`toast=function(){};`);
   ev(`state.vocalists = [{id:'v1',name:'Jordan Michaels',isWL:true},{id:'v2',name:'Alex Rivera'},{id:'v3',name:'Sam Taylor'},{id:'v4',name:'Chris Long'}];`);
   ev(`state.assignments = ['v1','v2','v3','v4'].concat(new Array(MAX_VOCALISTS-4).fill(null));`);
   ev(`state.instruments = [];`);
   // Pin all four vocal slots to nearly the same spot so their labels would stack.
   ev(`state.config.customStageEnabled = true; state.config.customStagePositions = { vocal_0:{x:400,y:200}, vocal_1:{x:402,y:202}, vocal_2:{x:404,y:204}, vocal_3:{x:406,y:206} };`);
   ev(`state.viewMode='display'; renderDisplayView();`);
   const cards=[...doc.querySelectorAll('#dvStagePeople .dv-sp')];
   if(cards.length!==4) throw new Error('expected 4 stage cards, got '+cards.length);
   const tops=cards.map(c=>parseFloat(c.style.top));
   const uniq=new Set(tops.map(t=>t.toFixed(2)));
   if(uniq.size!==tops.length) throw new Error('cards share a top coordinate (still overlapping): '+tops.join(','));
 });

 check('Print summary: crowded roster renders one card per person without a crash', ()=>{
   ev(`fillSummaryStage();`);
   const cards=[...doc.querySelectorAll('#s_stagePeople .dv-sp')];
   if(cards.length!==4) throw new Error('expected 4 summary cards, got '+cards.length);
   const tops=cards.map(c=>parseFloat(c.style.top));
   const uniq=new Set(tops.map(t=>t.toFixed(2)));
   if(uniq.size!==tops.length) throw new Error('summary cards share a top coordinate: '+tops.join(','));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
