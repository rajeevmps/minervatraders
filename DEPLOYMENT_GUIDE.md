# Telegram Subscription App - Production Deployment Guide

**Frontend:** Vercel  
**Backend:** Render

This guide explains how to deploy the Telegram Subscription App to a production environment using **Vercel** for the frontend and **Render** for the backend.

---

## 1. Prerequisites

Before starting, make sure you have the following:

* **GitHub Repository**
  * Your latest code pushed to GitHub

* **Accounts**
  * Vercel – [https://vercel.com](https://vercel.com)
  * Render – [https://render.com](https://render.com)

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

## 2. Backend Deployment (Render)

We use **Render** because it supports Docker and background workers/cron jobs.

### Method A (Recommended): Blueprint – Infrastructure as Code

1. Log in to **Render Dashboard**
2. Click **New + → Blueprint**
3. Connect your **GitHub repository**
4. Render will automatically detect the `render.yaml` file in the root
5. Confirm the service:
   * `telegram-subscription-backend`
6. Enter required **Environment Variables**
   * (See Secrets Checklist below)
7. Click **Apply**

Render will automatically build and deploy your backend.

---

### Method B: Manual Setup

1. Click **New + → Web Service**
2. Connect your GitHub repository
3. Configuration
   * Runtime: **Docker**
   * Build Context: `.` (root directory)
   * Dockerfile Path: `apps/backend/Dockerfile`
4. Add all **Environment Variables** manually
5. Deploy

---

### Health Check

After deployment, your backend URL will look like:
`https://telegram-backend-xyz.onrender.com`

Verify deployment:
`https://telegram-backend-xyz.onrender.com/health`

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

### Backend (Render)

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
| `NEXT_PUBLIC_API_URL`           | Render backend URL + `/api/v1` per backend routes (e.g. `https://your-backend.onrender.com/api/v1`) |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key      |

---

## 5. SSL & Nginx

### SSL (HTTPS)

Both platforms automatically provide SSL certificates:

* Frontend: `https://your-app.vercel.app`
* Backend: `https://your-backend.onrender.com`

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
Ensure `FRONTEND_URL` environment variable in **Render** matches your actual Vercel domain (no trailing slash).

### 2. Razorpay Webhook
Update webhook URL in Razorpay Dashboard:
`https://your-backend.onrender.com/webhook`

### 3. Telegram Bot
Check Render logs. The bot service should show:
* "Polling started"
* or "Webhook set"

This confirms the bot is running correctly.
