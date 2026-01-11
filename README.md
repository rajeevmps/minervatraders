# MinervaTraders - Premium Telegram Subscription Platform

MinervaTraders is a full-stack SaaS platform designed to automate premium Telegram channel subscriptions. It features a modern, high-converting landing page, a secure user dashboard, direct payment integration with Razorpay, and automated telegram invite link generation.

## 🚀 Features

*   ** automated Membership Management**: Users get instant access to Telegram channels upon payment and are automatically removed when subscriptions expire.
*   **Secure Authentication**: Powered by Supabase Auth (Email/Password & Social Login ready).
*   **Modern UI/UX**: Built with Next.js 14, Tailwind CSS, and Framer Motion for a premium, glassmorphism aesthetic.
*   **Admin Portal**: A powerful dashboard for administrators to:
    *   Manage Users (Add, Delete, Modify Roles).
    *   View & Manage Subscriptions (Grant/Revoke access).
    *   Monitor Audit Logs and System Health.
    *   Configure System Settings.
*   **Payment Integration**: Seamless integration with Razorpay for handling subscriptions.
*   **Role-Based Access Control**: Strict separation between User and Admin routes.

## 🛠️ Tech Stack

### Frontend (`apps/frontend`)
*   **Framework**: Next.js 14 (App Router)
*   **Styling**: Tailwind CSS, Framer Motion
*   **State Management**: Zustand
*   **Icons**: Lucide React
*   **HTTP Client**: Axios
*   **UI Components**: Custom Glassmorphism System

### Backend (`apps/backend`)
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: PostgreSQL (via Supabase)
*   **Authentication**: Supabase Auth
*   **Payment**: Razorpay SDK
*   **Scheduling**: node-cron (for checking expired subscriptions)
*   **Logging**: Winston

## 📂 Project Structure

This project is organized as a monorepo using **TurboRepo**.

```
.
├── apps/
│   ├── backend/    # Express.js API Server
│   └── frontend/   # Next.js Client Application
├── infra/          # Infrastructure & Database Config
└── packages/       # Shared configurations (Optional)
```

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A Supabase Project
*   A Razorpay Account

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/minervatraders.git
    cd minervatraders
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Environment Configuration

You need to configure environment variables for both the backend and frontend.

**1. Backend (`apps/backend/.env`):**
Create a `.env` file in the `apps/backend` directory:
```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_channel_id
FRONTEND_URL=http://localhost:3000
```

**2. Frontend (`apps/frontend/.env.local`):**
Create a `.env.local` file in the `apps/frontend` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the Application

To run both the frontend and backend simultaneously (managed by TurboRepo):

```bash
npm run dev
```

*   **Frontend**: Open [http://localhost:3000](http://localhost:3000)
*   **Backend API**: Running at [http://localhost:4000](http://localhost:4000)

## 🛡️ Admin Portal

The project includes a secluded Admin Portal for managing the platform.

*   **URL**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
*   **Access**: Requires a user account with the `admin` role in the `admins` table in Supabase.

**Key Admin Features:**
*   **User Management**: create, view, and delete users.
*   **Subscription Oversight**: See active subscriptions and manually intervene.
*   **Settings**: Tweak platform configurations.

## 🤝 Contributing

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License.
