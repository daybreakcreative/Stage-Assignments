// The de-overlap resolver must give the SAME arrangement for the same marks whatever the plot's
// pixel size. It did not (2026-10-08, bug_6a0219ce follow-up): its climb step parks a card exactly
// at the gap boundary (p.labelY - h - gap) and then tests `ay1 + gap <= by0` on floats, so whether
// that touching pair reads as clear depends on sub-pixel residue in the measured sizes — which
// differs by plot width. On Dillon's real plan the Drums card sat 14 units (one lineH/2 step) higher
// in Edit Layout than on the TV with identical inputs to one decimal. Touching within an epsilon is
// clear, and tiny perturbations of the inputs must not change the output.
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const vc=new VirtualConsole();vc.on('jsdomError',e=>console.log('JSDOM ERR',(e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
}});
const{window}=dom;const ev=c=>window.eval(c);const errs=[];
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
// Dillon's 2026-10-08 plan, measured in Edit Layout at 1920x1080 (viewBox units). Drums and Bass
// collide; the resolver flips Drums above and climbs until it just clears Bass.
const MARKS=[
 {x:122,y:338,name:'Grayson Kredit',role:'DRUMS',anchor:'left',wUnits:142.9,hUnits:50.4},
 {x:290,y:337,name:'Mesac Carballo',role:'BASS',anchor:'center',wUnits:147.7,hUnits:50.4},
 {x:530,y:298,name:'Brian McMaster',role:'EG 1',anchor:'center',wUnits:149.3,hUnits:50.4},
 {x:663,y:334,name:'Arturo San Vicente',role:'KEYS · MD',anchor:'right',wUnits:180.2,hUnits:50.4},
 {x:685,y:172.375,name:'Laura Perez',role:'VOCAL 1',anchor:'right',wUnits:117.6,hUnits:50.4},
 {x:495,y:97.375,name:'Marcus Donalson',role:'VOCAL 2',anchor:'center',wUnits:163.3,hUnits:50.4},
 {x:305,y:97.375,name:'Kaeli Hearn',role:'VOCAL 3',anchor:'center',wUnits:114.5,hUnits:50.4},
 {x:115,y:172.375,name:'Aimee Cruz',role:'VOCAL 4',anchor:'left',wUnits:115.6,hUnits:50.4}
];
function run(marks,minW){
  return JSON.parse(ev(`(function(){const m=stageLabelMetrics();const out=resolveStageLabelLayout(${JSON.stringify(marks)},{anchor:'center',charW:m.charW,lineH:m.lineH,gap:m.gap,dotR:0,maxDy:DV_LABEL_MAX_DY,minW:${minW}});return JSON.stringify(out.map(o=>+(o.labelY+o.h/2).toFixed(2)));})()`));
}
window.addEventListener('load',()=>setTimeout(()=>{
 const base=run(MARKS,114.5);
 // Emulate what measuring the same cards on two different plots does to the inputs: px -> units
 // conversion leaves residue in the 1e-13 range, and real screens differ by far more than that.
 const variants={
   'heights as measured in Edit Layout (50.43918918918919)': MARKS.map(m=>({...m,hUnits:50.43918918918919})),
   'heights +1e-9':      MARKS.map(m=>({...m,hUnits:m.hUnits+1e-9})),
   'heights -1e-9':      MARKS.map(m=>({...m,hUnits:m.hUnits-1e-9})),
   'widths x(1+1e-12)':  MARKS.map(m=>({...m,wUnits:m.wUnits*(1+1e-12)})),
   'measured on a 790px plot': MARKS.map(m=>({...m,wUnits:Math.round(m.wUnits*790/800)/(790/800),hUnits:Math.round(m.hUnits*375/380)/(375/380)})),
   'measured on an 1850px plot': MARKS.map(m=>({...m,wUnits:Math.round(m.wUnits*1850/800)/(1850/800),hUnits:Math.round(m.hUnits*879/380)/(879/380)}))
 };
 Object.entries(variants).forEach(([label,marks])=>{
   check('same arrangement when '+label, ()=>{
     const out=run(marks,114.5);
     const bad=out.map((y,i)=>Math.abs(y-base[i])>0.6?MARKS[i].name.split(' ')[0]+' '+base[i]+' -> '+y:null).filter(Boolean);
     if(bad.length) throw new Error(bad.join('; '));
   });
 });
 check('two cards that exactly touch at the gap are clear, not colliding', ()=>{
   // B's top sits 1e-9 INSIDE A's bottom+gap: a float residue, not a real overlap. B must not move.
   const gap=parseFloat(ev('stageLabelMetrics().gap'));
   const A={x:400,y:100,name:'A A',role:'',anchor:'center',wUnits:100,hUnits:50};
   const B={x:400,y:100+50+gap-1e-9,name:'B B',role:'',anchor:'center',wUnits:100,hUnits:50};
   const out=run([A,B],100);
   if(Math.abs(out[1]-B.y)>0.01) throw new Error('B moved to '+out[1]+' from '+B.y.toFixed(3)+' over a 1e-9 overlap');
 });
 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
