# Admin Dashboard (React Website)

This folder contains a standalone React admin website (Vite + React) for Zoho endpoint operations.

## Features

- Separate admin web app from customer app.
- Integrates all backend Zoho routes from `/api/zoho/*`.
- Supports:
  - `GET`
  - `GET by id`
  - `POST`
- Query params and JSON body payload editor.
- Response formatter and status indicator.

## Run

From `my-app/admin-dashboard`:

```bash
npm install
npm run dev
```

Open:

`http://localhost:5173`

## Backend requirement

Start backend first:

```bash
cd ../backend
npm run dev
```

Default backend URL in dashboard:

`http://localhost:3001`

You can change the backend base URL in the dashboard input field.
