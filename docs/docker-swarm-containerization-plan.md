# ReliefConnect Docker Swarm Containerization Plan

Last updated: 2026-05-14

## 0. How To Read This Document

This document is written for someone applying Docker Swarm for the first time.

You do not need to understand every advanced topic before starting. Read it in this order:

1. Read sections 0 to 3 to understand the idea.
2. Read section 4 to see which files will be added.
3. Follow sections 5 to 10 when implementing the files.
4. Follow sections 16 to 18 when testing and deploying.
5. Keep sections 21 and 22 open when something fails.

The shortest working path is:

```text
Build images
  -> push images to a registry
  -> create Swarm secrets
  -> deploy docker-stack.yml
  -> test /health and the web app
```

Do not start by scaling to many API replicas. Get one API replica working first, then improve.

## 0.1 Basic Docker Terms

| Term | Simple meaning | ReliefConnect example |
| --- | --- | --- |
| Dockerfile | Recipe for building an image | `src/ReliefConnect.API/Dockerfile` builds the API image. |
| Image | Packaged application and runtime | `reliefconnect-api:1.0.0` or `reliefconnect-web:1.0.0`. |
| Container | A running image | One running API process or one running Nginx frontend. |
| Registry | Place where images are stored | GHCR, Docker Hub, or a private registry. |
| Volume | Persistent/shared filesystem data | Only needed if you keep local `/uploads`. |
| Network | Private communication between containers | `web` talks to `api` over an overlay network. |
| Secret | Sensitive value managed by Swarm | Database password, JWT key, SMTP password. |
| Service | Desired running state in Swarm | "Run 1 API container" or "run 2 web containers". |
| Task | One container instance created by a service | If `web` has 2 replicas, Swarm creates 2 tasks. |
| Stack | A group of services deployed together | `reliefconnect` stack contains `web` and `api`. |
| Manager node | Swarm node that accepts deploy commands | Run `docker stack deploy` from a manager. |
| Worker node | Swarm node that runs containers | Workers receive tasks from managers. |
| Overlay network | Swarm network across multiple nodes | Lets `web` reach `api` even on different servers. |
| Routing mesh | Swarm's public port routing layer | Any node can accept traffic for a published service. |

## 0.2 Docker Compose vs Docker Swarm

Docker Compose is usually for one machine. Docker Swarm is for one or more machines that act like a small cluster.

This project should use Swarm because you said the production goal is Docker Swarm.

Important difference:

| Topic | Docker Compose | Docker Swarm |
| --- | --- | --- |
| Command | `docker compose up` | `docker stack deploy` |
| Main file | `compose.yml` | Compose v3-style stack file |
| Secrets | Usually local files | Swarm-managed secrets |
| Scaling | Local machine scaling | Cluster service replicas |
| Networking | Local Docker networks | Overlay networks across nodes |
| Production fit | Good for simple/single host | Better for multi-node service deployment |

For local learning, you can still initialize a one-node Swarm on your laptop or server:

```powershell
docker swarm init
```

That lets you practice `docker stack deploy` before using multiple servers.

## 0.3 What "Dockerizing This Project" Means

For ReliefConnect, Dockerizing does not mean changing the app features. It means packaging each runtime part:

```text
client/ React app
  -> build static HTML/CSS/JS
  -> put into an Nginx image

src/ReliefConnect.API ASP.NET Core app
  -> dotnet publish
  -> put into a .NET ASP.NET runtime image

Supabase database/storage
  -> keep external for now
  -> provide connection/config through secrets and env vars
```

When done, a deployment should not require installing Node.js or .NET on the production server. The server only needs Docker.

## 1. Goal

Containerize ReliefConnect so the project can run on Docker Swarm with a repeatable build, deploy, rollback, and operations workflow.

The first production-ready target should be conservative:

- Keep Supabase PostgreSQL/PostGIS external.
- Keep Supabase Storage external.
- Run the ASP.NET Core API as one replica at first.
- Run the React/Vite frontend as a static Nginx gateway.
- Publish only the gateway service to the internet.
- Route `/api/*` and `/hubs/*` from the gateway to the API service over the internal Swarm overlay network.

This gives a clean Swarm deployment without immediately changing application behavior, database hosting, SignalR scale-out, or background job ownership.

## 2. Current Project Summary

ReliefConnect currently has two main runtime parts:

| Area | Current implementation | Container implication |
| --- | --- | --- |
| Frontend | React 19 + Vite SPA in `client/` | Build once into static files and serve with Nginx. |
| Backend | ASP.NET Core 10 API in `src/ReliefConnect.API` | Build into a .NET runtime image. |
| Database | Supabase PostgreSQL/PostGIS | Use external connection string via Swarm secret. |
| Storage | Supabase Storage, with local `/uploads` fallback | Prefer Supabase Storage in production; local uploads need shared storage if enabled. |
| Realtime | SignalR hubs under `/hubs/*` | Gateway must proxy WebSocket upgrade headers. |
| Background work | Hosted services inside API process; Hangfire optional | Keep API at one replica first to avoid duplicate workers. |
| Health | Backend exposes `/health` | Use for container and Swarm health checks. |
| Deployment today | Azure Static Web Apps + Azure App Service | Add container image build and Swarm stack deploy flow. |

