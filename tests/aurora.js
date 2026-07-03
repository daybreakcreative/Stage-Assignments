// Aurora theme: opt-in look/mood axis layered on the existing dark/light theme.
// Classic (default) must be untouched; Aurora applies only via [data-look="aurora"].
const fs=require('fs');const{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync((process.env.SA_HTML||require('path').join(__dirname,'..','index.html')),'utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(((e.detail&&e.detail.message)||e.message)));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,beforeParse(w){
 w.structuredClone=w.structuredClone||(v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)));
 w.matchMedia=w.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
 w.scrollTo=()=>{};w.Element.prototype.getBoundingClientRect=function(){return{left:0,top:0,width:800,height:380,right:800,bottom:380,x:0,y:0,toJSON(){}}};
 w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.confirm=()=>true;w.prompt=()=>'';
}});
const{window}=dom;const ev=c=>window.eval(c);const doc=window.document;
function check(l,f){try{f();console.log('  OK  ',l);}catch(e){console.log('  FAIL',l,'->',e.message);errs.push(l);}}
window.addEventListener('load',()=>setTimeout(()=>{
 const html=doc.documentElement;

 check('defaults: look=classic, theme=dark, auroraMood=nebula', ()=>{
   if(ev('state.look')!=='classic') throw new Error('look default not classic: '+ev('state.look'));
   if(ev('state.auroraMood')!=='nebula') throw new Error('mood default not nebula: '+ev('state.auroraMood'));
 });

 check('classic default leaves NO aurora attrs on <html> (beta-safe)', ()=>{
   ev('setLook("classic")');
   if(html.getAttribute('data-look')!=='classic') throw new Error('data-look not classic');
   if(html.getAttribute('data-mood')) throw new Error('classic must not set data-mood: '+html.getAttribute('data-mood'));
 });

 check('setLook("aurora") applies data-look + data-mood', ()=>{
   ev('setLook("aurora")');
   if(html.getAttribute('data-look')!=='aurora') throw new Error('data-look not aurora');
   if(html.getAttribute('data-mood')!=='nebula') throw new Error('data-mood not applied: '+html.getAttribute('data-mood'));
 });

 check('setMood persists + applies; falls back to nebula for unknown', ()=>{
   ev('setLook("aurora"); setMood("dusk")');
   if(ev('state.auroraMood')!=='dusk') throw new Error('mood not saved');
   if(html.getAttribute('data-mood')!=='dusk') throw new Error('data-mood attr not dusk');
   ev('setMood("nope")');
   if(ev('state.auroraMood')!=='nebula') throw new Error('unknown mood should fall back to nebula');
 });

 check('dark/light axis stays independent of look', ()=>{
   ev('setLook("aurora"); setTheme("light")');
   if(html.getAttribute('data-theme')!=='light') throw new Error('theme axis broke');
   if(html.getAttribute('data-look')!=='aurora') throw new Error('look lost on theme change');
   ev('setTheme("dark")');
 });

 check('settings renders a look picker with classic + aurora', ()=>{
   ev('renderLayoutEditor()');
   const opts=[...doc.querySelectorAll('[data-look-opt]')].map(b=>b.getAttribute('data-look-opt'));
   if(!opts.includes('classic')||!opts.includes('aurora')) throw new Error('look options missing: '+JSON.stringify(opts));
 });

 check('clicking the Aurora look option switches state.look via UI', ()=>{
   ev('setLook("classic"); renderLayoutEditor()');
   const a=doc.querySelector('[data-look-opt="aurora"]'); if(!a) throw new Error('no aurora option');
   a.click();
   if(ev('state.look')!=='aurora') throw new Error('look not switched by UI');
 });

 check('mood picker shows chips when Aurora active; clicking sets the mood', ()=>{
   ev('setLook("aurora"); renderLayoutEditor()');
   const chips=[...doc.querySelectorAll('[data-mood-opt]')];
   if(chips.length<2) throw new Error('expected mood chips, got '+chips.length);
   const dusk=doc.querySelector('[data-mood-opt="dusk"]'); if(!dusk) throw new Error('no dusk chip');
   dusk.click();
   if(ev('state.auroraMood')!=='dusk') throw new Error('mood not set by UI');
   ev('setLook("classic"); setMood("nebula")'); // restore defaults
 });

 check('print stylesheet is not scoped to a look (prints plain regardless)', ()=>{
   const css=ev('document.querySelector("style").textContent');
   const printIdx=css.indexOf('@media print');
   if(printIdx<0) throw new Error('no @media print block');
   if(/data-look/.test(css.slice(printIdx))) throw new Error('print block must not depend on look');
 });

 console.log('\n=== RESULT:', errs.length?(errs.length+' ISSUE(S)'):'ALL CHECKS PASSED','===');
 if(errs.length) console.log(errs.join('\n'));
 process.exitCode=errs.length?1:0;
},150));
