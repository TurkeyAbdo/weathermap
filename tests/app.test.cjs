const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
class Node {
  constructor() { this.children = []; this.events = {}; this.value = ''; this.hidden = true; this.textContent = ''; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() { this.focused = true; }
}
function setup(options = {}) {
  const nodes = new Map(); const requests = []; const saved = new Map(); let removed = 0;
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const store = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  let moveend; let popupOpened = 0;
  const map = { setView() { return this; }, getCenter: () => ({ equals: () => false }), once(event, callback) { moveend = callback; }, flyTo() {} };
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Node() },
    window: { localStorage: store, sessionStorage: store, matchMedia: () => ({ matches: options.reducedMotion !== false }) },
    navigator: { clipboard: { writeText: async text => { context.copied = text; } } },
    L: { map: () => map, tileLayer: () => ({ addTo() {} }), divIcon: x => x, marker: () => ({ addTo() { return this; }, bindPopup() { return this; }, openPopup() { popupOpened++; return this; }, remove() { removed++; } }) },
    URL, URLSearchParams, AbortSignal, setTimeout, console,
    fetch: async url => { requests.push(String(url)); return options.fetch ? options.fetch(url) : { ok: true, json: async () => [] }; }
  });
  if (options.noMap) delete context.L;
  vm.runInContext(source, context);
  return { get, requests, saved, context, finishMove: () => moveend(), popupOpened: () => popupOpened, removed: () => removed, run: code => vm.runInContext(code, context), click: id => get(id).events.click(), submit: id => get(id).events.submit({ preventDefault() {} }) };
}
const weather = { main: { temp: 29.4, humidity: 43, feels_like: 30 }, wind: { speed: 3.4 }, clouds: { all: 12 }, weather: [{ icon: '01d', description: 'clear sky' }], dt: 1700000000 };
test('no-key search guides setup without sending network requests', async () => {
  const app = setup(); app.get('search').value = 'Port Sudan'; await app.submit('search-form');
  assert.equal(app.requests.length, 0); assert.equal(app.get('settings').hidden, false); assert.match(app.get('status-text').textContent, /Connect/);
});
test('sample is labeled and replaces the previous marker', () => {
  const app = setup(); app.click('demo'); app.click('demo');
  assert.equal(app.run('state.current.sample'), true); assert.equal(app.removed(), 1); assert.match(app.get('status-text').textContent, /not current/);
});
test('sample sharing preserves the sample warning', async () => {
  const app = setup(); app.click('demo'); await app.run('shareWeather(state.current)'); assert.match(app.context.copied, /Sample weather — not live/);
});
test('favorites persist and can be removed', () => {
  const app = setup(); app.click('demo'); app.run('toggleFavorite(state.current.place)');
  assert.equal(app.run('state.favorites.length'), 1); assert.match(app.saved.get('weathermap.favorites'), /Khartoum/);
  app.run('toggleFavorite(state.current.place)'); assert.equal(app.run('state.favorites.length'), 0);
});
test('search geocodes before fetching live weather and restores controls', async () => {
  const app = setup({ fetch: async url => ({ ok: true, json: async () => String(url).includes('nominatim') ? [{ name: 'Port Sudan', display_name: 'Port Sudan, Sudan', lat: '19.6', lon: '37.2' }] : weather }) });
  app.run("state.key = 'a'.repeat(32)"); app.get('search').value = 'Port Sudan'; await app.submit('search-form');
  assert.match(app.requests[0], /nominatim/); assert.match(app.requests[1], /units=metric/);
  assert.equal(app.run('state.current.sample'), false); assert.equal(app.run('state.current.temp'), 29.4); assert.equal(app.get('search-button').disabled, false);
});
test('multiple matching places require a selection before weather fetch', async () => {
  const app = setup({ fetch: async () => ({ ok: true, json: async () => [1, 2].map(n => ({ name: `City ${n}`, display_name: `City ${n}`, lat: n, lon: n })) }) });
  app.run("state.key = 'a'.repeat(32)"); app.get('search').value = 'City'; await app.submit('search-form');
  assert.equal(app.requests.length, 1); assert.equal(app.get('result-list').children.length, 2); assert.equal(app.get('results').hidden, false);
});
test('unknown city and unauthorized key produce useful errors', async () => {
  const app = setup(); app.run("state.key = 'a'.repeat(32)"); app.get('search').value = 'Unknown'; await app.submit('search-form');
  assert.match(app.get('status-text').textContent, /No place found/);
  const invalid = setup({ fetch: async () => ({ ok: false, status: 401 }) }); invalid.run("state.key = 'a'.repeat(32)");
  await invalid.run("loadWeather({name:'Test', lat:1, lon:1})"); assert.match(invalid.get('status-text').textContent, /invalid or not active/); assert.equal(invalid.get('spinner').hidden, true);
});
test('offline requests restore loading state', async () => {
  const app = setup({ fetch: async () => { throw new TypeError('offline'); } }); app.run("state.key = 'a'.repeat(32)");
  await app.run("loadWeather({name:'Test', lat:1, lon:1})"); assert.match(app.get('status-text').textContent, /internet connection/); assert.equal(app.run('state.busy'), false);
});
test('weather details remain usable if map library fails', () => {
  const app = setup({ noMap: true }); app.click('demo'); assert.equal(app.get('map-fallback').hidden, false); assert.equal(app.get('weather-summary').hidden, false);
});
test('invalid keys are rejected without persistence', () => {
  const app = setup(); app.get('api-key').value = 'invalid'; app.submit('key-form'); assert.equal(app.run('state.key'), ''); assert.equal(app.saved.size, 0);
});
test('animated map opens popup only after motion ends', () => {
  const app = setup({ reducedMotion: false }); app.click('demo');
  assert.equal(app.popupOpened(), 0); app.finishMove(); assert.equal(app.popupOpened(), 1);
});
test('malformed geocoding entries are ignored without breaking valid results', async () => {
  const app = setup({ fetch: async () => ({ ok: true, json: async () => [null, {}, { display_name: 'Invalid', lat: 100, lon: 0 }, { display_name: 'Blank', lat: '', lon: '' }, { display_name: 'Khartoum, Sudan', lat: '15.5', lon: '32.5' }] }) });
  const places = await app.run("geocode('Khartoum')");
  assert.equal(places.length, 1); assert.equal(places[0].name, 'Khartoum');
});
test('blocked native sharing falls back to copying weather', async () => {
  const app = setup(); app.click('demo');
  app.context.navigator.share = async () => { throw new Error('Not supported'); };
  await app.run('shareWeather(state.current)');
  assert.match(app.context.copied, /Khartoum/); assert.match(app.get('status-text').textContent, /copied/);
});
test('canceling native sharing does not overwrite the clipboard', async () => {
  const app = setup(); app.click('demo');
  app.context.navigator.share = async () => { const error = new Error('Canceled'); error.name = 'AbortError'; throw error; };
  await app.run('shareWeather(state.current)'); assert.equal(app.context.copied, undefined);
});