## 2.1 Request Flow In Plain English

When a user opens the website after Swarm deployment:

1. Browser requests `https://your-domain/`.
2. The request reaches the Swarm `web` service.
3. Nginx inside `web` returns the React app files.
4. React starts in the browser.
5. React calls `/api/auth/me`, `/api/map/pings`, and other API routes.
6. Nginx sees `/api/...` and forwards the request to `api:8080`.
7. The ASP.NET Core API talks to Supabase PostgreSQL and external services.
8. The API returns JSON to Nginx.
9. Nginx returns JSON to the browser.

For realtime messages:

1. Browser connects to `/hubs/direct-messages`, `/hubs/notifications`, or `/hubs/sos-alerts`.
2. Nginx forwards the WebSocket connection to `api:8080`.
3. SignalR keeps the connection open.

This is why the Nginx config must handle both normal HTTP requests and WebSocket upgrade requests.

## 2.2 What Must Not Be Put In Docker Images

Never bake these values into Docker images:

- database connection string,
- database password,
- JWT signing key,
- SMTP password,
- PayOS API key,
- PayOS checksum key,
- Gemini or other AI provider API keys.

Images often get pushed to registries and reused in multiple environments. Secrets must be injected at runtime through Swarm secrets or environment variables.

Public frontend values are different:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

These are included in the browser JavaScript bundle. They are not private, but they still need to be correct for each environment.

## 3. Recommended Swarm Architecture

```text
Internet
  |
  | 80/443
  v
reliefconnect_web gateway service
  - Nginx
  - serves React static files
  - proxies /api/* to api:8080
  - proxies /hubs/* to api:8080 with WebSocket upgrade
  |
  | internal overlay network
  v
reliefconnect_api service
  - ASP.NET Core 10
  - EF Core + Npgsql
  - SignalR
  - hosted background services
  |
  v
External services
  - Supabase PostgreSQL/PostGIS
  - Supabase Storage
  - SMTP
  - PayOS
  - AI providers
```

### Why This Shape

Using the frontend Nginx container as the gateway keeps browser traffic same-origin:

- Frontend can use `VITE_API_URL=/api`.
- SignalR URL becomes `/hubs/...`.
- CORS becomes less fragile because normal browser requests are same-origin.
- Only one Swarm service needs a public port.
- API remains private on the overlay network.

## 3.1 First Version vs Later Version

Do not try to solve every Swarm topic on day one. Use this staged path:

| Stage | What to do | What to avoid at this stage |
| --- | --- | --- |
| First working version | `web` + `api`, one API replica, external Supabase | Redis, multi-replica API, automatic migrations |
| First production version | Add TLS/domain, secrets, health checks, rollback process | Background worker split unless needed |
| Scale-out version | Add Redis SignalR backplane and separate worker service | Running background jobs in every API replica |
| Operations version | CI/CD, monitoring, backup checks, automated smoke tests | Manual deploys with unclear image tags |

The most important rule: one working production-like deployment is better than a complex stack that is hard to debug.

## 3.2 Why The API Should Start With One Replica

The API process currently owns two things that do not automatically scale safely:

1. SignalR connection memory.
2. Background hosted services.

If you run three API replicas immediately:

- A user connected to API replica A may not receive a SignalR event sent by replica B.
- Cleanup services may run three times.
- SOS monitoring may duplicate work.

That is fixable later with Redis and worker separation, but the first Docker Swarm deployment should keep `api.replicas: 1`.

## 4. Files To Add

Add these files:

```text
.dockerignore
src/ReliefConnect.API/Dockerfile
client/Dockerfile
deploy/api/docker-entrypoint.sh
deploy/web/nginx.conf
deploy/swarm/docker-stack.yml
deploy/swarm/.env.example
docs/docker-swarm-containerization-plan.md
```

What each file is for:

| File | Purpose |
| --- | --- |
| `.dockerignore` | Prevents `node_modules`, `bin`, `obj`, `.git`, test output, and local secrets from entering Docker build context. |
| `src/ReliefConnect.API/Dockerfile` | Builds and packages the ASP.NET Core API. |
| `client/Dockerfile` | Builds React/Vite and packages the static files with Nginx. |
| `deploy/api/docker-entrypoint.sh` | Converts Swarm secret files into environment variables before API startup. |
| `deploy/web/nginx.conf` | Serves React files and proxies `/api` and `/hubs` to the API service. |
| `deploy/swarm/docker-stack.yml` | Defines Swarm services, networks, secrets, replicas, health checks, and update behavior. |
| `deploy/swarm/.env.example` | Shows non-secret values needed when deploying the stack. |

Optional later files:

```text
.github/workflows/build-containers.yml
.github/workflows/deploy-swarm.yml
deploy/swarm/README.md
deploy/swarm/secrets.example.ps1
deploy/swarm/secrets.example.sh
```

