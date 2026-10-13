// A stage card near a stage edge is ANCHORED (data-anchor="left"/"right") so it grows inward: at rest
// its transform is translate(0,-50%) or translate(-100%,-50%), not the centred translate(-50%,-50%).
// Every :hover rule that re-states the transform must therefore come in three flavours, or hovering
// an anchored card snaps it by half its width, the pointer is no longer over it, it snaps back, and
// it flickers under the mouse (Dillon, 2026-10-13: "when you hover over a name it glitches out and
// moves on you" — Edit Layout, where `body.stage-editing .sp:hover` outranked the anchored hovers).
// jsdom cannot evaluate :hover, so this pins the stylesheet: for each hover rule on .sp that sets a
// centred transform, the same rule must exist for both anchors with the matching translate.
const fs=require('fs');const path=require('path');
const htmlPath=process.env.SA_HTML||path.join(__dirname,'..','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const css=((html.match(/<style>([\s\S]*?)<\/style>/)||[])[1]||'').replace(/\/\*[\s\S]*?\*\//g,'');
const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const rules=[];{const re=/([^{}]+)\{([^}]*)\}/g;let m;while((m=re.exec(css))){m[1].split(',').map(s=>s.trim()).forEach(s=>rules.push({sel:s,body:m[2].replace(/\s+/g,'')}));}}
const transformOf=(sel)=>{let v=null;rules.filter(r=>r.sel.replace(/\s+/g,' ')===sel).forEach(r=>{r.body.split(';').forEach(d=>{if(d.startsWith('transform:'))v=d.slice(10);});});return v;};
// Hover rules on .sp (any prefix, any extra classes) that do NOT already target an anchor and DO
// set a centred translate.
const centred=rules.filter(r=>/\.sp\b/.test(r.sel)&&/:hover/.test(r.sel)&&!/data-anchor/.test(r.sel)&&/transform:translate\(-50%/.test(r.body)&&!/\.sp-x\b/.test(r.sel));
check('there is at least one centred .sp hover rule to guard (sanity)', ()=>{ if(!centred.length) throw new Error('none found — selector drift?'); });
centred.forEach(r=>{
  const sel=r.sel.replace(/\s+/g,' ');
  [['left','translate(0,-50%)'],['right','translate(-100%,-50%)']].forEach(([side,want])=>{
    // Insert the anchor attribute right after the `.sp` token (e.g. `body.stage-editing .sp:hover`
    // -> `body.stage-editing .sp[data-anchor="left"]:hover`, `.sp.empty:hover` -> `.sp[data-anchor="left"].empty:hover`).
    const anchored=sel.replace(/\.sp\b/,'.sp[data-anchor="'+side+'"]');
    check(`${sel} has a ${side}-anchored twin that keeps the card in place`, ()=>{
      const t=transformOf(anchored);
      if(t==null) throw new Error('no rule '+anchored+' — hovering a '+side+'-anchored card snaps it half a card sideways');
      if(!t.startsWith(want)) throw new Error(anchored+' transform is '+t+', expected it to start with '+want);
    });
  });
});
console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
if(errs.length) console.log(errs.join('\n'));
process.exit(errs.length?1:0);
