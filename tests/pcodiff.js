const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(window){
    window.structuredClone = window.structuredClone || (v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
    window.matchMedia = window.matchMedia || (()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
    window.scrollTo=()=>{};
    if(!window.crypto) window.crypto={};
    if(!window.crypto.randomUUID) window.crypto.randomUUID=()=>'x'+Math.random().toString(16).slice(2);
    window.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
    window.Element.prototype.setPointerCapture=function(){};
    window.Element.prototype.releasePointerCapture=function(){};
  }});
const { window } = dom;
const ev = c => window.eval(c);
const doc = window.document;
function check(label, fn){ try{ fn(); console.log('  OK  ',label);}catch(e){ console.log('  FAIL',label,'->',e.message); errors.push(label+': '+e.message);} }
window.addEventListener('load', ()=>setTimeout(()=>{

  console.log('--- diffPcoModel ---');
  const base = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1'}], people:[
    {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},
    {pcoId:'tm2',name:'Sophia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'},
    {pcoId:'tm3',name:'Sam',kind:'band',position:'drums',host:'',isWL:false,leadsSongs:false,status:'C'},
    {pcoId:'tm4',name:'Carl',kind:'band',position:'eg',host:'',isWL:false,leadsSongs:false,status:'C'}
  ]});

  check('add / decline / hardRemove / roleChange / rename / serviceOrder all detected', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1 NEW'}], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},
      {pcoId:'tm2',name:'Sophia R',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'},
      {pcoId:'tm3',name:'Sam',kind:'band',position:'drums',host:'',isWL:false,leadsSongs:false,status:'D'},
      {pcoId:'tm4',name:'Carl',kind:'band',position:'keys',host:'',isWL:false,leadsSongs:false,status:'C'},
      {pcoId:'tm5',name:'Mia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'}
    ]});
    const d = ev(`diffPcoModel(${base}, ${next})`);
    if (d.added.map(p=>p.pcoId).join(',')!=='tm5') throw new Error('added: '+JSON.stringify(d.added));
    if (d.declined.map(p=>p.pcoId).join(',')!=='tm3') throw new Error('declined: '+JSON.stringify(d.declined));
    if (d.roleChanged.map(c=>c.to.pcoId).join(',')!=='tm4') throw new Error('roleChanged: '+JSON.stringify(d.roleChanged));
    if (d.renamed.map(c=>c.to.pcoId).join(',')!=='tm2') throw new Error('renamed: '+JSON.stringify(d.renamed));
    if (!d.serviceOrderChanged) throw new Error('serviceOrderChanged not set');
    if (!d.hasChanges) throw new Error('hasChanges false');
  });
  check('hardRemove detected when member absent from next', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[{id:'i1',title:'S1'}], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'},
      {pcoId:'tm2',name:'Sophia',kind:'vocalist',position:'',host:'',isWL:false,leadsSongs:false,status:'C'},
      {pcoId:'tm4',name:'Carl',kind:'band',position:'eg',host:'',isWL:false,leadsSongs:false,status:'C'}
    ]});
    const d = ev(`diffPcoModel(${base}, ${next})`);
    if (d.hardRemoved.map(p=>p.pcoId).join(',')!=='tm3') throw new Error('hardRemoved: '+JSON.stringify(d.hardRemoved));
    if (d.serviceOrderChanged) throw new Error('serviceOrder falsely changed');
  });
  check('no baseline => everything is an add, no churn flags', ()=>{
    const next = JSON.stringify({ meta:{title:'A',date:'2026-07-05'}, serviceOrder:[], people:[
      {pcoId:'tm1',name:'Jake',kind:'vocalist',position:'',host:'',isWL:true,leadsSongs:true,status:'C'}
    ]});
    const d = ev(`diffPcoModel(null, ${next})`);
    if (d.added.length!==1 || d.hardRemoved.length || d.declined.length) throw new Error('null-baseline diff wrong');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
