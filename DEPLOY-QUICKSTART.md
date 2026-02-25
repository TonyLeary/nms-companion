# NMS Companion Deployment Quickstart (Hetzner + Coolify)

This path uses one Hetzner VPS + Coolify + Squarespace DNS.

## 1) Provision server

- Create Ubuntu 24.04 server in Hetzner.
- Note the server IP.
- SSH in as root:

```bash
ssh root@YOUR_SERVER_IP
```

## 2) Run one-time bootstrap

From your local machine, copy your public key and run on the server from this repo folder:

```bash
cd nms-companion
```

Then run:

```bash
sudo bash ops/bootstrap-hetzner-ubuntu2404.sh "ssh-ed25519 YOUR_PUBLIC_KEY"
```

Optional after you verify `deploy` login works:

```bash
sudo DISABLE_ROOT_SSH=true bash ops/bootstrap-hetzner-ubuntu2404.sh "ssh-ed25519 YOUR_PUBLIC_KEY"
```

Then reconnect:

```bash
ssh deploy@YOUR_SERVER_IP
```

## 3) Install Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open `http://YOUR_SERVER_IP:8000` and create admin account.

## 4) Configure DNS (Squarespace)

- In Squarespace domain DNS settings, add `A` record: Host `nms` -> `YOUR_SERVER_IP`
- Final app URL: `https://nms.amlapps.net`

Coolify handles HTTPS certificates after DNS resolves.

## 5) Create app in Coolify

- Source: this GitHub repo
- Branch: `dev`
- Build method: `Dockerfile`
- Domain: `nms.amlapps.net`

Add env vars in Coolify (app settings):

- `NODE_ENV=production`
- `PORT=3000`
- `BASE_URL=https://nms.amlapps.net`
- `APP_SESSION_SECRET=<random-long-secret>`
- `GOOGLE_OAUTH_CLIENT_ID=<value>`
- `GOOGLE_OAUTH_CLIENT_SECRET=<value>`

Add persistent volume for SQLite path used by your app.

## 6) Wire GitHub Actions deploy webhooks

In Coolify app settings, copy deploy webhook URL(s).

In GitHub repo settings:

- Environment `dev` with secret `COOLIFY_DEPLOY_WEBHOOK_DEV`
- Environment `production` with secret `COOLIFY_DEPLOY_WEBHOOK_PROD`

The workflow file already triggers:

- Push to `dev` => dev deploy webhook
- Push to `main` => production deploy webhook (use environment approval)

## 7) Verify done

- `https://nms.amlapps.net` loads
- Login works
- Push to `dev` triggers deploy in Actions + Coolify
