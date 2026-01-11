# 🚀 Production Deployment Guide (Low Cost)

This guide outlines the most cost-effective and professional way to deploy the **MinervaTraders** platform to production. We will use a "Hybrid" architecture:

*   **Frontend**: **Vercel** (Free Hobby Tier). Best for Next.js performance and global edge caching.
*   **Backend**: **Render** (Free Tier or $7/mo). Easiest way to host Node.js APIs.
*   **Database**: **Supabase** (Free Tier). Managed PostgreSQL.

**Estimated Cost: $0 - $7 per month.**

---

## 📋 Prerequisites

1.  **GitHub Repository**: Push your latest code to a GitHub repository.
2.  **Accounts**: Sign up for [Vercel](https://vercel.com), [Render](https://render.com), and [Supabase](https://supabase.com).

---

## Part 1: Database (Supabase)

Your database is likely already set up if you've been developing locally.

1.  Log in to your Supabase Dashboard.
2.  Go to **Settings > Database**.
3.  Copy your **Connection String** (URI mode) and your **Service Role Key** (under API settings). You will need these for the Backend.

---

## Part 2: Backend Deployment (Render)

We will deploy the Node.js API to Render.

1.  **Create a New Web Service:**
    *   Go to the [Render Dashboard](https://dashboard.render.com/).
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub repository.

2.  **Configure Service Details:**
    *   **Name**: `minervatraders-api`
    *   **Region**: Singapore (or closest to your users).
    *   **Branch**: `main`
    *   **Root Directory**: `apps/backend` (Critical for monorepos!)
    *   **Runtime**: Node
    *   **Build Command**: `npm install`
    *   **Start Command**: `node src/server.js`

3.  **Environment Variables:**
    Scroll down to "Environment Variables" and add these keys (copy values from your local `.env`):

    | Key | Value Description |
    | :--- | :--- |
    | `PORT` | `10000` (Render default) |
    | `SUPABASE_URL` | Your Supabase Project URL |
    | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key |
    | `RAZORPAY_KEY_ID` | Your production Razorpay Key ID |
    | `RAZORPAY_KEY_SECRET` | Your production Razorpay Secret |
    | `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token |
    | `TELEGRAM_CHAT_ID` | Your Channel ID |
    | `FRONTEND_URL` | `https://your-vercel-frontend.vercel.app` (Update this later after Part 3) |

4.  **Deploy:**
    *   Choose **Free** (spins down after 15 mins of inactivity) or **Starter** ($7/mo, always on).
    *   Click **Create Web Service**.
    *   Wait for the build to finish. Copy your new backend URL (e.g., `https://minervatraders-api.onrender.com`).

---

## Part 3: Frontend Deployment (Vercel)

Now we deploy the Next.js client.

1.  **Import Project:**
    *   Go to the [Vercel Dashboard](https://vercel.com/dashboard).
    *   Click **Add New...** -> **Project**.
    *   Import your `telegram-subscription-app` repository.

2.  **Configure Project:**
    *   **Framework Preset**: Next.js
    *   **Root Directory**: Click "Edit" and select `apps/frontend`. This is crucial.

3.  **Environment Variables:**
    Add the public environment variables needed for the UI.

    | Key | Value |
    | :--- | :--- |
    | `NEXT_PUBLIC_API_URL` | `https://minervatraders-api.onrender.com/api/v1` (Your Render URL + /api/v1) |
    | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |

4.  **Deploy:**
    *   Click **Deploy**.
    *   Vercel will build your site and give you a live URL (e.g., `https://minervatraders-frontend.vercel.app`).

---

## Part 4: Final Configuration

1.  **Update Backend CORS:**
    *   Go back to **Render Dashboard** -> **Environment Variables**.
    *   Update `FRONTEND_URL` to your actual Vercel URL (e.g., `https://minervatraders-frontend.vercel.app`).
    *   Render will auto-redeploy.

2.  **Update Supabase Auth:**
    *   Go to **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
    *   Add your Vercel URL to the **Site URL** and **Redirect URLs**.

3.  **Custom Domain (Optional but Recommended):**
    *   Buy a domain (e.g., `minervatraders.com`) from Namecheap or GoDaddy (~$10/yr).
    *   In **Vercel**, go to **Settings > Domains** and add your domain. Follow the DNS instructions (add an A record or CNAME).
    *   In **Razorpay**, ensure you generate "Live Mode" keys and update them in Render.

---

## 💡 Troubleshooting

*   **Backend "Not Found":** Ensure your `NEXT_PUBLIC_API_URL` in Vercel ends with `/api/v1` (or matching your route structure) and does *not* have a trailing slash if your code appends one.
*   **CORS Errors:** This usually means the `FRONTEND_URL` env var in Render doesn't match the Vercel URL exactly (check for `https://` and trailing slashes).
*   **Database Connection Failed:** Check if your Render IP needs to be whitelisted in Supabase (usually Supabase accepts all connections by default, but check Network constraints).

## 💰 Cost Summary

*   **Vercel:** $0/mo (Free tier is generous for bandwidth).
*   **Supabase:** $0/mo (Free tier).
*   **Render:** $0/mo (Free tier) OR $7/mo (Starter).
    *   *Tip:* The Free tier on Render "sleeps" after 15 minutes. The first request will take ~30 seconds to wake it up. For a real business, pay the $7/mo.

**Total:** **$0 - $7 / month**
