# Admin API Documentation

## Swagger / OpenAPI

The Admin API is fully documented with Swagger/OpenAPI. Use it to explore endpoints, view request/response schemas, and test the API interactively.

### Accessing Swagger Locally

1. **Start the API** (with `NODE_ENV` not set to `production`):

   ```bash
   pnpm run start:dev
   ```

2. **Open Swagger UI** in your browser:

   ```
   http://localhost:3000/admin/docs
   ```

3. **Export the OpenAPI spec** (JSON):

   ```
   http://localhost:3000/admin/docs-json
   ```

### Authentication

All Admin API endpoints require a Bearer JWT. To authenticate in Swagger UI:

1. Log in via `POST /auth/login` with an admin user's credentials.
2. Copy the `accessToken` from the response.
3. Click **Authorize** in Swagger UI.
4. Enter `Bearer <your-access-token>` (or just the token; Swagger adds "Bearer").
5. Click **Authorize**, then **Close**.

You can now try endpoints; the token is sent automatically.

### Production

Swagger UI and the JSON spec are **disabled in production** (`NODE_ENV=production`). The `/admin/docs` and `/admin/docs-json` routes return 404.

To expose docs in production, you would need to add a separate auth layer (e.g. HTTP Basic Auth or API key) in front of these routes.
