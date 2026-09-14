// The display's stage plot must tell the TRUTH about where people stand. Reported 2026-09-09
// (bug_2c4039c6): "the stage display layout is not what I set up ... not translating from stage
// display layout, to edit mode, to display mode".
//
// Cause: renderDisplayView positions each person's CARD at resolveStageLabelLayout's `labelY` —
// a LABEL coordinate whose whole job is to be nudged away from the marker so text doesn't collide
// (the resolver takes `dotR` and returns `dy`, "the vertical nudge applied relative to the dot").
// Display passes dotR:0, draws no marker, and treats the nudged label as the person's position.
// Measured in Chrome at 1920x1080 on a DEFAULT state (no custom outline, nothing hand-placed):
// the Keys/MD player's true spot is y=330 (downstage) and he rendered at y=37.6 — adrift by 293
// of 380 viewBox units, 77% of stage depth, because a card pushed past the bottom flips ABOVE the
// dot and then climbs. Bass and AG drifted 71 and 61 units. Edit mode was faithful to the unit.
//
// The plot may still move a CARD to keep names readable (that is watchlist 53-56 and must keep
// working) — but only within DV_LABEL_MAX_DY.
//
// The first fix also dropped a dot on each person's true spot with a hairline tie to their card.
// Those markers were REMOVED 2026-09-14 on Dillon's call: on a full 14-card stage eleven cards
// drift, so the plot wore eleven dots and eleven ties and read as a rash rather than a signal.
// That makes the cap the only thing left keeping this display honest, so the checks below assert
// it directly, and assert that no marker node comes back.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document:doc}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

