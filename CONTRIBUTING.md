# Working on WeatherMap

## Before changing the application

Use Node.js 22 or newer for development checks. No dependency installation or build is required. Run `npm run validate` to check JavaScript syntax and execute all tests.

Keep application HTML, CSS, and JavaScript separate. Use native JavaScript and DOM events; do not introduce a rendering framework or inline event handlers. Keep Roboto and readable text sizes, and avoid decorative copy.

## Verify a change

1. Run `npm run validate`.
2. Serve the folder over HTTP and open it in a browser.
3. Test a city search using your own API key, including selecting between multiple matches.
4. Check an unknown place and a failed network request; controls should become usable again.
5. Check saved places, sharing, and a narrow window. Weather popups must remain readable without horizontal scrolling.
6. Confirm that any sample data is labeled and no credentials are added to source files, screenshots, or commits.

## Commit and publish

Make one focused commit per meaningful change. Describe the resulting behavior in the message. Push to main to let GitHub Pages publish the updated static files. If changing CSS or JavaScript, update their version query strings in index.html so returning browsers fetch the new files. Validate the deployed page after GitHub Pages finishes.

Never include API keys, passwords, or personal account information in Git history. Configure weather access through the app's API settings instead.
