// Wizard quick-win fixes regression test.
// Covers: ensureFontLoaded always returns a thenable + look step wires w/o throwing;
// dead display-design step removed; iems step yes/no opt-out; stage vs stage-layout
// step titles are distinct.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const htmlPath = process.env.SA_HTML || require('path').join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const errs = [];
const jsdomErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => jsdomErrors.push((e.detail && e.detail.message) || e.message));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
  beforeParse(w) {
    w.structuredClone = w.structuredClone || (v => v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => 'x';
    if (!w.crypto) w.crypto = {};
    if (!w.crypto.randomUUID) w.crypto.randomUUID = () => 'x' + Math.random().toString(16).slice(2);
    w.Element.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 800, height: 380, right: 800, bottom: 380, x: 0, y: 0, toJSON() {} }; };
    w.Element.prototype.setPointerCapture = function () {};
    w.Element.prototype.releasePointerCapture = function () {};
  }
});
const { window, window: { document } } = dom;
const ev = c => window.eval(c);
function check(l, f) { try { f(); console.log('  OK  ', l); } catch (e) { console.log('  FAIL', l, '->', e.message); errs.push(l); } }

window.addEventListener('load', () => setTimeout(() => {
  ev('toast=function(){};renderAll=function(){};');

  // --- B1: ensureFontLoaded always returns a thenable ---
  check('ensureFontLoaded returns a thenable for a loaded font', () => {
    const r = ev("ensureFontLoaded('Inter')");
    if (!r || typeof r.then !== 'function') throw new Error('not thenable');
  });
  check('ensureFontLoaded returns a thenable for falsy font', () => {
    const r = ev('ensureFontLoaded()');
    if (!r || typeof r.then !== 'function') throw new Error('not thenable');
  });

  // --- B1: look step wires w/o throwing ---
  const errCountBefore = jsdomErrors.length;
  ev("startWizard(); wizardStepIdx=WIZARD_STEPS.indexOf('look'); renderWizardStep();");
  check('look step renders + wires without a jsdomError', () => {
    if (jsdomErrors.length !== errCountBefore) throw new Error('jsdomError raised: ' + jsdomErrors.slice(errCountBefore).join('; '));
  });
  check('look step wires a known control (font picker present)', () => {
    if (!document.querySelector('#wiz_font_picker')) throw new Error('no #wiz_font_picker');
  });

  // --- Dead display-design step removed ---
  check('display-design no longer appears anywhere in the source', () => {
    if (/display-design/.test(html)) throw new Error('display-design still present in source');
  });

  // --- IEM opt-out toggle ---
  ev("startWizard(); wizardStepIdx=WIZARD_STEPS.indexOf('iems');");
  check('iems step renders a yes/no toggle (data-wiems)', () => {
    ev('renderWizardStep();');
    if (!document.querySelector('[data-wiems="yes"]') || !document.querySelector('[data-wiems="no"]')) throw new Error('no yes/no toggle');
  });
  check('iems default (useIems!==false) shows the IEM pack config', () => {
    ev('wizardData.useIems=true; renderWizardStep();');
    if (!document.querySelector('.wiz-iem-list')) throw new Error('IEM config not shown by default');
  });
  check('iems opt-out (useIems=false) hides the IEM pack config', () => {
    ev('wizardData.useIems=false; renderWizardStep();');
    if (document.querySelector('.wiz-iem-list')) throw new Error('IEM config still shown when opted out');
  });

  // --- Distinct stage step titles ---
  let stageTitle = '', layoutTitle = '';
  ev("startWizard(); wizardStepIdx=WIZARD_STEPS.indexOf('stage'); renderWizardStep();");
  stageTitle = (document.querySelector('.wiz-q-title') || {}).textContent || '';
  ev("wizardStepIdx=WIZARD_STEPS.indexOf('stage-layout'); renderWizardStep();");
  layoutTitle = (document.querySelector('.wiz-q-title') || {}).textContent || '';
  check('stage and stage-layout steps have DIFFERENT titles', () => {
    if (!stageTitle.trim() || !layoutTitle.trim()) throw new Error('missing title(s): ' + JSON.stringify([stageTitle, layoutTitle]));
    if (stageTitle.trim() === layoutTitle.trim()) throw new Error('titles identical: ' + stageTitle);
  });

  console.log('\n=== RESULT:', errs.length ? (errs.length + ' ISSUE(S)') : 'ALL CHECKS PASSED', '===');
  if (errs.length) console.log(errs.join('\n'));
}, 150));
