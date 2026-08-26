# PPG Guess UI

React interface for searching Prabhat Panel number sequences and displaying the analysis from `PanelController`.

## Run locally

Start the API on `http://localhost:5288`, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, enter a comma-separated sequence such as `2,1,9`, and click **Run Analysis**.

## API environments

Use the **API environment** selector in the page header to switch every request between:

- **Development** — `http://localhost:5288` through the Vite development proxy.
- **Production** — `https://ppgguessapi-a2gbfjgva2gnancn.centralindia-01.azurewebsites.net`.

The selection is saved in the browser. Development is the default for `npm run dev`, while
Production is the default for production builds.

Select **AIG Pattern** and use **AIG Series Days** to choose how many latest valid daily values
from Current Data are sent to `/api/pattern-prediction`. The default is 30; enter another positive
whole number such as 40, or leave it blank to send all available values. After the analysis
completes, use **Pattern Response** to view the Gemini result in its pattern group. Selecting AIG
transmits the selected Current Data values to the configured Gemini service.

Select **AIG Deep Pattern** to run walk-forward validation over the same Current Data series. It
forecasts each known next digit using only the preceding values, checks that forecast against the
actual digit, and applies the strongest recently validated rule to the final digit. Both AIG modes
return three unique predictions ranked strongest first.

To override an endpoint or the default selection, create `.env.local` with any of these settings:

```text
VITE_DEVELOPMENT_API_BASE_URL=http://your-development-api-host
VITE_PRODUCTION_API_BASE_URL=https://your-production-api-host
VITE_DEFAULT_API_ENVIRONMENT=development
```

`VITE_API_BASE_URL` remains supported as an alias for the Development endpoint.
