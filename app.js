'use strict';

const $ = (id) => document.getElementById(id);
const storage = {
  get(store, key, fallback) { try { return JSON.parse(window[store].getItem(key)) ?? fallback; } catch { return fallback; } },
  set(store, key, value) { try { window[store].setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
};
const state = {
  key: storage.get('sessionStorage', 'weath map.key', ''),
  favorites: storage.get('localStorage', 'weathermap.favorites', []),
  map: null, marker: null, current: null, busy: false, lastSearch: 0, cache: new Map()
};
if (typeof state.key !== 'string') state.key = '';
if (!Array.isArray(state.favorites)) state.favorites = [];
state.favorites = state.favorites.filter(p => p && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon)).slice(0, 10);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function status(message, error = false) {
  $('status-text').textContent = message;
  $('status').classList.toggle('error', error);
}
function busy(value) {
  state.busy = value;
  $('spinner').hidden = !value;
  ['search-button', 'locate', 'demo'].forEach(id => { $(id).disabled = value; });
  $('search-form').setAttribute('aria-busy', String(value));
}
function settings(open) {
  $('settings').hidden = !open;
  $('settings-toggle').setAttribute('aria-expanded', String(open));
}
function keyStatus() {
  $('key-status').textContent = state.key ? 'Key connected for this tab. Search a place to check live weather.' : 'No key connected. Explore the map or try the sample.';
}
async function fetchJSON(url) {
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000) }); }
  catch (error) { throw new Error(error.name === 'TimeoutError' ? 'The request took too long. Please try again.' : 'Could not connect. Check your internet connection and try again.'); }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your weather API key is invalid or not active yet. Check API settings; new keys can take a few hours to activate.');
    if (response.status === 429) throw new Error('The service is receiving too many requests. Please wait a moment and try again.');
    throw new Error(`The service could not complete this request (${response.status}). Please try again.`);
  }
  try { return await response.json(); } catch { throw new Error('The service returned an unreadable response. Please try again.'); }
}
async function geocode(query) {
  const cached = state.cache.get(query.toLowerCase());
  if (cached) return cached;
  const delay = 1100 - (Date.now() - state.lastSearch);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  state.lastSearch = Date.now();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', addressdetails: '1' });
  const data = await fetchJSON(url);
  if (!Array.isArray(data)) throw new Error('The location service returned an unexpected response.');
  const places = data.map(p => ({ name: p.name || p.display_name.split(',')[0], label: p.display_name, lat: Number(p.lat), lon: Number(p.lon) })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!places.length) throw new Error('No place found. Try adding a country, or check the spelling.');
  state.cache.set(query.toLowerCase(), places);
  return places;
}
function requireKey() {
  if (state.key) return true;
  settings(true);
  status('Connect your free OpenWeatherMap key in API settings, or explore the sample.', true);
  $('api-key').focus();
  return false;
}
async function loadWeather(place) {
  if (state.busy || !requireKey()) return;
  busy(true);
  status(`Checking weather in ${place.name}…`);
  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.search = new URLSearchParams({ lat: place.lat, lon: place.lon, appid: state.key, units: 'metric' });
    const data = await fetchJSON(url);
    if (!data.main || !Number.isFinite(data.main.temp) || !data.weather?.[0] || !Number.isFinite(data.wind?.speed) || !Number.isFinite(data.main.humidity) || !Number.isFinite(data.clouds?.all)) throw new Error('Weather data is incomplete for this place. Please try another location.');
    renderWeather({ place, temp: data.main.temp, feels: data.main.feels_like, humidity: data.main.humidity, wind: data.wind.speed, clouds: data.clouds.all, description: data.weather[0].description, icon: data.weather[0].icon, observed: data.dt * 1000, sample: false });
    $('results').hidden = true;
    status(`Weather updated for ${place.name}.`);
  } catch (error) { status(error.message, true); }
  finally { busy(false); }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function samePlace(a, b) { return Math.abs(a.lat - b.lat) < .001 && Math.abs(a.lon - b.lon) < .001; }
