# Telegram Subscription App - Production Deployment Guide

**Frontend:** Vercel  
**Backend:** Railway

This guide explains how to deploy the Telegram Subscription App to a production environment using **Vercel** for the frontend and **Railway** for the backend.

---

## 1. Prerequisites

Before starting, make sure you have the following:

* **GitHub Repository**
  * Your latest code pushed to GitHub

* **Accounts**
  * Vercel – [https://vercel.com](https://vercel.com)
  * Railway – [https://railway.app](https://railway.app)

* **Supabase**
  * Project URL
  * Service Role Key
  * Anon Key
  * JWT Secret

* **Razorpay**
  * Key ID
  * Key Secret
  * Webhook Secret

* **Telegram**
  * Bot Token

---

## 2. Backend Deployment (Railway)

We use **Railway** because it offers a simpler setup for Docker containers, excellent uptime, and easy environment variable management.

### Steps

1. Log in to **Railway Dashboard** ([railway.app](https://railway.app)).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your **GitHub repository** (`minervatraders`).
4. Click **Deploy Now** (it might fail initially without config, that's okay, or click "Add Variables" first).

### Configuration

   * `SUPABASE_JWT_SECRET`
   * `RAZORPAY_KEY_ID`
   * `RAZORPAY_KEY_SECRET`
   * `RAZORPAY_WEBHOOK_SECRET`
   * `TELEGRAM_BOT_TOKEN`

3. **Networking**:
   * Go to **Settings** -> **Networking**.
   * Click **Generate Domain**.
   * This gives you a public URL like `web-production-1234.up.railway.app`.

---

### Health Check

After deployment, your backend URL will look like:
`https://web-production-1234.up.railway.app`

Verify deployment:
`https://web-production-1234.up.railway.app/health`

You should receive a healthy response.

---

## 3. Frontend Deployment (Vercel)

Vercel is the native platform for **Next.js**.

### Steps

1. Log in to **Vercel**
2. Click **Add New → Project**
3. Import your **GitHub repository**

### Project Configuration

* Framework Preset: **Next.js** (auto-detected)
* Root Directory: `apps/frontend`

### Environment Variables

Add the following:

* `NEXT_PUBLIC_API_URL`
  * Example: `https://telegram-backend-xyz.onrender.com/api/v1`
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Click **Deploy**

---

## 4. Secrets Checklist

### Backend (Railway)

| Variable                  | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `NODE_ENV`                  | `production`                                         |
| `PORT`                      | `5000`                                               |
| `FRONTEND_URL`              | Your Vercel domain (e.g., `https://myapp.vercel.app` - no trailing slash) |
| `SUPABASE_URL`              | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (keep secret)                     |
| `SUPABASE_JWT_SECRET`       | Found in Supabase API settings                     |
| `RAZORPAY_KEY_ID`           | `rzp_live_...`                                       |
| `RAZORPAY_KEY_SECRET`       | Secret key                                         |
| `RAZORPAY_WEBHOOK_SECRET`   | Webhook secret                                     |
| `TELEGRAM_BOT_TOKEN`        | `123456:ABC...`                                      |

---

### Frontend (Vercel)

| Variable                      | Description          |
| ----------------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL`           | Railway backend URL + `/api/v1` (e.g. `https://your-project.up.railway.app/api/v1`) |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key      |

---

## 5. SSL & Nginx

### SSL (HTTPS)

Both platforms automatically provide SSL certificates:

* Frontend: `https://your-app.vercel.app`
* Backend: `https://your-app.up.railway.app`

No manual SSL setup required.

### Nginx

Since we are using **PaaS platforms**:
* Vercel handles frontend routing & CDN
* Render uses built-in load balancers

➡️ You **do NOT need Nginx** for this setup.
The `infra/nginx` folder is only required when deploying to EC2, DigitalOcean, or a self-hosted VPS.

---

## 6. Post-Deployment Checklist

### 1. CORS
Ensure `FRONTEND_URL` environment variable in **Railway** matches your actual Vercel domain (no trailing slash).

### 2. Razorpay Webhook
Update webhook URL in Razorpay Dashboard:
`https://your-app.up.railway.app/webhook`

### 3. Telegram Bot
Check Railway logs. The bot service should show:
* "Polling started"
* or "Webhook set"

This confirms the bot is running correctly.

### 4. Google Auth Redirect (Crucial)
1.  Go to **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2.  Add your **Vercel Production URL** to the **Redirect URLs** list.
    *   Format: `https://your-project.vercel.app/**` (Wildcard `**` covers all routes)
    *   Also add: `https://your-project.vercel.app`
3.  **Save**.
4.  This fixes the "Redirect Mismatch" error when logging in with Google.
