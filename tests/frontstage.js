// frontstage.js — regression tests for:
//  (1) stage label collision resolver (labels never overlap when people sit close together)
//  (2) state.config.stageFrontEdge default + safe migration (absent / invalid old saves)
//  (3) "front edge" geometry: custom polygon front-edge selection + vocal placement along it
//  (4) each display renderer (default / Concrete / Molten) emits a highlighted FRONT element
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const path=require('path');
const HTML=process.env.SA_HTML||path.join(__dirname,'..','index.html');
const html=fs.readFileSync(HTML,'utf8');
const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
const STORAGE_KEY=(html.match(/STORAGE_KEY\s*=\s*'([^']+)'/)||[])[1]||'stageAssign.v1';

// Build a DOM (optionally with a pre-seeded localStorage save) and resolve once loaded.
function boot(seedSave){
  return new Promise((resolve)=>{
    const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
    const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
      w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
      w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
      w.scrollTo=()=>{};
      w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
      w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
      w.confirm=()=>true;w.prompt=()=>'x';w.HTMLElement.prototype.requestFullscreen=()=>{};
      if(seedSave){try{w.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedSave));}catch(_){}}
    }});
    dom.window.addEventListener('load',()=>setTimeout(()=>resolve(dom),200));
  });
}

(async()=>{
  const dom=await boot();
  const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;

  // ---- (1) LABEL COLLISION RESOLVER --------------------------------------
  check('resolver exists and is a function',()=>{
    assert(ev('typeof resolveStageLabelLayout')==='function','no resolveStageLabelLayout');
  });

  check('two near-identical labels are separated (no vertical overlap, distinct positions)',()=>{
    const r=ev(`resolveStageLabelLayout([
      {x:400,y:200,name:'EMMA JOHNSON',role:'VOCAL 1'},
      {x:405,y:202,name:'AMELIA GARCIA',role:'VOCAL 2'}
    ],{anchor:'center',charW:8.5,lineH:11,gap:4})`);
    assert(r.length===2,'expected 2 results');
    const a=r[0],b=r[1];
    const nonOverlap=(a.labelY+a.h<=b.labelY+0.01)||(b.labelY+b.h<=a.labelY+0.01);
    assert(nonOverlap,'labels still overlap: '+JSON.stringify([a.labelY,a.h,b.labelY,b.h]));
    assert(Math.abs(a.labelY-b.labelY)>2,'labels landed at ~identical y: '+a.labelY+' vs '+b.labelY);
  });

  check('crowded labels shorten to last name to reclaim room',()=>{
    const r=ev(`resolveStageLabelLayout([
      {x:400,y:200,name:'DANIEL MARTINEZ',role:'EG'},
      {x:404,y:201,name:'CARLOS BROWN',role:'BASS'}
    ],{anchor:'center',charW:8.5,lineH:11,gap:4})`);
    assert(r.some(x=>x.useLast===true),'expected a crowded label to shorten to last name');
    const shortened=r.find(x=>x.useLast);
    assert(!/\s/.test(shortened.name.trim()),'shortened label should be a single word: '+shortened.name);
  });

  check('well-separated labels are NOT moved and NOT shortened (center anchor keeps y)',()=>{
    const r=ev(`resolveStageLabelLayout([
      {x:100,y:80,name:'ALICE',role:'V1'},
      {x:700,y:300,name:'BOB',role:'V2'}
    ],{anchor:'center',charW:8.5,lineH:11,gap:4})`);
    r.forEach(x=>{
      const center=x.labelY+x.h/2;
      assert(Math.abs(center-x.y)<0.5,'non-colliding label moved: center '+center+' vs y '+x.y);
      assert(x.useLast===false,'non-colliding label got shortened unnecessarily');
    });
  });

  // ---- (2) stageFrontEdge DEFAULT + MIGRATION ----------------------------
  check('fresh state: stageFrontEdge defaults to null (auto)',()=>{
    assert(ev('state.config.stageFrontEdge')===null,'default should be null, got '+ev('JSON.stringify(state.config.stageFrontEdge)'));
  });

  const RECT=`[{x:40,y:40},{x:760,y:40},{x:760,y:340},{x:40,y:340}]`;
  check('resolveFrontEdgeIndex: null → auto (most-forward edge = top edge index 0)',()=>{
    assert(ev(`resolveFrontEdgeIndex(${RECT})`)===0,'expected auto front = 0 (top edge)');
  });
  check('resolveFrontEdgeIndex: explicit valid index is honored',()=>{
    ev('state.config.stageFrontEdge=2;');
    assert(ev(`resolveFrontEdgeIndex(${RECT})`)===2,'expected honored front = 2');
    ev('state.config.stageFrontEdge=null;');
  });
  check('resolveFrontEdgeIndex: out-of-range index falls back to auto (never crashes)',()=>{
    ev('state.config.stageFrontEdge=99;');
    assert(ev(`resolveFrontEdgeIndex(${RECT})`)===0,'bad index should fall back to auto 0');
    ev('state.config.stageFrontEdge=null;');
  });

  // ---- (3) VOCAL PLACEMENT ALONG THE FRONT EDGE --------------------------
  check('slider shape is backward-compatible (inward = straight down, no front index)',()=>{
    ev('state.config.customStagePoints=null; state.config.stageFrontEdge=null;');
    const sh=ev('getStageShape()');
    assert(sh.inward&&sh.inward.x===0&&sh.inward.y===1,'slider inward should be {0,1}: '+JSON.stringify(sh.inward));
    assert(sh.frontEdgeIndex===null,'slider frontEdgeIndex should be null');
  });

  check('slider vocal positions are byte-identical to the legacy +MARGIN math',()=>{
    // Old code: bez(t).y + 38 (MARGIN), x unchanged. inward={0,1} reproduces this exactly.
    ev('state.config.customStagePoints=null; state.config.stageFrontEdge=null; state.config.customStageEnabled=false;');
    const vox=ev('getVoxPositions(3)');
    const sh=ev('getStageShape()');
    // reconstruct bezier manually and compare
    const P0=sh.P0,P1=sh.P1,P2=sh.P2;
    function bez(t){const mt=1-t;return{x:mt*mt*P0.x+2*mt*t*P1.x+t*t*P2.x,y:mt*mt*P0.y+2*mt*t*P1.y+t*t*P2.y};}
    const inset=Math.max(0.08,0.5/3);
    for(let i=0;i<3;i++){
      const t=inset+(i/2)*(1-2*inset);const b=bez(t);
      assert(Math.abs(vox[i].x-b.x)<1e-6,'x drift at '+i);
      assert(Math.abs(vox[i].y-(b.y+38))<1e-6,'y should be bez.y+38 at '+i+': '+vox[i].y+' vs '+(b.y+38));
    }
  });

  check('custom polygon: front edge choice flips inward normal + moves vocalists to that edge',()=>{
    ev(`state.config.customStagePoints=${RECT}; state.config.customStageEnabled=false;`);
    ev('state.config.stageFrontEdge=0;');            // front = TOP
    const topVox=ev('getVoxPositions(3)');
    ev('state.config.stageFrontEdge=2;');            // front = BOTTOM
    const shB=ev('getStageShape()');
    assert(shB.inward.y===-1,'bottom-front inward should point up (y=-1): '+JSON.stringify(shB.inward));
    const botVox=ev('getVoxPositions(3)');
    const avgTop=topVox.reduce((s,p)=>s+p.y,0)/3;
    const avgBot=botVox.reduce((s,p)=>s+p.y,0)/3;
    assert(avgTop<150,'top-front vocalists should sit near the top, avgY='+avgTop);
    assert(avgBot>250,'bottom-front vocalists should sit near the bottom, avgY='+avgBot);
    ev('state.config.customStagePoints=null; state.config.stageFrontEdge=null;');
  });

  // ---- (4) FRONT-EDGE HIGHLIGHT IN EACH DISPLAY RENDERER -----------------
  function seedRoster(){
    ev(`
      state.vocalists=[{id:'v1',name:'Emma Johnson'},{id:'v2',name:'Amelia Garcia'},{id:'v3',name:'Sara Lee'}];
      state.assignments=['v1','v2','v3',null,null,null,null,null];
      state.instruments=[{id:'i1',label:'Electric Guitar',tag:'EG',assignedTo:'Daniel Martinez'},{id:'i2',label:'Bass',tag:'Bass',assignedTo:'Carlos Brown'}];
      state.config.customStageEnabled=true;
      state.config.customStagePositions={ i1:{x:400,y:250}, i2:{x:408,y:252}, vocal_0:{x:300,y:120}, vocal_1:{x:306,y:122} };
    `);
  }

  check('DEFAULT display renderer emits a highlighted FRONT edge + separates crowded cards',()=>{
    // EVERY world is bespoke now (concrete/molten/corporate/terra/orbit), so force the DEFAULT
    // skeleton directly: null the active world's renderer so renderDisplayView() falls through to
    // the default #dvLayout, then restore it.
    seedRoster();
    ev("__savedRD = WORLDS[state.world].renderDisplay; WORLDS[state.world].renderDisplay = undefined; renderDisplayView(); WORLDS[state.world].renderDisplay = __savedRD;");
    assert(doc.querySelectorAll('.dv-stage-svg .dv-front-edge').length>=1,'no front-edge path on default display');
    assert(doc.querySelectorAll('.dv-stage-svg .dv-front-edge-lbl').length>=1,'no FRONT label on default display');
    const tops=[...doc.querySelectorAll('#dvStagePeople .dv-sp')].map(c=>parseFloat(c.style.top));
    assert(tops.length>=2,'expected >=2 stage cards');
    const uniq=new Set(tops.map(t=>t.toFixed(2)));
    assert(uniq.size===tops.length,'default display cards overlap (identical tops): '+JSON.stringify(tops));
  });

  check('CONCRETE renderer emits a highlighted FRONT edge + separates crowded labels',()=>{
    seedRoster(); ev("state.world='concrete';"); ev('renderDisplayView()');
    assert(doc.querySelectorAll('#dvWorldRoot .cw-front').length>=1,'no concrete front path');
    assert(doc.querySelectorAll('#dvWorldRoot .cw-frontlbl').length>=1,'no concrete FRONT label');
    const ys=[...doc.querySelectorAll('#dvWorldRoot .cw-pl')].map(t=>parseFloat(t.getAttribute('y')));
    const uniq=new Set(ys.map(y=>y.toFixed(1)));
    assert(uniq.size===ys.length,'concrete name labels overlap (identical y): '+JSON.stringify(ys));
  });

  check('MOLTEN renderer emits a highlighted FRONT edge + separates crowded labels',()=>{
    seedRoster(); ev("state.world='molten';"); ev('renderDisplayView()');
    assert(doc.querySelectorAll('#dvWorldRoot .mw-front').length>=1,'no molten front path');
    assert(doc.querySelectorAll('#dvWorldRoot .mw-frontlbl').length>=1,'no molten FRONT label');
    const ys=[...doc.querySelectorAll('#dvWorldRoot .mw-pl')].map(t=>parseFloat(t.getAttribute('y')));
    const uniq=new Set(ys.map(y=>y.toFixed(1)));
    assert(uniq.size===ys.length,'molten name labels overlap (identical y): '+JSON.stringify(ys));
  });

  check('TERRA renderer emits a highlighted FRONT edge + separates crowded labels',()=>{
    seedRoster(); ev("state.world='terra';"); ev('renderDisplayView()');
    assert(doc.querySelectorAll('#dvWorldRoot .tw-front').length>=1,'no terra front path');
    assert(doc.querySelectorAll('#dvWorldRoot .tw-frontlbl').length>=1,'no terra FRONT label');
    const ys=[...doc.querySelectorAll('#dvWorldRoot .tw-pl')].map(t=>parseFloat(t.getAttribute('y')));
    const uniq=new Set(ys.map(y=>y.toFixed(1)));
    assert(uniq.size===ys.length,'terra name labels overlap (identical y): '+JSON.stringify(ys));
  });

  check('ORBIT renderer emits a highlighted FRONT edge + separates crowded labels',()=>{
    seedRoster(); ev("state.world='orbit';"); ev('renderDisplayView()');
    assert(doc.querySelectorAll('#dvWorldRoot .ow-front').length>=1,'no orbit front path');
    assert(doc.querySelectorAll('#dvWorldRoot .ow-frontlbl').length>=1,'no orbit FRONT label');
    const ys=[...doc.querySelectorAll('#dvWorldRoot .ow-pl')].map(t=>parseFloat(t.getAttribute('y')));
    const uniq=new Set(ys.map(y=>y.toFixed(1)));
    assert(uniq.size===ys.length,'orbit name labels overlap (identical y): '+JSON.stringify(ys));
  });

  // ---- (2b) MIGRATION FROM A PERSISTED LEGACY SAVE (no stageFrontEdge) ----
  const rectPts=[{x:40,y:40},{x:760,y:40},{x:760,y:340},{x:40,y:340}];
  const dom2=await boot({config:{stageCurvature:70,stageDepth:100,customStagePoints:rectPts}});
  const ev2=c=>dom2.window.eval(c);
  check('legacy save without stageFrontEdge loads safely → null; other fields intact',()=>{
    assert(ev2('state.config.stageFrontEdge')===null,'legacy migration should yield null, got '+ev2('JSON.stringify(state.config.stageFrontEdge)'));
    assert(ev2('state.config.customStagePoints && state.config.customStagePoints.length')===4,'legacy custom points lost');
  });

  console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
  if(errs.length) console.log(errs.join('\n'));
  process.exitCode=errs.length?1:0;
})();
