// Batch A UI fixes: name-format preview cards use ONE sample name (formatted 4 ways), and the app
// carries no decorative pictographic emoji. (Scroll + fullscreen fixes are CSS/DOM — live-verified.)
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const htmlPath=(process.env.SA_HTML||require('path').join(__dirname,'..','index.html'));
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
 ev('toast=function(){};saveState=function(){};');

 check('name-format preview cards all show the SAME sample person, formatted', ()=>{
   ev('renderLayoutEditor();');
   const cards=[].slice.call(doc.querySelectorAll('#layoutEdit .name-fmt-card'));
   if(cards.length!==4) throw new Error('expected 4 name-format cards, got '+cards.length);
   const byFmt={};
   cards.forEach(c=>{ byFmt[c.getAttribute('data-name-fmt')]=(c.querySelector('.nfc-sample')||{}).textContent; });
   if(byFmt['full']!=='Marcus Donalson') throw new Error('full: '+byFmt['full']);
   if(byFmt['first-initial']!=='Marcus D.') throw new Error('first-initial: '+byFmt['first-initial']);
   if(byFmt['first']!=='Marcus') throw new Error('first: '+byFmt['first']);
   if(byFmt['initials']!=='MD') throw new Error('initials: '+byFmt['initials']);
 });

 check('no decorative pictographic emoji anywhere in the app source', ()=>{
   const em=/[\u{1F000}-\u{1FAFF}\u{FE0F}]/u;
   const lines=html.split('\n');
   const hits=[];
   lines.forEach((l,i)=>{ if(em.test(l)) hits.push((i+1)+': '+l.trim().slice(0,60)); });
   if(hits.length) throw new Error('emoji still present:\n'+hits.slice(0,8).join('\n'));
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