Do not add real `.env` files with secrets. Keep only `.env.example` in git.

## 4.1 Recommended `.dockerignore`

The Docker build context is everything Docker sends to the Docker daemon before building. If the context is huge, builds are slow. If it includes secrets, builds are unsafe.

Recommended root `.dockerignore`:

```gitignore
.git
.gitnexus
.cocoindex_code
.claude
.playwright-mcp
.vscode

node_modules
client/node_modules
client/dist

**/bin
**/obj
**/TestResults
test-results
build-temp

src/ReliefConnect.API/appsettings.Development.json
**/*.user
**/*.suo
**/*.cache

.env
.env.*
!*.env.example

docs/log_error
```

If the project later needs a committed `client/.env.production`, make sure it contains only public `VITE_*` values. Never put backend secrets there.

## 5. Backend Container Plan

Use a multi-stage .NET 10 Dockerfile:

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/ReliefConnect.Core/ReliefConnect.Core.csproj src/ReliefConnect.Core/
COPY src/ReliefConnect.Infrastructure/ReliefConnect.Infrastructure.csproj src/ReliefConnect.Infrastructure/
COPY src/ReliefConnect.API/ReliefConnect.API.csproj src/ReliefConnect.API/
RUN dotnet restore src/ReliefConnect.API/ReliefConnect.API.csproj

COPY src/ src/
RUN dotnet publish src/ReliefConnect.API/ReliefConnect.API.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
COPY deploy/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
```

What this Dockerfile does:

| Step | Why it matters |
| --- | --- |
| `dotnet/sdk:10.0 AS build` | Uses the full SDK only while compiling. |
| Copy `.csproj` files first | Lets Docker cache `dotnet restore` when source files change but dependencies do not. |
| `dotnet publish` | Produces the deployable backend output. |
| `dotnet/aspnet:10.0 AS runtime` | Uses the smaller runtime image for production. |
| `ASPNETCORE_URLS=http://+:8080` | Makes Kestrel listen inside the container on port 8080. |
| `EXPOSE 8080` | Documents the internal API port. |
| `docker-entrypoint.sh` | Loads Swarm secrets before starting the app. |

Common beginner mistake: do not expose port `5164` in production just because local development uses `http://localhost:5164`. Inside Docker, choose a simple internal port like `8080`, then have Nginx proxy to it.

The entrypoint should read Swarm secrets from `/run/secrets/*` and export environment variables that ASP.NET Core already understands:

```sh
#!/bin/sh
set -eu

for secret_file in /run/secrets/*; do
  [ -f "$secret_file" ] || continue
  name="$(basename "$secret_file")"
  value="$(cat "$secret_file")"
  export "$name=$value"
done

exec dotnet ReliefConnect.API.dll
```

This lets a secret mounted as `/run/secrets/ConnectionStrings__DefaultConnection` become the environment variable `ConnectionStrings__DefaultConnection`.

### 5.1 Backend Runtime Checklist

The API container must have:

- `ASPNETCORE_ENVIRONMENT=Production`
- `ASPNETCORE_URLS=http://+:8080`
- `ConnectionStrings__DefaultConnection`
- `Jwt__Key`
- correct `Frontend__Urls__0`
- SMTP/PayOS/Gemini settings if those features are enabled

Expected successful startup signs:

- container does not restart repeatedly,
- logs show ASP.NET Core listening on `http://[::]:8080` or equivalent,
- `GET /health` returns JSON with `status = healthy`,
- no startup exception about missing `ConnectionStrings:DefaultConnection`,
- no startup exception about `Jwt:Key` being missing or shorter than 32 bytes.

## 6. Frontend Container Plan

Use a multi-stage Node/Nginx Dockerfile:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY client/ .

ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm build

FROM nginx:1.27-alpine AS runtime
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Important: Vite variables are build-time values. Changing `VITE_API_URL`, Google Client ID, or Supabase public values requires rebuilding the frontend image unless the project later adds runtime config injection.

What this Dockerfile does:

| Step | Why it matters |
| --- | --- |
| `node:22-alpine AS build` | Uses Node and pnpm only while building the frontend. |
| `pnpm install --frozen-lockfile` | Installs exactly what the lockfile says. |
| `ARG VITE_API_URL=/api` | Makes the frontend call the same domain through Nginx. |
| `pnpm build` | Creates static files in `dist/`. |
| `nginx:1.27-alpine AS runtime` | Serves static files without Node.js in production. |
| `COPY --from=build /app/dist` | Moves only built files into the final image. |

For Swarm, prefer this frontend build value:

```text
VITE_API_URL=/api
```

Do not use this in the Swarm frontend image unless you intentionally keep API on a separate domain:

```text
VITE_API_URL=https://reliefconnect-api.azurewebsites.net/api
```

If the frontend is served from `https://reliefconnect.example.com`, same-origin `/api` means the browser calls:

```text
https://reliefconnect.example.com/api/...
```

Then Nginx forwards that traffic internally to:

```text
http://api:8080/api/...
```

