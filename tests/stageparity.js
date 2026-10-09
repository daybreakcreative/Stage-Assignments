// The display, the edit view, Edit Layout and the printed page all draw the SAME stage. On
// 2026-09-30 Dillon sent three photos of one service and they were three different pictures.
// Measured then: card-to-stage width ratio 17.8% (display) / 9.8% (edit) / 3.2% (Edit Layout, where
// cards were a FIXED 60x34px on an 1850px stage); full names via formatDisplayName in display and
// print but a hard-coded firstName() in the edit renderers; de-overlap in display and print and
// NONE AT ALL in the edit view, which never called the resolver.
//
// They are now one function. These checks exist because the drift is invisible in any single view —
// each one looks fine on its own, and only a side-by-side shows it. jsdom cannot measure layout, so
// parity is asserted against the SOURCE: same pipeline, same name function, same clamp coefficients.
const fs=require('fs');const path=require('path');
const htmlPath=process.env.SA_HTML||path.join(__dirname,'..','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const css=(html.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'';
const js=html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
function bodyOf(name){
  const i=js.indexOf('function '+name+'(');
  if(i===-1) throw new Error('no function '+name);
  // brace-match from the first { after the signature
  let d=0,s=js.indexOf('{',i);
  for(let k=s;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d) return js.slice(s,k+1);} }
  throw new Error('unbalanced '+name);
}

console.log('--- there is exactly ONE placement implementation ---');

check('placeStageCards exists', ()=>{
  if(js.indexOf('function placeStageCards(')===-1) throw new Error('missing');
});

check('nothing else resolves a stage layout', ()=>{
  // 1 definition + the 2 calls inside placeStageCards. A 4th means someone started a copy again.
  const total=(js.match(/resolveStageLabelLayout\(/g)||[]).length;
  const inside=(bodyOf('placeStageCards').match(/resolveStageLabelLayout\(/g)||[]).length;
  if(inside!==2) throw new Error('placeStageCards should resolve twice (initial + measured), got '+inside);
  if(total!==3) throw new Error(total+' resolveStageLabelLayout references — expected 3 (1 definition + 2 inside placeStageCards). A renderer is placing people on its own again.');
});

['renderDisplayView','renderStage','fillSummaryStage'].forEach(fn=>{
  check(fn+' places via placeStageCards', ()=>{
    if(bodyOf(fn).indexOf('placeStageCards(')===-1)
      throw new Error(fn+' does not call placeStageCards');
  });
});

console.log('--- the same person shows the same name everywhere ---');

check('the edit view uses formatDisplayName, not a hard-coded first name', ()=>{
  const b=bodyOf('renderStage');
  if(/firstName\((?:v\.name|name)\)/.test(b))
    throw new Error("renderStage still hard-codes firstName() — the edit view showed 'Marcus' while the TV showed 'Marcus Donalson'");
  if(b.indexOf('formatDisplayName(')===-1) throw new Error('renderStage never calls formatDisplayName');
});

check('the display and the printed page use it too', ()=>{
  ['renderDisplayView','fillSummaryStage'].forEach(fn=>{
    if(bodyOf(fn).indexOf('formatDisplayName(')===-1) throw new Error(fn+' does not use formatDisplayName');
  });
});

console.log('--- a card is the same FRACTION of the stage in every view ---');

// Match the rule whose selector STARTS here — '.dv-sp-name{' contains '.sp-name{', so a naive
// indexOf finds a light-theme .dv-* rule and reports the wrong declaration.
function decl(sel){
  const esc=sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(?:^|[}\\n,])\\s*'+esc+'\\s*\\{([^}]*)\\}','m');
  const m=css.match(re);
  if(!m) throw new Error('no rule '+sel);
  return m[1];
}

check('both stage wraps are size-query containers', ()=>{
  ['.stage-svg-wrap','.dv-stage-svg-wrap'].forEach(s=>{
    if(decl(s).indexOf('container-type')===-1)
      throw new Error(s+' is not a query container, so its cards cannot scale with it');
  });
});

check('.sp and .dv-sp size their name from the SAME coefficient', ()=>{
  const a=decl('.sp-name'), b=decl('.dv-sp-name');
  const co=/([\d.]+)cqw/;
  const ma=a.match(co), mb=b.match(co);
  if(!ma) throw new Error('.sp-name is not sized in cqw — it was a fixed 11px, which is what made the edit card 9.8% of the stage against the display 17.8%');
  if(!mb) throw new Error('.dv-sp-name is not sized in cqw');
  if(ma[1]!==mb[1]) throw new Error('coefficients differ: .sp-name '+ma[1]+'cqw vs .dv-sp-name '+mb[1]+'cqw — the two stages will diverge again');
});

check('.sp-role matches .dv-sp-role too', ()=>{
  const co=/([\d.]+)cqw/;
  const a=decl('.sp-role').match(co), b=decl('.dv-sp-role').match(co);
  if(!a||!b) throw new Error('a role line is not sized in cqw');
  if(a[1]!==b[1]) throw new Error('role coefficients differ: '+a[1]+' vs '+b[1]);
});

