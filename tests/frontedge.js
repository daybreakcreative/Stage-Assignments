// FEATURE: front-of-stage edge selector (state.config.stageFrontEdge).
// Verifies the shape-math helpers, the loadState round-trip, and that vocalists spread ALONG the
// chosen front edge (the peaked-outline overlap bug) rather than being crammed on the auto peak.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function pdown(el,x,y){const e=new window.PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerId:1});Object.defineProperty(e,'target',{value:el});el.dispatchEvent(e);}
window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 // A 5-point "house" shape: flat bottom, two side walls, peaked top (two slanted roof edges).
 // Corners: 0 (20,300) SR-ish bottom, 1 (780,300) SL-ish bottom, 2 (780,150) right wall top,
 //          3 (400,40) roof PEAK, 4 (20,150) left wall top.
 // Edges: e0 bottom(300), e1 right wall, e2 right roof, e3 left roof, e4 left wall.
 const HOUSE='[{"x":20,"y":300},{"x":780,"y":300},{"x":780,"y":150},{"x":400,"y":40},{"x":20,"y":150}]';

 check('autoFrontEdgeIndex picks the min-midpoint-Y edge (a roof edge, not the flat bottom)', ()=>{
   const fi=ev(`autoFrontEdgeIndex(${HOUSE})`);
   // Roof edges e2 (mid y=95) and e3 (mid y=95) tie for smallest; the bottom edge e0 (mid y=300)
   // must NOT be chosen. Accept either roof edge (whichever the tie-break lands on: first wins → e2).
   if(fi!==2 && fi!==3) throw new Error('auto front should be a roof edge (2 or 3), got '+fi);
 });

 check('resolveFrontEdgeIndex honors a valid state.config.stageFrontEdge', ()=>{
   ev('state.config.stageFrontEdge=0');           // choose the flat BOTTOM edge as front
   const fi=ev(`resolveFrontEdgeIndex(${HOUSE})`);
   if(fi!==0) throw new Error('did not honor chosen front edge 0, got '+fi);
 });
 check('resolveFrontEdgeIndex falls back to auto for null / out-of-range / non-integer', ()=>{
   ev('state.config.stageFrontEdge=null');   const a=ev(`resolveFrontEdgeIndex(${HOUSE})`);
   ev('state.config.stageFrontEdge=99');     const b=ev(`resolveFrontEdgeIndex(${HOUSE})`);
   ev('state.config.stageFrontEdge=-1');     const c=ev(`resolveFrontEdgeIndex(${HOUSE})`);
   ev('state.config.stageFrontEdge=1.5');    const d=ev(`resolveFrontEdgeIndex(${HOUSE})`);
   const auto=ev(`autoFrontEdgeIndex(${HOUSE})`);
   if(a!==auto||b!==auto||c!==auto||d!==auto) throw new Error('fallback wrong: '+[a,b,c,d,auto].join(','));
 });

 check('getStageShape derives P0/P2 from the CHOSEN front edge (bottom), not the auto peak', ()=>{
   ev(`state.config.customStagePoints=${HOUSE}; state.config.stageFrontEdge=0`);
   const s=JSON.parse(ev('JSON.stringify(getStageShape())'));
   if(s.frontEdgeIndex!==0) throw new Error('frontEdgeIndex not 0: '+s.frontEdgeIndex);
   // The bottom edge sits at y=300; both endpoints must be on it.
   if(Math.round(s.P0.y)!==300 || Math.round(s.P2.y)!==300) throw new Error('endpoints not on bottom edge: '+JSON.stringify([s.P0,s.P2]));
   // Inward normal of the bottom edge must point UP (toward the centroid above it): ny < 0.
   if(!(s.inward.y<0)) throw new Error('inward normal should point up for a bottom front edge: '+JSON.stringify(s.inward));
 });

 check('vocalists SPREAD along the chosen front edge instead of piling on the peak', ()=>{
   // Auto front (a roof edge) crams vocalists near the narrow peak. Choosing the wide bottom edge
   // must spread their X across the stage. Compare X-spread: chosen-bottom >> auto-peak.
   ev(`state.config.customStagePoints=${HOUSE}; state.config.customStageEnabled=false`);
   ev('state.config.stageFrontEdge=null');                 // auto = a roof edge
   const auto=JSON.parse(ev('JSON.stringify(getVoxPositions(5))'));
   ev('state.config.stageFrontEdge=0');                    // choose the flat bottom edge
   const chosen=JSON.parse(ev('JSON.stringify(getVoxPositions(5))'));
   const spread=a=>{const xs=a.map(p=>p.x);return Math.max(...xs)-Math.min(...xs);};
   const sAuto=spread(auto), sChosen=spread(chosen);
   if(!(sChosen>sAuto+100)) throw new Error('bottom-edge spread ('+sChosen.toFixed(0)+') not wider than auto peak ('+sAuto.toFixed(0)+')');
   // And along the bottom edge every vocalist sits near y≈300 minus the inward margin (well below the peak).
   if(chosen.some(p=>p.y<200)) throw new Error('a vocalist landed up near the peak on the bottom-edge front: '+JSON.stringify(chosen.map(p=>Math.round(p.y))));
 });

 check('stageFrontEdge survives a save -> load (loadState) round-trip', ()=>{
   ev(`state.config.customStagePoints=${HOUSE}; state.config.stageFrontEdge=3; saveState();`);
   const raw=window.localStorage.getItem(ev('STORAGE_KEY'));
   const parsed=JSON.parse(raw);
   const cfg=parsed.config||{};
   if(cfg.stageFrontEdge!==3) throw new Error('not persisted to localStorage config: '+cfg.stageFrontEdge);
   // loadState() RETURNS a fresh, normalized state; the app assigns `state = loadState()`.
   ev('state = loadState();');
   const after=ev('state.config.stageFrontEdge');
   if(after!==3) throw new Error('loadState did not restore stageFrontEdge (got '+after+')');
 });
 check('loadState drops an invalid persisted stageFrontEdge to null', ()=>{
   // seed a NON-null value first so a genuine normalize-to-null is proven (not a leftover null)
   ev('state.config.stageFrontEdge=2;');
   const raw=JSON.parse(window.localStorage.getItem(ev('STORAGE_KEY')));
   raw.config.stageFrontEdge=-5;
   window.localStorage.setItem(ev('STORAGE_KEY'), JSON.stringify(raw));
   ev('state = loadState();');
   const after=ev('state.config.stageFrontEdge');
   if(after!==null) throw new Error('invalid front edge should normalize to null, got '+after);
 });

 // Editor: the "Front edge" affordance actually re-picks the front and passes it to onSave.
 check('outline editor: Front-edge mode picks an edge and onSave receives its index', ()=>{
   ev(`state.config.customStagePoints=${HOUSE}; state.config.stageFrontEdge=null;`);
   ev('window.__savedFront=undefined; openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, getInitialFront:()=>state.config.stageFrontEdge, onSave:(p,fi)=>{ window.__savedPts=p; window.__savedFront=fi; } })');
   // enter front-pick mode, then click edge 0 (the bottom edge pick target)
   doc.getElementById('saPolyFront').click();
   const svg=doc.getElementById('saPolySvg');
   const pick=svg.querySelector('[data-frontedge="0"]');
   if(!pick) throw new Error('no front-pick target rendered in front mode');
   pdown(pick,0,0);
   doc.getElementById('saPolySave').click();
   if(window.__savedFront!==0) throw new Error('onSave did not receive chosen front index 0, got '+window.__savedFront);
 });
 check('outline editor: no front pick → onSave gets null (keeps auto)', ()=>{
   ev(`state.config.customStagePoints=${HOUSE}; state.config.stageFrontEdge=null;`);
   ev('window.__savedFront2="unset"; openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, getInitialFront:()=>state.config.stageFrontEdge, onSave:(p,fi)=>{ window.__savedFront2=fi; } })');
   // move a corner so the editor is "dirty" and will save, but never touch the front edge
   const svg=doc.getElementById('saPolySvg');
   const corner=svg.querySelector('[data-corner="0"]');
   pdown(corner,20,300);
   const mv=new window.PointerEvent('pointermove',{bubbles:true,clientX:60,clientY:320,pointerId:1});svg.dispatchEvent(mv);
   const up=new window.PointerEvent('pointerup',{bubbles:true,clientX:60,clientY:320,pointerId:1});svg.dispatchEvent(up);
   doc.getElementById('saPolySave').click();
   if(window.__savedFront2!==null) throw new Error('untouched front should save as null, got '+window.__savedFront2);
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
