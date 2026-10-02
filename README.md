# Hellha Backend

Backend API for the Hellha graduation project.

## Technologies

- Node.js
- Express
- PostgreSQL
- Firebase Admin SDK

## Setup

Install dependencies:

npm install

Create `.env` based on `.env.example`.

Set `CORS_ORIGIN` to the browser origins allowed to call the API. Separate
multiple origins with commas. The development default is
`http://localhost:8080`, which can be used with Flutter Web by choosing port
8080. Set the deployed web application's HTTPS origin in production.

Native Flutter applications do not use the browser CORS security model, so
Android, iOS, and desktop API calls are not restricted by this setting.

### Firebase Admin credentials

For local development, place the Firebase service-account JSON in the ignored
`secrets/` directory and set `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`. Never
commit the JSON file or copy its private key into source code.

In production, set `NODE_ENV=production` and use Application Default
Credentials supplied by the hosting platform. A platform may alternatively
set `GOOGLE_APPLICATION_CREDENTIALS` to a credential file stored outside the
repository. `FIREBASE_SERVICE_ACCOUNT_PATH` is intentionally local-only.

Run development server:

npm run dev

## Database migrations

Apply pending migrations using the database configured in `.env`:

```bash
npm run migrate
```

Applied migration filenames are recorded in `schema_migrations`. Existing
users are preserved; the baseline migration creates the current schema only
when it is missing.

## Tests

Run the backend test suite:

```bash
npm test
```

The test suite uses mocks and does not connect to Firebase or PostgreSQL.

## Production HTTPS

The Node.js process intentionally serves HTTP on its internal `PORT`. In
production, terminate TLS at a managed hosting provider, load balancer, or
reverse proxy such as Nginx. The public API URL exposed to clients must use
HTTPS.

Production deployment checklist:

1. Provision the TLS certificate at the proxy or hosting provider. Do not add
   certificates or private keys to this repository.
2. Proxy HTTPS traffic to the private Node.js port and forward `Host`,
   `X-Forwarded-Proto`, and `X-Forwarded-For` headers.
3. Redirect public HTTP traffic to HTTPS at the proxy or provider.
4. Set `CORS_ORIGIN` to the deployed Flutter Web HTTPS origin. Native Flutter
   clients are not governed by browser CORS.
5. Configure production database and Firebase credentials in the hosting
   environment, run `npm run migrate`, then run `npm start`.
6. Verify `https://<api-host>/api/health` before releasing the client.

An Nginx deployment should proxy its HTTPS server block to the application,
for example `http://127.0.0.1:3000`. Certificate paths and TLS policy belong in
the server's deployment configuration, outside Git.

## API

GET /api/health

POST /api/users/sync

GET /api/users/me

Protected routes require a Firebase ID Token.