check('no card is capped with max-width — it sizes to its name', ()=>{
  // .sp had max-width:92px, which ellipsised names instead of letting the resolver shorten them.
  if(/max-width:\s*\d+px/.test(decl('.sp')))
    throw new Error('.sp has a pixel max-width again; names will be cut with an ellipsis rather than resolved');
});

console.log('--- edge cards grow inward in every view ---');

check('both card types have the anchor transforms', ()=>{
  ['.sp','.dv-sp'].forEach(base=>{
    ['left','right'].forEach(side=>{
      if(css.indexOf(base+'[data-anchor="'+side+'"]')===-1)
        throw new Error(base+' has no '+side+' anchor rule — edge people appear in a different spot than on the TV');
    });
  });
});

console.log('--- a card is the same SIZE in stage units in every view, whatever the viewport ---');
// 2026-10-08 (bug_6a0219ce): at 1440x900 one service gave Edit Layout and the TV different pictures —
// Edit Layout lifted Drums and Keys, the TV lifted Bass and EG1 — because the de-overlap resolver
// measures the cards, and the cards were a different FRACTION of the plot in each view: .dv-sp had
// 5px/9px padding, a 2px border and a 72px min-width; .sp had the same things in cqw; and cqw was the
// WRAP's width, which is wider than the drawn plot whenever the wrap is height-limited. Card heights
// measured 26 / 43 / 57 viewBox units across the three views. Everything that sets a card's size is
// now a function of the PLOT width alone, and declared identically for both card types.
function rules(){ const out=[]; const src=css.replace(/\/\*[\s\S]*?\*\//g,''); const re=/([^{}]+)\{([^}]*)\}/g; let m; while((m=re.exec(src))){ m[1].split(',').map(s=>s.trim()).forEach(s=>out.push({sel:s,body:m[2]})); } return out; }
const RULES=rules();
function prop(sel,name){
  const hits=RULES.filter(r=>r.sel===sel);
  if(!hits.length) throw new Error('no rule '+sel);
  let val=null;
  hits.forEach(r=>{ r.body.split(';').forEach(d=>{ const i=d.indexOf(':'); if(i<0) return; if(d.slice(0,i).trim()===name) val=d.slice(i+1).trim(); }); });
  if(val==null) throw new Error(sel+' does not declare '+name);
  return val.replace(/\s+/g,'');
}
// The display multiplies its text by the operator's per-device scale; strip that factor so the
// underlying size expression can be compared with the edit view's.
const unscale=v=>v.replace(/^calc\((.*)\*var\(--dv-stage-text-scale,1\)\)$/,'$1');
check('both people layers are inline-size containers — cqw is the PLOT width, not the wrap', ()=>{
  ['#stagePeople','#dvStagePeople'].forEach(s=>{ if(prop(s,'container-type')!=='inline-size') throw new Error(s+' is not an inline-size container; its cards scale with the wrap, which is wider than the plot whenever height limits the stage'); });
});
['padding','min-width','border-width'].forEach(p=>{
  check('.sp and .dv-sp agree on '+p, ()=>{ const a=prop('.sp',p), b=prop('.dv-sp',p); if(a!==b) throw new Error('.sp '+a+' vs .dv-sp '+b); });
});
['font-size','letter-spacing','margin-bottom','font-weight'].forEach(p=>{
  check('.sp-role and .dv-sp-role agree on '+p, ()=>{ const a=unscale(prop('.sp-role',p)), b=unscale(prop('.dv-sp-role',p)); if(a!==b) throw new Error('.sp-role '+a+' vs .dv-sp-role '+b); });
});
['font-size','line-height'].forEach(p=>{
  check('.sp-name and .dv-sp-name agree on '+p, ()=>{ const a=unscale(prop('.sp-name',p)), b=unscale(prop('.dv-sp-name',p)); if(a!==b) throw new Error('.sp-name '+a+' vs .dv-sp-name '+b); });
});
check('the compact tier is the same fraction too', ()=>{
  ['padding','min-width'].forEach(p=>{ const a=prop('#stagePeople.is-compact .sp',p), b=prop('#dvStagePeople.is-compact .dv-sp',p); if(a!==b) throw new Error(p+': '+a+' vs '+b); });
});
check('no card dimension is a fixed pixel size or capped in pixels', ()=>{
  // A px FLOOR is fine (it only bites on a plot too small to use anyway). A px CAP or a bare px
  // value makes the card a different fraction of a big plot than of a small one — Edit Layout goes
  // fullscreen on the booth machine and its 1850px plot hit the old 30px cap while the TV did not.
  const bad=[];
  [['.sp','padding'],['.sp','min-width'],['.sp','border-width'],['.sp-role','font-size'],['.sp-name','font-size'],['.sp-role','margin-bottom']].forEach(([s,p])=>{
    const v=unscale(prop(s,p));
    if(/clamp\(/.test(v)) bad.push(s+' '+p+' uses clamp() — a px ceiling');
    else if(!/cqw/.test(v)) bad.push(s+' '+p+' has no cqw term: '+v);
  });
  if(bad.length) throw new Error(bad.join('; '));
});
console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');

if(errs.length) console.log(errs.join('\n'));
process.exit(errs.length?1:0);
