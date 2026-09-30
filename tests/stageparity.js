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

console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
if(errs.length) console.log(errs.join('\n'));
process.exit(errs.length?1:0);
