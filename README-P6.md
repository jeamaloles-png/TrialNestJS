# P6 Riot REST API

This is your existing NestJS backend. It keeps the current `/users` and `/auth` routes and adds CRUD endpoints for the MySQL tables `RIOT`, `LeagueOfLegend`, and `Valorant` in `defaultdb`.

## Run locally

Open a terminal in this Backend folder and run:

```powershell
npm run start:dev
```

Your project already has dependencies installed. The existing `.env` contains your database and token settings. Keep it private and use your own Aiven credentials there. Check that `DB_NAME=defaultdb`, and TLS is enabled and certificate validation is on. Download your service CA certificate from Aiven, save it in this Backend folder as `ca.pem`, and add `DB_CA=ca.pem` to `.env`. The certificate file is ignored by Git. For a local MySQL server without TLS only, set `DB_SSL=false`. The API listens on the port in `PORT` (the assignment expects 3000).

## Routes

| Method | Route | Use |
| --- | --- | --- |
| GET | `/` | Welcome response |`r`n| GET | `/health` | Read-only database connection check |
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Get JWT access and refresh tokens |
| GET | `/users` | List users (Bearer token required) |
| GET | `/users/:id` | Get a user (Bearer token required) |
| POST | `/users` | Create a user |
| PUT | `/users/:id` | Update a user (Bearer token required) |
| DELETE | `/users/:id` | Delete a user (Bearer token required) |
| GET | `/health` | Check the database connection |`r`n| GET | `/:table/schema` | Inspect one game table's columns |
| GET | `/:table` | Read all records |
| GET | `/:table/:id` | Read a record |
| POST | `/:table` | Create a record |
| PUT | `/:table/:id` | Update a record |
| DELETE | `/:table/:id` | Delete a record |

For the last six routes, `:table` is `RIOT`, `LeagueOfLegend`, or `Valorant` (capitalization matters). User CRUD remains protected by the existing JWT guard except registration/create. For protected requests, send `Authorization: Bearer <accessToken>`.

## Foreign-key order

Create a user first, then its RIOT row using that user's ID, then League of Legends or Valorant rows using the RIOT row's ID. The database will reject references to missing parent rows. Deleting a user or RIOT row cascades to linked rows per your foreign keys. Use disposable records for the DELETE requests.

## Postman screenshots

Import `postman/P6-Riot-API.postman_collection.json`. Run Register, Login, then use the returned access token for user CRUD. For each of the three game tables, run POST, GET all, GET by ID, PUT, GET again, and DELETE. Set the collection's ID variables to the IDs returned from POST. Capture the request method and URL together with the response status and body. Capture source code in `src/games/games.controller.ts` and `src/games/games.service.ts`.