// A card is centred on its point, so top% === y/380*100 when it sits where it belongs.
const yOf = el => parseFloat(el.style.top) / 100 * 380;
const xOf = el => parseFloat(el.style.left) / 100 * 800;

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 // An ordinary Sunday on the DEFAULT stage: nothing custom, nothing dragged. The reported bug
 // does not need a custom outline — this is what every user gets out of the box.
 const seed = () => ev(`
   state.config.customStagePoints=null; state.config.stageFeatures=[];
   state.config.customStageEnabled=false; state.config.customStagePositions={};
   state.serviceOrder=[];
   state.instruments=[
     {id:'inst_drums',label:'Drums',      pack:'Drums',   tag:'Drums',assignedTo:'Cody Reed',      vocalistPlayer:null},
     {id:'inst_bass', label:'Bass',       pack:'Bass',    tag:'Bass', assignedTo:'Luke Barrett',   vocalistPlayer:null},
     {id:'inst_eg2',  label:'Electric 2', pack:'Misc 1',  tag:'EG',   assignedTo:'Gannon Pike',    vocalistPlayer:null},
     {id:'inst_ag',   label:'Acoustic',   pack:'Acoustic',tag:'AG',   assignedTo:'Marcus Donalson',vocalistPlayer:null},
     {id:'inst_eg1',  label:'Electric 1', pack:'EG',      tag:'EG',   assignedTo:'Jack Grubbs',    vocalistPlayer:null},
     {id:'inst_keys', label:'Keys',       pack:'Keys',    tag:'Keys', assignedTo:'Simon Mugarami', vocalistPlayer:null}];
   state.musicDirectorId='inst_keys';
   state.vocalists=['Grayson Hall','Mo Maldonado','Ava Whitfield','Ellie Sandoval','Noah Kingsley']
     .map((n,i)=>({id:'v'+i,name:n,wl:i===0}));
   state.assignments=['v0','v1','v2','v3','v4',null,null,null];
   state.shadows=[]; state.hosts={};
   renderDisplayView();
 `);

 // Every person's TRUE spot, straight from the same functions the stage itself uses.
 const truth = () => ev(`(() => {
   const bp = getBandStagePositions();
   const out = [];
   state.instruments.forEach(i => { const p = bp[i.id];
     if (p && (i.assignedTo||'').trim()) out.push({ who: i.assignedTo, x: p.x, y: p.y }); });
   const vox = getVoxPositions(state.assignments.filter(a=>a).length);
   state.assignments.filter(a=>a).forEach((id,n) => { const v = state.vocalists.find(x=>x.id===id);
     out.push({ who: v.name, x: vox[n].x, y: vox[n].y }); });
   return out;
 })()`);

 seed();
 const marks = truth();
 const cards = () => Array.from(doc.querySelectorAll('#dvStagePeople .dv-sp'));

 console.log('--- the plot renders at all ---');
 check('every filled position gets a card', ()=>{
   if (cards().length !== marks.length) throw new Error(`${cards().length} cards for ${marks.length} people`);
 });
 check('x is faithful for every person (the horizontal axis was never the problem)', ()=>{
   const bad = marks.map((m,k)=>({m, el:cards()[k]})).filter(({m,el}) => el && Math.abs(xOf(el) - m.x) > 1.5);
   if (bad.length) throw new Error(bad.map(b=>`${b.m.who}: x ${Math.round(xOf(b.el))} vs ${Math.round(b.m.x)}`).join('; '));
 });

 console.log('--- the card itself has to be honest (no markers to lean on) ---');
 // THE honesty guard. The dot-and-tie markers were removed 2026-09-14 (on a full stage they put
 // eleven dots on the plot), so the card is the only thing naming where a person stands. Nothing
 // else now catches a card drawn away from its person — assert the real cap, not a loose third.
 check('no card is drawn further from its person than DV_LABEL_MAX_DY', ()=>{
   const cap = ev('DV_LABEL_MAX_DY');
   if (!(cap > 0 && cap <= 100)) throw new Error('cap looks wrong: ' + cap);
   const wild = marks.map((m,k)=>({m, el:cards()[k]}))
     .filter(({m,el}) => el && Math.abs(yOf(el) - m.y) > cap + 1)
     .map(({m,el}) => `${m.who}: ${Math.round(Math.abs(yOf(el)-m.y))} units (cap ${cap})`);
   if (wild.length) throw new Error(wild.join('; '));
 });

 check('the markers really are gone — no stray dots or ties are rendered', ()=>{
   const n = doc.querySelectorAll('#dvStagePeople .dv-sp-dot, #dvStagePeople .dv-sp-tie').length;
   if (n) throw new Error(n + ' marker node(s) still drawn');
 });

 console.log('--- a hand-placed layout still translates ---');
 check('hand-placed positions put the CARD where the user dropped it', ()=>{
   // With no dot to fall back on, a hand-placed person has to be drawn where they were placed —
   // within the cap. This is the "not translating from stage layout to display mode" complaint.
   ev(`
     state.config.customStageEnabled=true;
     state.config.customStagePositions={};
     state.instruments.forEach((i,n)=>{ state.config.customStagePositions[i.id]={x:120+n*112,y:300}; });
     [200,300,400,500,600].forEach((x,n)=>{ state.config.customStagePositions['vocal_'+n]={x,y:110}; });
     renderDisplayView();
   `);
   const cap = ev('DV_LABEL_MAX_DY');
   const m2 = truth();
   const bad = [];
   m2.forEach((m, k) => {
     const el = cards()[k]; if (!el) { bad.push(m.who + ': no card'); return; }
     const drift = Math.abs(yOf(el) - m.y);
     if (drift > cap + 1) bad.push(`${m.who}: drawn at y ${Math.round(yOf(el))}, placed at ${Math.round(m.y)} (drift ${Math.round(drift)} > cap ${cap})`);
   });
   if (bad.length) throw new Error(bad.join('; '));
 });

 console.log('--- names still do not collide (watchlist 53-56) ---');
 check('the collision resolver is still doing its job', ()=>{
   // The fix must not be "stop resolving overlaps". Cards that share a row must still separate.
   const n = ev(`(() => {
     const marks = [{x:300,y:200,name:'Simon Mugarami',role:'Drums'},{x:320,y:200,name:'Marcus Donalson',role:'AG'}];
     const out = resolveStageLabelLayout(marks, {anchor:'center', charW:8.5, lineH:11, gap:4, dotR:0});
     return stageLayoutOverlapCount(out);
   })()`);
   if (n !== 0) throw new Error('two adjacent labels still overlap (' + n + ')');
 });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   if(errs.length) console.log(errs.join('\n'));
   process.exit(errs.length?1:0);
 },20);
},150));
