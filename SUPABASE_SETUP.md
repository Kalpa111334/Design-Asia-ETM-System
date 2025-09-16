# Supabase Setup Guide

## Fix "Failed to fetch" Sign-in Error

The "Failed to fetch" error occurs because Supabase environment variables are not configured.

### Step 1: Create Environment File

Create a `.env` file in your project root with the following content:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Public Base URL for meeting invitations
VITE_PUBLIC_BASE_URL=http://localhost:5173
```

### Step 2: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **Project API keys** → **anon public** → Use as `VITE_SUPABASE_ANON_KEY`

### Step 3: Update Your .env File

Replace the placeholder values with your actual Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_PUBLIC_BASE_URL=http://localhost:5173
```

### Step 4: Restart Development Server

```bash
npm run dev
```

### Common Issues

- **"Missing Supabase environment variables"**: Check that your `.env` file exists and has the correct variable names
- **"Invalid Supabase URL format"**: Ensure your URL starts with `https://` and ends with `.supabase.co`
- **"Network error"**: Verify your Supabase project is active and your internet connection is working

### Verification

After setup, you should see "Successfully connected to Supabase!" in the browser console, and sign-in should work without the "Failed to fetch" error.
