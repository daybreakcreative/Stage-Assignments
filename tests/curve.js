const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};
 // Give the editor SVG a real rect so svgPt maps clientX/Y -> 0..800 / 0..380 1:1
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function pdown(el,x,y){const e=new window.PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerId:1});Object.defineProperty(e,'target',{value:el});el.dispatchEvent(e);}
function pmove(svg,x,y){const e=new window.PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y,pointerId:1});svg.dispatchEvent(e);}
function pup(svg,x,y){const e=new window.PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y,pointerId:1});svg.dispatchEvent(e);}
window.addEventListener('load',()=>setTimeout(()=>{
 // ---------- polygonPathFromPoints ----------
 check('straight polygon path uses L + Z', ()=>{
   const d=ev('polygonPathFromPoints([{x:0,y:0},{x:100,y:0},{x:100,y:100}])');
   if(!/^M 0 0 L 100 0 L 100 100 L 0 0 Z$/.test(d)) throw new Error(d);
 });
 check('curved edge emits Q', ()=>{
   const d=ev('polygonPathFromPoints([{x:0,y:0,c:{x:50,y:-40}},{x:100,y:0},{x:50,y:80}])');
   if(!/Q 50 -40 100 0/.test(d)) throw new Error(d);
 });
 // ---------- getStageShape with a curved custom front ----------
 check('getStageShape uses custom polygon path + derives front edge', ()=>{
   ev('state.config.customStagePoints=[{x:20,y:120,c:{x:400,y:20}},{x:780,y:120},{x:780,y:340},{x:20,y:340}]');
   const s=ev('JSON.stringify(getStageShape())'); const o=JSON.parse(s);
   if(!/Q 400 20 780 120/.test(o.path) && !/Q 400 20/.test(o.path)) throw new Error('path missing curve: '+o.path);
   // front edge is the y=120 edge (index 0, from (20,120)->(780,120)) with control (400,20)
   if(Math.round(o.P1.x)!==400 || Math.round(o.P1.y)!==20) throw new Error('arc control not from custom front: '+JSON.stringify(o.P1));
   if(o.edgeY!==120 || o.backY!==340) throw new Error('bounds: edgeY='+o.edgeY+' backY='+o.backY);
   if(!/Q 400 20/.test(o.edge)) throw new Error('apron edge not curved: '+o.edge);
 });
 check('getStageShape does NOT inject slider curve when custom active', ()=>{
   // set sliders to a deep curve; custom outline must ignore them
   ev('state.config.stageCurvature=100; state.config.stageDepth=100');
   const o=JSON.parse(ev('JSON.stringify(getStageShape())'));
   // edge apex must come from custom (y≈20), not slider (which would be edgeY-300)
   if(Math.round(o.P1.y)!==20) throw new Error('slider leaked into edge: '+JSON.stringify(o.P1));
 });
 // ---------- editor drag: corner follows pointer across many moves (the bug) ----------
 check('dragging a corner follows the pointer across multiple moves', ()=>{
   ev('state.config.customStagePoints=[{x:100,y:100},{x:700,y:100},{x:700,y:300},{x:100,y:300}]');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ window.__savedPts=p; } })');
   const svg=doc.getElementById('saPolySvg');
   const corner=svg.querySelector('[data-corner="0"]'); // at (100,100)
   pdown(corner,100,100);
   // move in several steps far away
   pmove(svg,300,260); pmove(svg,420,330); pmove(svg,500,350);
   // read the live point 0 via the path/handle: after rebuild, corner 0 handle should be near (500,350)
   const c0=doc.getElementById('saPolySvg').querySelector('[data-corner="0"]');
   const cx=parseFloat(c0.getAttribute('cx')), cy=parseFloat(c0.getAttribute('cy'));
   pup(svg,500,350);
   if(Math.abs(cx-500)>3 || Math.abs(cy-350)>3) throw new Error('corner did not follow pointer: ('+cx+','+cy+')');
 });
 check('saving keeps the dragged position', ()=>{
   const svg=doc.getElementById('saPolySvg');
   doc.getElementById('saPolySave').click();
   const p=window.__savedPts;
   if(!p || Math.abs(p[0].x-500)>3 || Math.abs(p[0].y-350)>3) throw new Error('saved pts wrong: '+JSON.stringify(p&&p[0]));
 });
 // ---------- editor: drag an edge dot to curve it ----------
 // NOTE (bug #9): the control point is now clamped to the viewBox (0..800 / 0..380), so the
 // drag target here bows the apron toward the audience but keeps the extrapolated control
 // point (c.y = 2H.y - ½(a.y+b.y)) in-bounds — apex 130 → c.y 60 (was apex 60 → c.y -80,
 // which required an off-canvas control point that the clamp now forbids).
 check('dragging an edge dot creates a curve (stores control point)', ()=>{
   ev('state.config.customStagePoints=[{x:100,y:200},{x:700,y:200},{x:700,y:340},{x:100,y:340}]');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ window.__savedPts2=p; } })');
   const svg=doc.getElementById('saPolySvg');
   const edge0=svg.querySelector('[data-edge="0"]'); // midpoint of top edge ~ (400,200)
   pdown(edge0,400,200);
   pmove(svg,400,150);  // pull the apex up toward the audience (stays in-bounds)
   pmove(svg,400,130);
   pup(svg,400,130);
   doc.getElementById('saPolySave').click();
   const p=window.__savedPts2;
   if(!p[0].c) throw new Error('edge 0 has no control point after curve drag');
   // apex should be near (400,130): on-curve mid = .25a + .5c + .25b
   const a=p[0], b=p[1]; const apexY=0.25*a.y+0.5*a.c.y+0.25*b.y;
   if(Math.abs(apexY-130)>4) throw new Error('apex not at drag point, apexY='+apexY);
   // and the stored control point stays inside the viewBox
   if(a.c.y<0||a.c.y>380) throw new Error('control y escaped viewBox: '+a.c.y);
 });
 // Bug #9: an aggressively dragged edge extrapolates its control point far past the
 // viewBox (c = 2H - 0.5(a+b)). That off-canvas control point flings auto-placed
 // vocalists off-screen. The stored control point must be clamped to 0..800 / 0..380.
 check('edge control point is clamped to the viewBox (0..800 / 0..380)', ()=>{
   ev('state.config.customStagePoints=[{x:100,y:200},{x:700,y:200},{x:700,y:340},{x:100,y:340}]');
   ev('openPolygonStageEditor({ getInitial:()=>state.config.customStagePoints, onSave:(p)=>{ window.__savedPts3=p; } })');
   const svg=doc.getElementById('saPolySvg');
   const edge0=svg.querySelector('[data-edge="0"]'); // midpoint of top edge ~ (400,200)
   pdown(edge0,400,200);
   // yank the apex hard toward the top-left corner — extrapolated c would be well < 0
   pmove(svg,0,0);
   pmove(svg,0,0);
   pup(svg,0,0);
   doc.getElementById('saPolySave').click();
   const p=window.__savedPts3;
   if(!p[0].c) throw new Error('edge 0 has no control point after curve drag');
   const c=p[0].c;
   if(c.x<0||c.x>800) throw new Error('control x escaped viewBox: '+c.x);
   if(c.y<0||c.y>380) throw new Error('control y escaped viewBox: '+c.y);
   // sanity: the resulting midY used by getStageShape stays on-canvas too
   const a=p[0], b=p[1]; const apexY=0.25*a.y+0.5*c.y+0.25*b.y;
   if(apexY<0||apexY>380) throw new Error('derived apexY off-canvas: '+apexY);
 });
 check('curve survives a save→reload (loadState keeps .c)', ()=>{
   // simulate persistence round-trip
   ev('saveState()');
   const raw = window.localStorage.getItem(ev('STORAGE_KEY'));
   const parsed = JSON.parse(raw);
   const cps = parsed.config.customStagePoints;
   if(!cps || !cps[0].c) throw new Error('control point not persisted to localStorage');
   // and loadState would keep it (roundStagePoint preserves c)
   const rp = ev('roundStagePoint({x:10,y:20,c:{x:5,y:6}})');
   if(!rp.c || rp.c.x!==5) throw new Error('roundStagePoint dropped c');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
