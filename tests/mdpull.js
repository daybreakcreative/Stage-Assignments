// #3 — a person scheduled as Music Director in PCO must get the MD/Tracks setup,
// whether they also play an instrument (common) or are MD-only (rare).
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push((e.detail&&e.detail.message)||e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>'x';
 w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
}});
const{window,window:{document}}=dom;const ev=c=>window.eval(c);
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
const mkTM = arr => JSON.stringify({data: arr.map((a,i)=>({id:'tm'+(i+1), attributes:{name:a.name, team_position_name:a.pos, status:'C'}}))});
const pull = tmJson => ev(`applyPCOPlanData({attributes:{}}, ${tmJson}, {data:[],included:[]})`);
const mdRolesFor = name => ev(`enumerateSetupRoles().filter(r=>r.role==='md' && normFullName(r.name)===normFullName(${JSON.stringify(name)})).length`);

window.addEventListener('load',()=>setTimeout(()=>{
 ev('toast=function(){};renderAll=function(){};saveState=function(){};');
 ev(`state.config.setupDefaults={ md:{selections:{rig:['md_tracks']},customOptions:[]}, keys:{selections:{source:'k_house'},customOptions:[]} };`);

 check('PCO common: MD who also plays Keys → musicDirectorId set + an md role emitted', ()=>{
   ev(`state.setupItems={}; state.checklistState={};`);
   pull(mkTM([{name:'Dave Lee',pos:'Keys'},{name:'Dave Lee',pos:'Music Director'}]));
   const mdAssignee = ev(`state.musicDirectorId ? (instById(state.musicDirectorId)||{}).assignedTo : null`);
   if (!mdAssignee || !/dave lee/i.test(mdAssignee)) throw new Error('musicDirectorId not set to Dave: '+mdAssignee);
   if (mdRolesFor('Dave Lee') < 1) throw new Error('no md role emitted for MD keys player');
 });

 check('PCO solo: person scheduled ONLY as Music Director still gets an md role', ()=>{
   ev(`state.setupItems={}; state.checklistState={};`);
   pull(mkTM([{name:'Casey Ray',pos:'Music Director'}]));
   if (mdRolesFor('Casey Ray') < 1) throw new Error('solo MD got no md setup role (not asked)');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