function isFavorite(place) { return state.favorites.some(p => samePlace(p, place)); }
function weatherCard(weather) {
  const card = element('div', 'weather-card');
  card.append(element('div', 'weather-kicker', weather.sample ? 'SAMPLE / NOT LIVE WEATHER' : 'CURRENT CONDITIONS'));
  card.append(element('h2', '', weather.place.name));
  const main = element('div', 'weather-main');
  main.append(element('span', 'temperature', `${Math.round(weather.temp)}°C`));
  if (/^\d{2}[dn]$/.test(weather.icon)) {
    const icon = element('img');
    icon.src = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`;
    icon.alt = weather.description;
    icon.width = 76; icon.height = 76;
    main.append(icon);
  }
  card.append(main, element('p', 'weather-description', weather.description));
  const metrics = element('dl', 'weather-metrics');
  [['Humidity', `${weather.humidity}%`], ['Wind', `${weather.wind.toFixed(1)} m/s`], ['Clouds', `${weather.clouds}%`]].forEach(([label, value]) => {
    const item = element('div'); item.append(element('dt', '', label), element('dd', '', value)); metrics.append(item);
  });
  card.append(metrics);
  const actions = element('div', 'weather-actions');
  const save = element('button', 'secondary', isFavorite(weather.place) ? '✓ Saved place' : '♡ Save place');
  save.type = 'button'; save.setAttribute('aria-pressed', String(isFavorite(weather.place)));
  save.addEventListener('click', () => toggleFavorite(weather.place));
  const share = element('button', 'primary', 'Share weather ↗'); share.type = 'button';
  share.addEventListener('click', () => shareWeather(weather));
  actions.append(save, share); card.append(actions);
  card.append(element('p', 'weather-time', weather.sample ? 'Illustrative data for preview only.' : `Observed ${new Date(weather.observed).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`));
  return card;
}
function renderWeather(weather) {
  state.current = weather;
  $('weather-summary').replaceChildren(weatherCard(weather));
  $('weather-summary').hidden = false;
  const { lat, lon } = weather.place;
  $('map-coordinates').textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  if (state.map) {
    if (state.marker) state.marker.remove();
    const icon = L.divIcon({ className: 'weather-pin', html: `${Math.round(weather.temp)}°`, iconSize: [44, 44], iconAnchor: [22, 22] });
    state.marker = L.marker([lat, lon], { icon, title: weather.place.name }).addTo(state.map);
    state.marker.bindPopup(weatherCard(weather), { maxWidth: 310, autoPan: true }).openPopup();
    state.map.flyTo([lat, lon], 10, { animate: !reducedMotion, duration: 1.1 });
  }
}
function persistFavorites() {
  if (!storage.set('localStorage', 'weathermap.favorites', state.favorites)) status('Your browser could not save favorites. They will remain available until you close this page.', true);
  renderFavorites();
  if (state.current) renderWeather(state.current);
}
function toggleFavorite(place) {
  if (isFavorite(place)) state.favorites = state.favorites.filter(p => !samePlace(p, place));
  else {
    if (state.favorites.length >= 10) { status('You can save up to 10 places. Remove one to make room.', true); return; }
    state.favorites.push(place);
  }
  persistFavorites();
}
function renderFavorites() {
  $('favorites').replaceChildren();
  $('favorite-count').textContent = `${state.favorites.length} SAVED`;
  $('favorites-empty').hidden = state.favorites.length > 0;
  state.favorites.forEach(place => {
    const row = element('div', 'favorite-row');
    const city = element('button', 'secondary favorite-city', place.name); city.type = 'button';
    city.addEventListener('click', () => { $('search').value = place.name; loadWeather(place); });
    const remove = element('button', 'secondary remove-favorite', '×'); remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${place.name} from favorites`);
    remove.addEventListener('click', () => { state.favorites = state.favorites.filter(p => !samePlace(p, place)); persistFavorites(); });
    row.append(city, remove); $('favorites').append(row);
  });
}
async function shareWeather(weather) {
  const prefix = weather.sample ? '[Sample weather — not live] ' : '';
  const text = `${prefix}${weather.place.name}: ${Math.round(weather.temp)}°C, ${weather.description}. Humidity ${weather.humidity}%, wind ${weather.wind.toFixed(1)} m/s, clouds ${weather.clouds}%. Via WeatherMap.`;
  try {
    if (navigator.share) { await navigator.share({ title: 'WeatherMap', text }); status('Weather shared.'); }
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); status('Weather copied. Paste it into your favorite app.'); }
    else { status('Sharing is unavailable here. Open this page over HTTPS or localhost.', true); }
  } catch (error) { if (error.name !== 'AbortError') status('Could not share weather. Please check browser permissions.', true); }
}
$('search-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy) return;
  const query = $('search').value.trim();
  if (!query) { status('Enter a city, address, or place first.', true); $('search').focus(); return; }
  if (!requireKey()) return;
  busy(true); $('results').hidden = true; status(`Finding ${query}…`);
  let places;
  try { places = await geocode(query); } catch (error) { status(error.message, true); }
  finally { busy(false); }
  if (!places) return;
  if (places.length === 1) { await loadWeather(places[0]); return; }
  $('result-list').replaceChildren();
  places.forEach(place => {
    const button = element('button', 'secondary result-choice', place.label); button.type = 'button';
    button.addEventListener('click', () => loadWeather(place)); $('result-list').append(button);
  });
  $('results').hidden = false; status('Several places match. Choose the one you mean.');
});
$('settings-toggle').addEventListener('click', () => settings($('settings').hidden));
$('key-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('api-key').value.trim();
  if (!/^[a-f\d]{32}$/i.test(key)) { $('key-status').textContent = 'Enter the 32-character API key from your OpenWeather account.'; return; }
  state.key = key;
  const saved = storage.set('sessionStorage', 'weath map.key', key);
  $('api-key').value = ''; keyStatus();
  if (!saved) $('key-status').textContent = 'Key connected for this page only. Browser session storage is unavailable.';
  status('Connected. Search for a place to get live weather.');
});
$('clear-key').addEventListener('click', () => { state.key = ''; storage.set('sessionStorage', 'weath map.key', ''); $('api-key').value = ''; keyStatus(); status('API key cleared.'); });
$('demo').addEventListener('click', () => {
  renderWeather({ place: { name: 'Khartoum', label: 'Khartoum, Sudan', lat: 15.5007, lon: 32.5599 }, temp: 33, feels: 32, humidity: 22, wind: 4.1, clouds: 8, description: 'clear sky', icon: '01d', observed: 0, sample: true });
  status('You are viewing sample data, not current weather. Connect an API key for live results.');
});
$('locate').addEventListener('click', () => {
  if (state.busy || !requireKey()) return;
  if (!navigator.geolocation) { status('Location is unavailable in this browser. Search for a city instead.', true); return; }
  busy(true); status('Waiting for your location permission…');
  navigator.geolocation.getCurrentPosition(position => {
    busy(false);
    loadWeather({ name: 'Your location', lat: position.coords.latitude, lon: position.coords.longitude });
  }, error => { busy(false); status(error.code === 1 ? 'Location permission was declined. You can search for a city instead.' : 'Could not find your location. Try searching for a city.', true); }, { timeout: 12000, maximumAge: 300000 });
});
if (typeof L !== 'undefined') {
  state.map = L.map('map', { scrollWheelZoom: false }).setView([15.5007, 32.5599], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.map);
} else { $('map-fallback').hidden = false; status('Map library did not load. Check your connection. You can still view weather details below.', true); }
keyStatus(); renderFavorites(); settings(!state.key);
