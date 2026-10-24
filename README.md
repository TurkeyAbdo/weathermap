# WeatherMap

A responsive single-page weather atlas for Advanced Web Technologies. Built with semantic HTML, CSS, vanilla JavaScript, Leaflet 1.9.4, OpenStreetMap and OpenWeatherMap. No build step or backend.

## Run locally

Open a terminal in this folder and run `python -m http.server 8080`, then visit http://localhost:8080. Alternatively use VS Code Live Server. An HTTP server is recommended instead of opening index.html directly, so map services receive an identifying browser Referer and browser APIs work properly.

## Get an OpenWeatherMap key

1. Register at https://home.openweathermap.org/users/sign_up and verify your email.
2. Visit https://home.openweathermap.org/api_keys and copy your API key. Use the Current Weather Data service; a paid One Call subscription is not required for this application.
3. Allow a few hours for a new key to activate if requests return HTTP 401.
4. In WeatherMap, open **API settings**, paste the key, and select **Connect**.
5. Search for a place, choose a match if needed, and view its weather.

The key is kept in sessionStorage for the current browser tab, not in source control. Browser-side keys are visible in network requests. Use a dedicated key and monitor its usage. Clearing the key removes the locally stored value. No key is bundled with this project.

## Features

- User-triggered geocoding with Nominatim; multiple results allow precise location selection.
- Sequential async/await requests: location → coordinates → OpenWeather current weather.
- Map initialized at Khartoum (15.5007, 32.5599), zoom 6; 70vh map height.
- Smooth centering, one marker at a time, rich weather popup, and accessible equivalent weather details outside the map.
- Celsius temperature, humidity, wind in m/s, cloud coverage, weather description and official weather icon.
- Loading indicator, timeouts and friendly errors for missing keys, unknown places, connection failures, invalid credentials and rate limits.
- Up to ten favorite places in localStorage, with removal controls.
- Native Web Share with clipboard fallback. Share text identifies sample data when applicable.
- Optional browser geolocation, explicit permission requested only after clicking its button.
- A clearly labeled, fixed Khartoum sample for preview without an API key. Samples are never presented as live observations; saved sample places fetch live weather when selected.
- Responsive layout, keyboard focus states, reduced-motion support and safe text-based rendering of API content.

## Project structure

- `index.html`: semantic structure and linked dependencies.
- `styles.css`: all authored presentation and responsive rules.
- `app.js`: API requests, map lifecycle, storage, rendering and events.
- `tests/app.test.cjs`: dependency-free integration tests using mocked browser, map and network interfaces.

Run checks with `node --check app.js` and `node --test tests/app.test.cjs`.

## API and map policies

- Weather: https://openweathermap.org/current — JSON, `units=metric`.
- Geocoding: https://nominatim.openstreetmap.org/search — explicit submitted searches only, cached for this page session and spaced at least 1.1 seconds apart in each tab. No autocomplete queries. This public service is suitable for a modest classroom demo; its overall application limit is one request/second across all users. For broader deployment, use a provider supporting your traffic volume and update the endpoint in `geocode`.
- Geocoding policy: https://operations.osmfoundation.org/policies/nominatim/
- Map tiles: https://tile.openstreetmap.org with visible contributor attribution. No bulk downloads or prefetching. Policy: https://operations.osmfoundation.org/policies/tiles/
- Leaflet: https://leafletjs.com/examples/quick-start/
- Fonts: Google Fonts DM Sans and Manrope.

The map library generates its own positioning styles; application HTML contains no inline styles or event handlers. External services and fonts require internet access.

## GitHub Pages submission

1. Create a GitHub repository and push this folder to its `main` branch.
2. Open repository **Settings → Pages**.
3. Choose **Deploy from a branch**, select **main** and **/ (root)**, then Save.
4. Once published, put the actual live URL and repository URL below.
5. Review and understand the code before submitting. Follow your course's rules on assistance and attribution. Keep meaningful commits as you develop and revise your work; do not fabricate commit history.

Repository URL: https://github.com/TurkeyAbdo/weathermap

Live demo URL: https://turkeyabdo.github.io/weathermap/

## Manual acceptance checks

Search Port Sudan with an active key; confirm marker, popup, weather icon and all metrics. Search an unknown place; confirm a helpful error. Try an inactive key; confirm the 401 message. Check multiple matching cities, slow/offline network, saving/removing favorites, persistence after refresh, sharing/copying, geolocation allowed/declined, narrow screens and keyboard navigation. Network requests should not reload the document.

## Specification clarification

The specification replaces the legacy Facebook requirement but mentions it again on the last page. This application implements the Share Weather button through the Web Share API or clipboard, as described in the modern bonus section. Confirm with your instructor if a dedicated Facebook button is expected. The PDF states a 2024 deadline; confirm the current course deadline separately.
