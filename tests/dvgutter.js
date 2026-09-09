// The side column has to sit against the service-order rail. Reported 2026-09-09 (bug_2c4039c6):
// "the band IEM widget is not pressed all the way to the right next to the service order".
//
// .dv-main carries a 28px horizontal inset to hold content off the SCREEN edge. When the rail is
// beside it that edge is not a screen edge, so the inset stacked with the 8px divider and the
// rail's own 22px padding and left the BAND/HANDHELDS card floating 36px short of the run sheet.
// Measured in Chrome at 1920x1080: band block right edge 1247, rail left edge 1283. After the fix
// the gap is 8px — the divider itself, which must stay full width to remain grabbable.
//
// jsdom cannot lay out, so the pixels are browser-verified; what is asserted here is the rule that
// produces them, and the class it hangs off being applied in exactly the right cases.
const fs=require('fs');const path=require('path');const{JSDOM,VirtualConsole}=require('jsdom');
const htmlPath=process.env.SA_HTML||path.join(__dirname,'..','index.html');
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

 const css = (html.match(/<style>([\s\S]*?)<\/style>/)||[])[1] || '';

 console.log('--- the rule that closes the gutter ---');
 check('has-rail drops dv-main\'s inset on the rail side only', ()=>{
   const m = css.match(/\.dv-layout\.has-rail\s*>\s*\.dv-main\s*\{([^}]*)\}/);
   if (!m) throw new Error('no `.dv-layout.has-rail > .dv-main` rule — the 36px gutter is back');
   if (!/padding-right\s*:\s*0/.test(m[1])) throw new Error('rule does not zero padding-right: ' + m[1]);
   if (/padding\s*:/.test(m[1])) throw new Error('rule clears padding wholesale; only the rail side should go: ' + m[1]);
 });
 check('the divider keeps its full 8px so it stays grabbable', ()=>{
   const m = css.match(/\.dv-layout\.has-rail\s*\{([^}]*)\}/);
   if (!m) throw new Error('no `.dv-layout.has-rail` grid rule');
   if (!/\b8px\b/.test(m[1])) throw new Error('divider track is no longer 8px: ' + m[1]);
 });

 console.log('--- and it hangs off the right class ---');
 const seed = (rsPos, items) => ev(`
   state.config.display.showServiceOrder=true;
   state.config.display.runSheetPosition='${rsPos}';
   state.serviceOrder=${items ? "[{kind:'song',title:'Praise',length:300}]" : '[]'};
   state.instruments=[{id:'inst_keys',label:'Keys',pack:'Keys',tag:'Keys',assignedTo:'Simon Mugarami',vocalistPlayer:null}];
   state.vocalists=[{id:'v0',name:'Grayson Hall'}]; state.assignments=['v0',null,null,null,null,null,null,null];
   state.shadows=[]; state.hosts={};
   renderDisplayView();
   document.getElementById('dvLayout').classList.contains('has-rail');
 `);

 check('rail on the right → has-rail on, so the gutter closes', ()=>{
   if (seed('right', true) !== true) throw new Error('has-rail missing with the rail on the right');
 });
 check('rail below the stage → has-rail off, so the screen-edge inset comes back', ()=>{
   if (seed('bottom', true) !== false) throw new Error('has-rail should not apply when the rail is below');
 });
 check('rail hidden → has-rail off', ()=>{
   if (seed('hidden', true) !== false) throw new Error('has-rail should not apply when the rail is hidden');
 });
 check('empty run sheet → has-rail off (no rail is rendered at all)', ()=>{
   if (seed('right', false) !== false) throw new Error('has-rail applied with an empty service order');
 });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   if(errs.length) console.log(errs.join('\n'));
   process.exit(errs.length?1:0);
 },20);
},150));
