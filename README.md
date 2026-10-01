# Snack Distribution & Seller Management App

A modern, minimal web application built for managing snack inventory, setting prices, assigning stock to sellers, and tracking sales and profit margins.

Built with **React, Vite, Tailwind CSS, and Supabase**.

## Features

- **Admin Dashboard**: Manage inventory, create products, set cost/selling prices, and track overall profit.
- **Stock Transfers**: Safely assign inventory to sellers (e.g., from main warehouse to a seller).
- **Seller Interface**: Mobile-first dashboard for sellers to easily log sales, track their assigned inventory, and see their profit share.
- **Role-Based Access**: Supabase Auth and Row Level Security (RLS) ensure that sellers only see their own data and cannot see backend cost prices.

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend & Database**: Supabase (Auth, PostgreSQL, RLS)

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Open the `supabase/schema.sql` file in this repository, copy its contents, and run it in the SQL Editor. This will create all necessary tables and security policies.

### 2. Environment Variables

1. Copy the `.env.example` file and rename it to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and add your Supabase credentials (found in your Supabase Project Settings > API):
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

### 3. Running the App Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Creating the First Admin Account
By default, anyone who signs up via Supabase is inserted without a strict role, or you can manually assign roles in the Supabase Table Editor.
To create your first admin:
1. Sign up for an account via the app's login/signup page, or create a user in the Supabase Auth dashboard.
2. Go to the Supabase **Table Editor**, open the `profiles` table, and change the `role` column for your user to `admin`.
3. You can now log into the admin dashboard and create `seller` accounts directly from the Sellers Page.
