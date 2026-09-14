// The run-sheet rail must not eat a third of the TV. Reported 2026-09-09 (bug_2c4039c6): "the
// service order has a bunch of un used space on the far right". Measured at 1920x1080: the rail was
// 637px (33% of the screen) holding 303px of content in 1004px — 70% empty — while the stage, which
// is the point of the display, got 32%. Dillon's call was: shrink the rail, give the room to the
// stage. Rail 33% -> 24%, and the stage's share of what remains 53% -> 59%.
//
// The trap this test exists for: a divider drag writes the WHOLE blob back, every frac and not just
// the dragged one, so ONE drag of any divider froze the then-current defaults into localStorage
// permanently — changing DV_DIVIDER_DEFAULTS would never have reached anyone who had touched a
// divider (i.e. Dillon). DV_DIVIDER_VERSION drops the stored fracs once so a new split lands, while
// keeping the heights, which are a real per-device choice.
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
const{window}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');
 const KEY = ev('DV_DIVIDER_KEY');
 const VER = ev('DV_DIVIDER_VERSION');
 const setStored = o => ev(`localStorage.setItem(DV_DIVIDER_KEY, ${JSON.stringify(JSON.stringify(o))})`);
 const load = () => JSON.parse(ev('JSON.stringify(loadDvDividers())'));

 console.log('--- the rail gives its room to the stage ---');
 check('the default rail is about a quarter of the screen, not a third', ()=>{
   const d = ev('JSON.stringify(DV_DIVIDER_DEFAULTS)');
   const { mainFrac, railFrac } = JSON.parse(d);
   const pct = railFrac / (mainFrac + railFrac) * 100;
   if (!(pct > 20 && pct < 27)) throw new Error(`rail is ${pct.toFixed(1)}% of the screen`);
 });
 check('the stage gets the bigger share of what is left', ()=>{
   const { stageFrac, sideFrac } = JSON.parse(ev('JSON.stringify(DV_DIVIDER_DEFAULTS)'));
   const pct = stageFrac / (stageFrac + sideFrac) * 100;
   if (!(pct > 55)) throw new Error(`stage is only ${pct.toFixed(1)}% of the main area`);
 });
 check('the CSS fallback track matches (it applies before the vars are set)', ()=>{
   const css = (html.match(/<style>([\s\S]*?)<\/style>/)||[])[1] || '';
   const m = css.match(/\.dv-layout\.has-rail\s*\{([^}]*)\}/);
   if (!m) throw new Error('no has-rail grid rule');
   if (/33%/.test(m[1])) throw new Error('fallback is still 33%: ' + m[1]);
   if (!/24%/.test(m[1])) throw new Error('fallback does not carry the new 24%: ' + m[1]);
 });

 console.log('--- a stale stored split does not pin the old defaults ---');
 check('an unversioned blob loses its fracs so the new split applies', ()=>{
   setStored({ stageFrac: 1.15, sideFrac: 1.0, mainFrac: 1.0, railFrac: 0.5, headerH: 150 });
   const d = load();
   const def = JSON.parse(ev('JSON.stringify(DV_DIVIDER_DEFAULTS)'));
   if (d.railFrac !== def.railFrac) throw new Error(`railFrac stayed ${d.railFrac}, wanted ${def.railFrac}`);
   if (d.stageFrac !== def.stageFrac) throw new Error(`stageFrac stayed ${d.stageFrac}`);
 });
 check('...but keeps the heights, which are a real per-device choice', ()=>{
   setStored({ stageFrac: 1.15, railFrac: 0.5, headerH: 150, vocalsH: 220, bandH: 300, bandRosterSig: 'b3:a,b,c|h1' });
   const d = load();
   if (d.headerH !== 150) throw new Error('headerH lost: ' + d.headerH);
   if (d.vocalsH !== 220) throw new Error('vocalsH lost: ' + d.vocalsH);
   if (d.bandH !== 300) throw new Error('bandH lost: ' + d.bandH);
   if (d.bandRosterSig !== 'b3:a,b,c|h1') throw new Error('roster signature lost');
 });
 check('a blob already on this version keeps the split the user dragged', ()=>{
   setStored({ v: VER, stageFrac: 2.4, sideFrac: 0.7, mainFrac: 1.0, railFrac: 0.2, headerH: 90 });
   const d = load();
   if (d.stageFrac !== 2.4 || d.railFrac !== 0.2 || d.sideFrac !== 0.7)
     throw new Error('a deliberate drag was discarded: ' + JSON.stringify(d));
 });
 check('saving stamps the version, so the next load does not strip what was just set', ()=>{
   ev(`localStorage.removeItem(DV_DIVIDER_KEY); saveDvDividers({ stageFrac: 2.0, sideFrac: 0.8, mainFrac: 1.0, railFrac: 0.25 });`);
   const raw = JSON.parse(ev(`localStorage.getItem(DV_DIVIDER_KEY)`));
   if (raw.v !== VER) throw new Error('save did not stamp the version: ' + JSON.stringify(raw));
   const d = load();
   if (d.stageFrac !== 2.0 || d.railFrac !== 0.25) throw new Error('round trip lost the drag: ' + JSON.stringify(d));
 });
 check('no stored blob at all → plain defaults', ()=>{
   ev('localStorage.removeItem(DV_DIVIDER_KEY)');
   const d = load();
   const def = JSON.parse(ev('JSON.stringify(DV_DIVIDER_DEFAULTS)'));
   if (d.railFrac !== def.railFrac || d.stageFrac !== def.stageFrac) throw new Error(JSON.stringify(d));
 });
 check('a corrupt blob falls back to defaults instead of throwing', ()=>{
   ev(`localStorage.setItem(DV_DIVIDER_KEY, '{not json')`);
   const d = load();
   if (typeof d.railFrac !== 'number') throw new Error('no usable defaults: ' + JSON.stringify(d));
 });

 console.log('--- applying it does not throw and sets the vars ---');
 check('applyDvDividers writes both column splits onto dvLayout', ()=>{
   ev('localStorage.removeItem(DV_DIVIDER_KEY); applyDvDividers();');
   const got = ev(`(() => { const l = document.getElementById('dvLayout'); return JSON.stringify({
     stage: l.style.getPropertyValue('--dv-stage-frac'), side: l.style.getPropertyValue('--dv-side-frac'),
     main: l.style.getPropertyValue('--dv-main-frac'), rail: l.style.getPropertyValue('--dv-rail-frac') }); })()`);
   const v = JSON.parse(got);
   if (!/^1\.45fr$/.test(v.stage)) throw new Error('stage frac: ' + v.stage);
   if (!/^0\.32fr$/.test(v.rail)) throw new Error('rail frac: ' + v.rail);
 });

 setTimeout(()=>{
   console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
   if(errs.length) console.log(errs.join('\n'));
   process.exit(errs.length?1:0);
 },20);
},150));
