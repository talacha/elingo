# Authentication & Admin Setup Guide

## Overview

This guide explains how to:
1. Test user authentication end-to-end
2. Set up the super-admin role
3. Provision r@rob.cr as a super-admin

## Prerequisites

- Supabase Auth configured with email/password authentication
- Database (Neon or in-memory)
- `pnpm dev` running locally

## Test Authentication Flow

### 1. Test Sign-Up

1. Open `http://localhost:3000/registro`
2. Enter:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. Verify Supabase email confirmation (in dev mode, usually auto-confirmed)
4. User should be redirected to `/perfil` or `/login`

### 2. Test Profile Creation & Persistence

After signing up or at `/perfil`:

1. Enter student name: "María"
2. Select grade: "6º de primaria"
3. Click "Guardar perfil"
4. Verify success message appears
5. **Refresh the page** - profile should persist and display the saved values
6. API call: `GET /api/perfil` returns the saved profile

### 3. Test Chat with Authenticated User

1. Navigate to `/chat`
2. Send a message: "Tengo este problema: 3/4 + 1/2"
3. Verify:
   - ELI responds with Socratic guidance (not the answer)
   - Response includes model info in system message
   - Historyis saved to database

### 4. Test Multiple Sessions

1. From `/chat`, click "Nueva conversación"
2. Send a different message
3. Click "Mis conversaciones" panel
4. Verify:
   - Both sessions appear in the list
   - Can click to switch between them
   - Previous messages persist when switching

## Admin Setup & Super-Admin Provisioning

### Step 1: Configure Admin Access

Set the `ADMIN_EMAILS` environment variable:

**In `.env.local` (development):**
```
ADMIN_EMAILS=r@rob.cr,admin@example.com
```

**In Vercel (production):**
```bash
vercel env add ADMIN_EMAILS production
# Enter: r@rob.cr,admin@example.com
```

### Step 2: Sign Up Admin User

1. Go to `/registro`
2. Sign up with email `r@rob.cr`
3. Confirm email (in dev, usually auto-confirmed)
4. Complete profile with name "Roberto"

### Step 3: Access Admin Dashboard

1. Log in with `r@rob.cr`
2. Navigate to `/admin`
3. If access is denied (404), verify:
   - `ADMIN_EMAILS` is properly set and includes the user's email
   - User is logged in with the correct email
   - Session is fresh (try logout/login)

### Step 4: Provision Super-Admin Role

Once in the admin dashboard:

1. In the "Usuarios" section, find "Roberto" (r@rob.cr)
2. Click "Editar" in the "Rol" column
3. Select `super-admin` from the dropdown
4. Click the checkmark button to save
5. Verify the role changes to "super-admin"

### Step 5: Verify Admin Features

1. In "Modelo de IA activo" section:
   - Click "Editar" on `AI_PROVIDER`
   - Change to `openrouter` (if desired)
   - Click "Guardar"
   - Verify the change is applied (uses `/api/admin/config`)

## API Endpoints Reference

### Authentication & Profile

- `POST /api/registro` - Sign up (via Supabase)
- `POST /api/login` - Log in (via Supabase)
- `GET /api/perfil` - Get current user profile
- `PATCH /api/perfil` - Update profile (displayName, grade)

### Admin Endpoints (require `ADMIN_EMAILS` auth)

- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/role` - Change user role
- `GET /api/admin/config` - Get AI config overrides
- `PUT /api/admin/config` - Set AI config override

## Environment Variables

```bash
# Authentication
AUTH_REQUIRED=true  # Force login; false = anonymous mode also works
ADMIN_EMAILS=r@rob.cr,admin@example.com  # Comma-separated admin emails

# Database (for profile persistence)
DATABASE_URL=postgresql://...  # Neon connection string

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  # Server-side only
```

## Troubleshooting

### Profile doesn't persist after saving

1. Check `DATABASE_URL` is set and valid
2. Run `pnpm db:migrate` to apply schema migrations
3. Check browser console for API errors
4. Verify user is authenticated (`GET /api/perfil` should return 200)

### Can't access `/admin`

1. Verify `ADMIN_EMAILS` includes your email
2. Log out and log back in (session refresh)
3. Check exact email spelling (case-insensitive in code, but verify)
4. Verify `Supabase Auth` is configured

### Role change doesn't save

1. Verify you're an admin (can access `/admin`)
2. Check browser console for network errors
3. Verify database is connected (`DATABASE_URL` is set)
4. Check that the user exists in the users table

## End-to-End Test Checklist

- [ ] User can sign up at `/registro`
- [ ] Profile persists at `/perfil` (survives page refresh)
- [ ] Chat works and saves to database
- [ ] Multiple sessions can be created
- [ ] Admin (with ADMIN_EMAILS) can access `/admin`
- [ ] Admin can change user roles
- [ ] Admin can modify AI config
- [ ] Role changes immediately visible in user list
- [ ] Logout and login works correctly

## Database Schema

User roles in the database:
- `student` - Default student user
- `parent` - Parent/guardian account
- `super-admin` - Administrator with `/admin` access

Note: Admin access is controlled by `ADMIN_EMAILS` env var, not the database role. The role is for display and future use in the UI.
