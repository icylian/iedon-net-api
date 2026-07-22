# IEDON-NET-API (Peer API for DN42)

This is the API server designed for auto-peering for iEdon-Net and the DN42. Based on `Hono.js`.

## Structures

- **```app.js```**: Entry point
- **```routes.js```**: Define routes here
- **```./handlers```**: Handlers for each defined route in `routes.js`
- **```providers```**: Extendable basic components
- **```db```**: Sequelize Models and database context
- **```common```**: shared functions
- **```acorle-sdk```**: My personal internal tiny microservice integration. You can safely turn it off in config.js and just ignore it.

## Install

```bash
bun install
cd acorle-sdk
bun install
cd ..
cp ./config.default.js ./config.js
```

## Run dev

```bash
bun run dev # Using bun
```

## Run prod

```bash
bun run prod
```

## Docker Compose deployment

The Compose service bind-mounts the private runtime configuration from
`./config/config.js`. Create it once and keep database credentials and secrets
in that untracked file:

```bash
mkdir -p config
cp ./config.default.js ./config/config.js
cp ./.env.example ./.env
docker compose up -d --build
```

Public deployment values can be changed in `.env` without rewriting the
private `config/config.js`. The relevant variables are `NET_NAME`, `NET_DESC`,
`NET_ASN`, `KIOUBIT_OPENAUTH_ENABLED`, `KIOUBIT_OPENAUTH_DOMAIN`,
`KIOUBIT_OPENAUTH_NOT_ALLOWED_ASNS`, and the `CORS_ALLOW_*` variables.

On startup, untouched legacy database values from the original iEdon
deployment are migrated to the configured network values. Custom values are
left unchanged. Set `MIGRATE_LEGACY_NETWORK_SETTINGS=false` to disable this.

`KIOUBIT_OPENAUTH_NOT_ALLOWED_ASNS` is a comma-separated deny list. Its default
contains this network's own ASN for admin-account security. Set it to an empty
value only if Kioubit should also be allowed to authenticate AS4242422670.