The user never sees the internal service name `api`.

## 7. Gateway Nginx Plan

`deploy/web/nginx.conf` should:

- Serve `/usr/share/nginx/html`.
- Fallback unknown paths to `/index.html` for React Router.
- Proxy `/api/` to `http://api:8080/api/`.
- Proxy `/hubs/` to `http://api:8080/hubs/`.
- Preserve `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`.
- Support WebSocket upgrade for SignalR.
- Set basic security headers.

Example shape:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /hubs/ {
        proxy_pass http://api:8080/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

TLS can be handled in one of these ways:

| Option | Use when | Notes |
| --- | --- | --- |
| Cloudflare terminates TLS | The domain is already behind Cloudflare | Ensure origin traffic is still trusted and `X-Forwarded-Proto` is set correctly. |
| Nginx handles TLS | You want minimal infrastructure | Requires cert/key management on Swarm nodes. |
| Traefik handles TLS | You want automatic Let's Encrypt and dynamic Swarm routing | Better long-term, but more moving parts. |

For the first Swarm migration, use the simplest gateway that matches the actual hosting environment. If no external TLS layer exists, Traefik is usually the cleaner production choice.

## 8. Swarm Stack Plan

Create `deploy/swarm/docker-stack.yml`.

The stack file is the production "desired state" file. You tell Swarm what services should exist, how many replicas to run, which networks to use, which ports to publish, and which secrets to mount.

When you run:

```bash
docker stack deploy -c deploy/swarm/docker-stack.yml reliefconnect
```

Swarm reads the file and tries to make reality match it. If a container dies, Swarm starts another one. If you change the image tag and deploy again, Swarm updates the service.

Example:

```yaml
version: "3.8"

services:
  web:
    image: ${REGISTRY}/reliefconnect-web:${TAG}
    networks:
      - reliefconnect
    ports:
      - target: 80
        published: 80
        protocol: tcp
        mode: ingress
    deploy:
      replicas: 2
      update_config:
        order: start-first
        parallelism: 1
      rollback_config:
        order: start-first
      restart_policy:
        condition: any
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3

  api:
    image: ${REGISTRY}/reliefconnect-api:${TAG}
    networks:
      - reliefconnect
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: http://+:8080
      Jwt__Issuer: ReliefConnect
      Jwt__Audience: ReliefConnectClient
      Jwt__ExpiryMinutes: "60"
      Frontend__Urls__0: ${FRONTEND_URL}
      ReverseProxy__ForwardLimit: "1"
      Google__ClientId: ${GOOGLE_CLIENT_ID}
      Smtp__Host: smtp.gmail.com
      Smtp__Port: "587"
      Smtp__From: ${SMTP_FROM}
      PayOS__ClientId: ${PAYOS_CLIENT_ID}
    secrets:
      - source: default_connection
        target: ConnectionStrings__DefaultConnection
      - source: jwt_key
        target: Jwt__Key
      - source: smtp_user
        target: Smtp__User
      - source: smtp_password
        target: Smtp__Password
      - source: gemini_api_key
        target: Gemini__ApiKey
      - source: payos_api_key
        target: PayOS__ApiKey
      - source: payos_checksum_key
        target: PayOS__ChecksumKey
    deploy:
      replicas: 1
      update_config:
        order: stop-first
        parallelism: 1
      rollback_config:
        order: stop-first
      restart_policy:
        condition: any
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 5

networks:
  reliefconnect:
    driver: overlay
    attachable: true

secrets:
  default_connection:
    external: true
  jwt_key:
    external: true
  smtp_user:
    external: true
  smtp_password:
    external: true
  gemini_api_key:
    external: true
  payos_api_key:
    external: true
  payos_checksum_key:
    external: true
```

If the runtime image does not include `wget`, either install a tiny healthcheck tool in the image or use a custom `/health` probe binary/script.

### 8.1 `.env.example` For Stack Deployment

Create `deploy/swarm/.env.example` with non-secret values:

```env
REGISTRY=ghcr.io/your-github-org-or-user
TAG=latest
FRONTEND_URL=https://reliefconnect.example.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SMTP_FROM=noreply@reliefconnect.vn
PAYOS_CLIENT_ID=your-payos-client-id
```

Deployment uses shell environment variables. A `.env.example` file is only documentation unless you explicitly load it.

PowerShell example:

```powershell
$env:REGISTRY = "ghcr.io/your-github-org-or-user"
$env:TAG = "v1.0.0"
$env:FRONTEND_URL = "https://reliefconnect.example.com"
$env:GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"
$env:SMTP_FROM = "noreply@reliefconnect.vn"
$env:PAYOS_CLIENT_ID = "your-payos-client-id"
docker stack deploy --with-registry-auth -c deploy/swarm/docker-stack.yml reliefconnect
```

Bash example:

```bash
export REGISTRY=ghcr.io/your-github-org-or-user
export TAG=v1.0.0
export FRONTEND_URL=https://reliefconnect.example.com
export GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
export SMTP_FROM=noreply@reliefconnect.vn
export PAYOS_CLIENT_ID=your-payos-client-id
docker stack deploy --with-registry-auth -c deploy/swarm/docker-stack.yml reliefconnect
```

### 8.2 How Service Names Work

In the stack file, the API service is named `api`. On the overlay network, Docker DNS lets other services call it by that name:

```text
http://api:8080
```

You do not need to know which node the API container is running on. Swarm resolves and routes it internally.

## 9. Configuration And Secrets Mapping

Backend secret values:

| Secret name | ASP.NET Core key | Required |
| --- | --- | --- |
| `default_connection` | `ConnectionStrings__DefaultConnection` | Yes |
| `jwt_key` | `Jwt__Key` | Yes |
| `smtp_user` | `Smtp__User` | Yes for email |
| `smtp_password` | `Smtp__Password` | Yes for email |
| `gemini_api_key` | `Gemini__ApiKey` | Yes for chatbot/moderation fallback |
| `payos_api_key` | `PayOS__ApiKey` | Yes for donations |
| `payos_checksum_key` | `PayOS__ChecksumKey` | Yes for PayOS webhook verification |

Backend non-secret environment values:

| Variable | Example |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `Frontend__Urls__0` | `https://reliefconnect.example.com` |
| `Google__ClientId` | Google OAuth client ID |
| `PayOS__ClientId` | PayOS client ID |
| `ReverseProxy__ForwardLimit` | `1` |

Frontend build arguments:

| Build arg | Example | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Recommended for same-origin Swarm gateway. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | Public value. |
| `VITE_SUPABASE_URL` | Supabase project URL | Public value. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Public value, but still should be controlled. |

## 10. Creating Swarm Secrets

Create secrets on a manager node before deploying the stack.

PowerShell example:

```powershell
"Host=...;Database=...;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true" |
  docker secret create default_connection -

"your-32-byte-or-longer-jwt-key" | docker secret create jwt_key -
"smtp-user@example.com" | docker secret create smtp_user -
"smtp-app-password" | docker secret create smtp_password -
"gemini-key" | docker secret create gemini_api_key -
"payos-api-key" | docker secret create payos_api_key -
"payos-checksum-key" | docker secret create payos_checksum_key -
```

Do not commit real secret values to the repository.

## 11. Migration Strategy

Do not run EF migrations automatically inside every API container.

Use this order:

1. Generate/review idempotent migration SQL.
2. Apply SQL to Supabase manually or with a dedicated one-off deploy job.
3. Deploy the new API image.
4. Verify `/health` and core flows.

Later improvement: add a dedicated migrator image or CI step that runs before `docker stack deploy`.

## 12. Background Services And Scaling Strategy

The API currently registers these hosted services:

- `PingFlagMonitorService`
- `SoftDeleteCleanupService`
- `TokenCleanupService`
- `MessageCleanupService`

For the first Swarm release:

- Keep `api.deploy.replicas: 1`.
- Keep all background services inside the API.

Before scaling API above one replica:

1. Add a config switch such as `Workers__Enabled`.
2. Register hosted services only when `Workers__Enabled=true`.
3. Split deployment into:
   - `api`: multiple replicas, no background workers.
   - `worker`: one replica, background services enabled.

This avoids duplicate cleanup loops and duplicate alert processing.

## 13. SignalR Scale-Out Strategy

SignalR connections and groups are in memory by default.

For the first Swarm release:

- Keep one API replica.
- Let Nginx proxy `/hubs/*` to `api:8080`.

Before scaling API above one replica:

1. Add Redis.
2. Configure ASP.NET Core SignalR Redis backplane.
3. Add Redis to the Swarm stack.
4. Test direct messaging, notifications, and SOS alerts across multiple browser sessions.

Without a backplane, users connected to different API replicas may miss realtime events.

## 14. Upload Storage Strategy

Production should use Supabase Storage for:

- avatars
- post images

The backend has a local fallback that writes to `wwwroot/uploads`. In Swarm this is risky because:

- container files are ephemeral,
- local volumes are node-local,
- multiple replicas will not share uploaded files.

For the first Swarm release:

- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
- Ensure Supabase buckets and RLS policies are ready.
- Treat backend local uploads as emergency fallback only.

If local fallback must be supported, mount shared storage to `/app/wwwroot/uploads`, such as NFS or another Swarm-compatible shared volume driver.

## 15. CI/CD Plan

Add a container build workflow:

1. Checkout repository.
2. Set up .NET 10.
3. Run backend tests.
4. Set up Node 22 + pnpm.
5. Run frontend build.
6. Build Docker images:
   - `reliefconnect-api`
   - `reliefconnect-web`
7. Push images to GHCR or Docker Hub with immutable tags:
   - commit SHA
   - release tag
   - optional `latest` only for non-production convenience.

Add a deployment workflow only after manual Swarm deploy is proven:

1. SSH to Swarm manager.
2. Login to registry.
3. Export `TAG`.
4. Run:

```bash
docker stack deploy \
  --with-registry-auth \
  -c deploy/swarm/docker-stack.yml \
  reliefconnect
```

Keep the current Azure workflows until the Swarm release path is stable.

## 15.1 Beginner Implementation Order

Use this exact order so problems stay small:

### Step 1 - Add `.dockerignore`

Goal: make Docker builds fast and prevent accidental secret inclusion.

Check:

```powershell
docker build -f src/ReliefConnect.API/Dockerfile -t reliefconnect-api:test .
```

If Docker sends a huge build context, improve `.dockerignore`.

### Step 2 - Add Backend Dockerfile

Goal: prove the API can compile and run inside Docker.

Build:

```powershell
docker build -f src/ReliefConnect.API/Dockerfile -t reliefconnect-api:local .
```

Run a simple container only after you have local environment values ready:

```powershell
docker run --rm -p 8080:8080 `
  -e ASPNETCORE_ENVIRONMENT=Production `
  -e ASPNETCORE_URLS=http://+:8080 `
  -e "ConnectionStrings__DefaultConnection=your-connection-string" `
  -e "Jwt__Key=your-very-long-jwt-key-at-least-32-bytes" `
  -e "Frontend__Urls__0=http://localhost:8081" `
  reliefconnect-api:local
```

Test:

```powershell
Invoke-RestMethod http://localhost:8080/health
```

Expected:

```json
{
  "status": "healthy",
  "timestamp": "..."
}
```

### Step 3 - Add Frontend Dockerfile

Goal: prove the React app can build and be served by Nginx.

Build:

```powershell
docker build -f client/Dockerfile -t reliefconnect-web:local `
  --build-arg VITE_API_URL=/api `
  --build-arg VITE_GOOGLE_CLIENT_ID="your-google-client-id" `
  --build-arg VITE_SUPABASE_URL="your-supabase-url" `
  --build-arg VITE_SUPABASE_ANON_KEY="your-supabase-anon-key" `
  .
```

Run:

```powershell
docker run --rm -p 8081:80 reliefconnect-web:local
```

Open:

```text
http://localhost:8081
```

At this stage `/api` will fail unless the Nginx gateway can reach an API service. That is normal if you only started the frontend container.

### Step 4 - Test Both Containers Together

Before Swarm, you can test with a normal Docker network:

```powershell
docker network create reliefconnect-test

docker run -d --name reliefconnect-api-test --network reliefconnect-test `
  -e ASPNETCORE_ENVIRONMENT=Production `
  -e ASPNETCORE_URLS=http://+:8080 `
  -e "ConnectionStrings__DefaultConnection=your-connection-string" `
  -e "Jwt__Key=your-very-long-jwt-key-at-least-32-bytes" `
  -e "Frontend__Urls__0=http://localhost:8081" `
  reliefconnect-api:local

docker run --rm --name reliefconnect-web-test --network reliefconnect-test `
  -p 8081:80 reliefconnect-web:local
```

Open `http://localhost:8081`. Nginx should proxy `/api` to the `api` service only if the Nginx config points to the right container DNS name. In Swarm the service name will be `api`; in this manual test the container name is `reliefconnect-api-test`, so this test may need a temporary network alias:

```powershell
docker network connect --alias api reliefconnect-test reliefconnect-api-test
```

Cleanup:

```powershell
docker rm -f reliefconnect-api-test
docker network rm reliefconnect-test
```

### Step 5 - Deploy To One-Node Swarm

Goal: learn Swarm without multiple servers.

```powershell
docker swarm init
docker stack deploy -c deploy/swarm/docker-stack.yml reliefconnect
docker service ls
```

If you use local images, remember that Swarm nodes need access to the images. For a single-node test, local images can work if names match. For multi-node Swarm, push images to a registry.

### Step 6 - Deploy To Real Swarm

Only after the one-node test works:

1. Push images to registry.
2. Create secrets on the Swarm manager.
3. Export non-secret env vars.
4. Run `docker stack deploy --with-registry-auth`.
5. Check services, logs, and `/health`.

## 16. Local Validation Workflow

Before Swarm:

```powershell
dotnet test src/ReliefConnect.Tests/ReliefConnect.Tests.csproj -c Release

cd client
pnpm install --frozen-lockfile
pnpm build
```

Build images locally:

```powershell
docker build -f src/ReliefConnect.API/Dockerfile -t reliefconnect-api:local .
docker build -f client/Dockerfile -t reliefconnect-web:local `
  --build-arg VITE_API_URL=/api `
  --build-arg VITE_GOOGLE_CLIENT_ID="..." `
  --build-arg VITE_SUPABASE_URL="..." `
  --build-arg VITE_SUPABASE_ANON_KEY="..." `
  .
```

Deploy to a single-node test Swarm:

```powershell
docker swarm init
$env:REGISTRY="local"
$env:TAG="local"
$env:FRONTEND_URL="http://localhost"
docker stack deploy -c deploy/swarm/docker-stack.yml reliefconnect
```

Depending on registry setup, local Swarm may require a local registry or preloaded images on every node.

## 17. Production Rollout Plan

### Phase 0 - Pre-flight

- Confirm Docker Engine and Swarm are installed on target nodes.
- Confirm a manager node is available for `docker stack deploy`.
- Confirm registry choice: GHCR, Docker Hub, or private registry.
- Confirm public domain and TLS approach.
- Confirm Supabase migration state.
- Confirm Supabase Storage buckets and policies.

### Phase 1 - Add Container Assets

- Add `.dockerignore`.
- Add backend Dockerfile.
- Add frontend Dockerfile.
- Add Nginx gateway config.
- Add API entrypoint for Swarm secrets.
- Add Swarm stack file and `.env.example`.

### Phase 2 - Local Build Verification

- Run backend tests.
- Run frontend build.
- Build both Docker images.
- Run API container locally with environment variables.
- Run web container locally and verify SPA fallback.

### Phase 3 - Test Swarm Deployment

- Create Swarm secrets.
- Deploy stack on a non-production Swarm.
- Verify `web` can reach `api`.
- Verify `/health`.
- Verify `/api/*`.
- Verify `/hubs/*` WebSocket upgrade.

### Phase 4 - Production Swarm Deployment

- Push immutable images.
- Create/update Swarm secrets on manager node.
- Deploy stack with release tag.
- Verify service convergence:

```bash
docker service ls
docker service ps reliefconnect_web
docker service ps reliefconnect_api
```

- Verify logs:

```bash
docker service logs -f reliefconnect_api
docker service logs -f reliefconnect_web
```

### Phase 5 - Post-Deploy Smoke Test

- `GET /health` returns healthy.
- Frontend loads.
- Login works.
- Map loads pings.
- Create SOS ping.
- Direct message realtime flow works.
- Notification hub works.
- Post image upload uses Supabase Storage.
- PayOS create/status/webhook flow works.
- Admin dashboard loads.

### Phase 6 - Scale-Out Hardening

- Add Redis.
- Add SignalR Redis backplane.
- Split API and worker services.
- Increase API replicas.
- Add dedicated migration job.
- Add automated Swarm deploy workflow.

## 18. Rollback Plan

Use image tags for rollback.

```bash
TAG=<previous-good-tag> docker stack deploy \
  --with-registry-auth \
  -c deploy/swarm/docker-stack.yml \
  reliefconnect
```

If a single service update fails:

```bash
docker service rollback reliefconnect_api
docker service rollback reliefconnect_web
```

Rollback requirements:

- Keep previous images in the registry.
- Do not apply irreversible database migrations without a rollback script.
- Store the exact stack file and image tag used for each release.

## 19. Acceptance Criteria

The Docker Swarm migration is complete when:

- Backend and frontend images build from a clean checkout.
- No real secrets are committed.
- Stack deploy works on a Swarm manager node.
- Only the gateway service is publicly exposed.
- API is reachable internally from the gateway.
- `/health` works through the public domain.
- React Router refresh works on frontend routes.
- `/api/*` routes work through the gateway.
- `/hubs/*` SignalR connections work through the gateway.
- Production logs go to container stdout/stderr.
- Supabase database and storage are used successfully.
- Rollback to a previous image tag is documented and tested.

## 20. Open Decisions

| Decision | Recommended first choice | Reason |
| --- | --- | --- |
| Registry | GHCR | Works naturally with GitHub Actions. |
| TLS | Existing Cloudflare or Traefik | Choose based on current domain ownership and ops comfort. |
| API replicas | 1 | Avoid SignalR and background service duplication risks. |
| Database location | External Supabase | Lowest migration risk. |
| Upload storage | Supabase Storage | Avoid Swarm shared-volume complexity. |
| Migration execution | Manual/idempotent SQL first | Matches current project workflow. |

## 21. Beginner Command Cookbook

### Check Docker Is Installed

```powershell
docker version
docker info
```

You need the Docker Engine running. On Windows development machines, Docker Desktop is usually enough for local tests.

### Initialize Swarm

Single machine:

```powershell
docker swarm init
```

Real multi-node cluster:

```powershell
docker swarm init --advertise-addr <manager-private-ip>
```

Docker will print a `docker swarm join ...` command. Run that command on worker nodes.

### See Nodes

```powershell
docker node ls
```

Run this from a manager node.

### Build Images

```powershell
docker build -f src/ReliefConnect.API/Dockerfile -t ghcr.io/your-user/reliefconnect-api:v1.0.0 .

docker build -f client/Dockerfile -t ghcr.io/your-user/reliefconnect-web:v1.0.0 `
  --build-arg VITE_API_URL=/api `
  --build-arg VITE_GOOGLE_CLIENT_ID="..." `
  --build-arg VITE_SUPABASE_URL="..." `
  --build-arg VITE_SUPABASE_ANON_KEY="..." `
  .
```

### Push Images

```powershell
docker login ghcr.io
docker push ghcr.io/your-user/reliefconnect-api:v1.0.0
docker push ghcr.io/your-user/reliefconnect-web:v1.0.0
```

### Create A Secret

```powershell
"secret-value" | docker secret create secret_name -
```

List secrets:

```powershell
docker secret ls
```

Remove a secret:

```powershell
docker secret rm secret_name
```

Swarm secrets are immutable. To change a secret, create a new secret name, update the stack to use it, then remove the old one after the service is updated.

### Deploy The Stack

```powershell
$env:REGISTRY = "ghcr.io/your-user"
$env:TAG = "v1.0.0"
$env:FRONTEND_URL = "https://reliefconnect.example.com"
$env:GOOGLE_CLIENT_ID = "..."
$env:SMTP_FROM = "noreply@reliefconnect.vn"
$env:PAYOS_CLIENT_ID = "..."

docker stack deploy --with-registry-auth -c deploy/swarm/docker-stack.yml reliefconnect
```

### Check Stack And Services

```powershell
docker stack ls
docker stack services reliefconnect
docker service ls
```

### Check Service Tasks

```powershell
docker service ps reliefconnect_api
docker service ps reliefconnect_web
```

Look for `Running`. If you see `Rejected`, `Failed`, or repeated restarts, check logs.

### Read Logs

```powershell
docker service logs -f reliefconnect_api
docker service logs -f reliefconnect_web
```

### Update To A New Version

```powershell
$env:TAG = "v1.0.1"
docker stack deploy --with-registry-auth -c deploy/swarm/docker-stack.yml reliefconnect
```

### Roll Back A Service

```powershell
docker service rollback reliefconnect_api
docker service rollback reliefconnect_web
```

### Remove The Stack

```powershell
docker stack rm reliefconnect
```

This removes services and stack networks. It does not remove secrets or images.

## 22. Troubleshooting Guide

### Problem: API Container Restarts Repeatedly

Check:

```powershell
docker service logs reliefconnect_api
docker service ps reliefconnect_api --no-trunc
```

Common causes:

- missing `ConnectionStrings__DefaultConnection`,
- missing `Jwt__Key`,
- JWT key shorter than 32 bytes,
- wrong Supabase connection string,
- database not reachable from the Swarm node,
- production config references a missing external service.

### Problem: Frontend Loads But API Calls Fail

Check browser DevTools Network tab.

If requests to `/api/...` return `502`:

- Nginx cannot reach `api:8080`.
- API service may be down.
- API may be listening on the wrong port.
- `ASPNETCORE_URLS` may not be `http://+:8080`.

Check from logs:

```powershell
docker service logs reliefconnect_web
docker service logs reliefconnect_api
```

### Problem: Login Works Locally But Not In Swarm

Check:

- `Frontend__Urls__0` exactly matches the public frontend origin.
- The site uses HTTPS in production.
- `X-Forwarded-Proto` is passed by Nginx.
- Browser is receiving the JWT response.
- The frontend `VITE_API_URL` points to `/api` or the correct public API URL.

This project primarily uses Authorization Bearer headers, but cookie settings still depend on secure request detection.

### Problem: SignalR Does Not Connect

Check:

- Nginx has `proxy_http_version 1.1`.
- Nginx sets `Upgrade` and `Connection` headers.
- `/hubs/direct-messages`, `/hubs/notifications`, and `/hubs/sos-alerts` route to the API.
- API logs show hub connections.
- Browser WebSocket request is not blocked by mixed HTTP/HTTPS content.

If API replicas are more than one and no Redis backplane exists, realtime behavior may be inconsistent.

### Problem: Post Image Uploads Disappear

Likely cause: backend local `/uploads` fallback was used.

Fix:

- configure Supabase Storage env vars in frontend build,
- verify Supabase buckets `avatars` and `post-images`,
- verify bucket public access and insert policy,
- avoid relying on container-local files for production.

### Problem: New Deployment Does Not Change Anything

Check:

- image tag changed,
- image was pushed to registry,
- stack was deployed from manager node,
- service is using the expected image:

```powershell
docker service inspect reliefconnect_api --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"
docker service inspect reliefconnect_web --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"
```

Avoid reusing `latest` for production. Immutable tags like `v1.0.0` or commit SHA are easier to debug.

### Problem: `docker stack deploy` Cannot Find Environment Variables

If the stack file contains `${TAG}` and it is empty, Docker may deploy the wrong image name.

Set variables in the same shell:

```powershell
$env:TAG = "v1.0.0"
docker stack deploy -c deploy/swarm/docker-stack.yml reliefconnect
```

### Problem: Secret Value Needs To Change

Swarm secrets cannot be edited in place.

Use versioned names:

```powershell
"new-value" | docker secret create jwt_key_v2 -
```

Then update `docker-stack.yml` to use `jwt_key_v2`, redeploy, and remove the old secret after the service is stable.

## 23. References

- Docker stack deploy: https://docs.docker.com/engine/swarm/stack-deploy/
- Docker Swarm secrets: https://docs.docker.com/engine/swarm/secrets/
- Docker Swarm networking and published ports: https://docs.docker.com/engine/swarm/networking/
- ASP.NET Core Docker images: https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/building-net-docker-images
