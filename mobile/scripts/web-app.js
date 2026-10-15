// Loads the current web app's logic (../js) into a sandbox so the new TypeScript core can be checked
// against it, and its data exported. Only logic files are loaded; storage is an in-memory stand-in.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', '..', 'js');
const FILES = [
  'data/default-plan.js', 'data/exercises.js', 'data/plans.js', 'state.js', 'helpers.js', 'storage.js',
  'workout-data.js', 'records.js', 'profile.js', 'history.js', 'progress.js', 'plan.js', 'ai-plan.js', 'backup.js'
];

// A Date whose "now" is fixed, so date-dependent answers can be compared
function fixedDate(nowMs) {
  const Real = Date;
  return class extends Real {
    constructor(...args) { super(...(args.length ? args : [nowMs])); }
    static now() { return nowMs; }
  };
}

// store: localStorage contents as { key: string }. now: the time the web app sees.
// fields: form fields by id, as { value }. stubs: replacements for UI functions the logic calls.
function loadWebApp({ store = {}, now = Date.now(), fields = {}, stubs = {} } = {}) {
  const stub = () => null;
  const storage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  // Object.keys(localStorage) lists the stored keys, as in a browser
  const localStorage = new Proxy(storage, {
    ownKeys: () => Object.keys(store),
    getOwnPropertyDescriptor: (t, k) => (Object.prototype.hasOwnProperty.call(store, k) ? { enumerable: true, configurable: true, value: store[k] } : undefined)
  });
  // Any page element: every property and call returns another stand-in, so set-up code at load time is harmless
  const element = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : element), set: () => true, apply: () => element });
  const ctx = vm.createContext({
    localStorage,
    document: { getElementById: id => fields[id] || element, querySelector: () => element, querySelectorAll: () => [], addEventListener: stub },
    window: {}, navigator: {}, console, setTimeout: stub, clearTimeout: stub, setInterval: stub,
    Date: fixedDate(now)
  });
  const source = FILES.map(f => fs.readFileSync(path.join(WEB, f), 'utf8')).join('\n;\n') +
    // Top-level const/let live in the script scope, not on the global object; this reads them
    '\n;globalThis.__eval = s => eval(s);';
  vm.runInContext(source, ctx, { filename: 'web-app.js' });
  // UI calls made by logic functions (saving history refreshes the header, for example). Applied after
  // loading, so they win over the web app's own definitions.
  Object.assign(ctx, {
    updateStats: stub, renderBackupBadge: stub, haptic: stub, showToast: stub, initNav: stub, renderWorkout: stub,
    updateHeader: stub, renderSettings: stub, reportTextError: stub
  }, stubs);
  return { ctx, get: name => ctx.__eval(name), run: code => ctx.__eval(code), store };
}

module.exports = { loadWebApp };
