const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + ((e.detail&&e.detail.message)||e.message)));
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc, url:'http://localhost/',
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

  console.log('--- SETUP_TEMPLATES catalog ---');
  check('all 8 instrument keys present', ()=>{
    const keys = ev('Object.keys(SETUP_TEMPLATES).sort().join(",")');
    if (keys !== 'ag,bass,drums,eg,keys,md,strings,vocals') throw new Error('keys: '+keys);
  });
  check('every group is well-formed (id, name, type radio|check, unique option ids)', ()=>{
    const bad = ev(`(function(){
      const errs=[];
      for (const k in SETUP_TEMPLATES){
        const t=SETUP_TEMPLATES[k];
        if(!t.label) errs.push(k+':no label');
        (t.groups||[]).forEach(g=>{
          if(!g.id||!g.name) errs.push(k+':group missing id/name');
          if(g.type!=='radio'&&g.type!=='check') errs.push(k+'/'+g.id+':bad type');
          const ids=(g.options||[]).map(o=>o.id);
          if(ids.some(x=>!x)) errs.push(k+'/'+g.id+':option missing id');
          if(new Set(ids).size!==ids.length) errs.push(k+'/'+g.id+':dup option ids');
          (g.options||[]).forEach(o=>{ if(!o.text) errs.push(k+'/'+g.id+':option missing text'); });
        });
      }
      return errs.join('|');
    })()`);
    if (bad) throw new Error(bad);
  });
  check('no built-in defaults (defaults come from church config)', ()=>{
    const hasDefault = ev(`Object.values(SETUP_TEMPLATES).some(t=>(t.groups||[]).some(g=>(g.options||[]).some(o=>o.default)))`);
    if (hasDefault) throw new Error('a catalog option has a built-in default');
  });
  check('bass rig is radio; bass inputs is check; eg stereo option carries addItems', ()=>{
    const bassRig = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='rig').type`);
    if (bassRig !== 'radio') throw new Error('bass rig not radio');
    const bassInputs = ev(`SETUP_TEMPLATES.bass.groups.find(g=>g.id==='inputs').type`);
    if (bassInputs !== 'check') throw new Error('bass inputs not check');
    const egStereo = ev(`SETUP_TEMPLATES.eg.groups.find(g=>g.id==='rig').options.find(o=>o.id==='eg_stereo').addItems.length`);
    if (egStereo !== 3) throw new Error('eg stereo addItems wrong');
  });

  console.log('\n=== RESULT:', errors.length? (errors.length+' ISSUE(S)') : 'ALL CHECKS PASSED','===');
  if(errors.length) console.log(errors.join('\n'));
  process.exitCode = errors.length?1:0;
}, 120));
