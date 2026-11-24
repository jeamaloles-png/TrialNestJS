# TrialNestJS GameHub API

NestJS API for NCFLogin/GameHub. It keeps the current username/password authentication and Riot game-stat endpoints, and adds an owner-scoped encrypted credential vault.

## GameHub features

- Create an account and sign in with a GameHub username and password. GameHub passwords are stored with bcrypt hashing.
- Add and remove games from a personal game list before saving credentials.
- Save, search, edit, reveal, and delete game-account usernames and passwords.
- Game-account passwords are encrypted by the API with AES-256-GCM before they are written to MySQL. They are decrypted only for the authenticated owner’s explicit reveal request. They are never included in the account list response.
- Search is scoped to the signed-in owner and matches game name, username, email, and notes. Password ciphertext is not searched.
- Removing a game from the selectable list keeps previously saved account records.

## MySQL setup

The API expects MySQL database `defaultdb`. Run [`database/gamehub-vault.sql`](database/gamehub-vault.sql) against that database once. The migration only creates the two new vault tables and does not change the existing user or Riot tables.

For a local setup, copy `.env.example` to `.env` and fill in the MySQL connection values. For Aiven, keep TLS enabled and set `DB_CA` to the downloaded service CA file. Never commit `.env`, database passwords, token secrets, or the vault key.

Generate a vault key with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set the resulting 64-character hex value as `VAULT_KEY` in the API's local `.env` and in the hosted NestJS service environment. Keep the same key anywhere that must decrypt the same database. Do not rotate it without first re-encrypting the saved passwords.

## Run and build

```powershell
npm ci
npm run build
npm run start:dev
```

The API uses the `PORT` supplied by Render or the local `.env` file. The existing frontend should set `NEXT_PUBLIC_API_BASE_URL` to this API's base URL.

## API routes

All `/vault` routes require `Authorization: Bearer <accessToken>`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/vault/games` | List the signed-in user's selectable games |
| POST | `/vault/games` | Add a game by name |
| DELETE | `/vault/games/:id` | Remove a game from the selectable list; saved accounts remain |
| GET | `/vault/accounts?q=...` | Search and list the signed-in user's accounts without passwords |
| POST | `/vault/accounts` | Save a username, password, and optional email/notes; password is encrypted |
| GET | `/vault/accounts/:id` | Explicitly reveal one owned account, including its decrypted password |
| PUT | `/vault/accounts/:id` | Update an owned account; blank password keeps the existing encrypted password |
| DELETE | `/vault/accounts/:id` | Delete an owned account |

The legacy `/RIOT`, `/LeagueOfLegend`, and `/Valorant` endpoints also require a token and scope data to the user in that token.
