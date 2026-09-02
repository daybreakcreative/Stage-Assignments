// A person at stage-left/right with a long name used to be clipped by the stage wrap's
// overflow:hidden ("Simon Mugarami" -> "imon Mugarami" on the green-room TV), because the card is
// centred on the person and therefore grew OUTWARD past the stage. Cards in the outer bands now
// anchor to that edge and grow inward. Chosen from the viewBox x at render time — no measurement.
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

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};');

 console.log('--- the pure rule ---');

 check('far stage-left anchors left, far stage-right anchors right, middle stays centred', ()=>{
   if(ev('stageLabelAnchor(40)')!=='left') throw new Error('x=40 should anchor left');
   if(ev('stageLabelAnchor(95)')!=='left') throw new Error('x=95 (the reported drummer) should anchor left');
   if(ev('stageLabelAnchor(400)')!=='center') throw new Error('mid-stage should stay centred');
   if(ev('stageLabelAnchor(760)')!=='right') throw new Error('x=760 should anchor right');
 });

 check('the band edges are symmetric', ()=>{
   if(ev('stageLabelAnchor(176)')!=='center') throw new Error('22% boundary should be centred');
   if(ev('stageLabelAnchor(175)')!=='left') throw new Error('just inside 22% should anchor left');
   if(ev('stageLabelAnchor(625)')!=='right') throw new Error('just past 78% should anchor right');
   if(ev('stageLabelAnchor(624)')!=='center') throw new Error('78% boundary should be centred');
 });

 check('an explicit span is honoured (not hard-coded to 800)', ()=>{
   if(ev('stageLabelAnchor(50, 400)')!=='left') throw new Error('span-relative left failed');
   if(ev('stageLabelAnchor(380, 400)')!=='right') throw new Error('span-relative right failed');
 });

 console.log('--- render ---');

 const seed=()=>ev(`
   state.serviceOrder=[];
   state.vocalists=[{id:'v1',name:'Kaeli Hearn',micAssigned:'KMS105'},
                    {id:'v2',name:'Marcus Donalson',micAssigned:'D:Facto'},
                    {id:'v3',name:'Ella Graves',micAssigned:'KSM9'}];
   state.assignments=['v1','v2','v3',null,null,null,null,null];
   state.instruments=[{id:'inst_drums',label:'Drums',assignedTo:'Simon Mugarami',pack:'Drums'},
                      {id:'inst_bass',label:'Bass',assignedTo:'Evan Forniss',pack:'Bass'},
                      {id:'inst_keys',label:'Keys',assignedTo:'Santi',pack:'Keys'}];
   state.musicDirectorId='inst_keys'; state.shadows=[]; state.hosts={};
   renderDisplayView();
 `);

 check('every display stage card carries an anchor', ()=>{
   seed();
   const cards=[...doc.querySelectorAll('#dvStagePeople .dv-sp')];
   if(!cards.length) throw new Error('no stage cards rendered');
   const missing=cards.filter(c=>!c.dataset.anchor);
   if(missing.length) throw new Error(missing.length+' cards have no anchor');
 });

 check('at least one card anchors to an edge (the outer players)', ()=>{
   seed();
   const anchors=[...doc.querySelectorAll('#dvStagePeople .dv-sp')].map(c=>c.dataset.anchor);
   if(!anchors.some(a=>a==='left'||a==='right'))
     throw new Error('nothing anchored to an edge: '+JSON.stringify(anchors));
 });

 check('anchors are only ever left/right/center', ()=>{
   seed();
   const bad=[...doc.querySelectorAll('#dvStagePeople .dv-sp')]
     .map(c=>c.dataset.anchor).filter(a=>['left','right','center'].indexOf(a)===-1);
   if(bad.length) throw new Error('unexpected anchor value: '+JSON.stringify(bad));
 });

 check('the CSS actually redefines the transform for the edge buckets', ()=>{
   const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
   if(!/\.dv-sp\[data-anchor="left"\]\{transform:translate\(0,-50%\)\}/.test(css))
     throw new Error('no left-anchor transform rule');
   if(!/\.dv-sp\[data-anchor="right"\]\{transform:translate\(-100%,-50%\)\}/.test(css))
     throw new Error('no right-anchor transform rule');
 });

 check('names are still rendered in full (nothing truncated to achieve this)', ()=>{
   seed();
   const t=doc.getElementById('dvStagePeople').textContent;
   if(t.indexOf('Simon Mugarami')===-1) throw new Error('drummer name not rendered in full');
   if(t.indexOf('Marcus Donalson')===-1) throw new Error('vocalist name not rendered in full');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exit(errs.length?1:0);
},150));
