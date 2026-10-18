# Project Restructuring Commands

## Current Status ✅
- ✅ Project files already moved to `/workspaces/Orderit/` root level  
- ✅ Workspace directory is `/workspaces/Orderit/`
- ✅ package.json name is `tradeloft`
- ✅ README.md references Tradeloft

## Issues to Fix ❌
The following are duplicate/conflicting routes that need cleanup:

1. **src/app/login/** - Duplicate (re-exports from (auth)/login)
2. **src/app/register/** - Duplicate (re-exports from (auth)/register)  
3. **src/app/auth/** - Duplicate (should use (auth)/ route group only)
4. **src/app/main/** - Needs to be merged into src/app/(main)/

## Restructuring Commands

**Run these commands in your terminal to clean up the duplicate routes:**

```bash
cd /workspaces/Orderit/src/app

# Step 1: Delete duplicate route folders
rm -rf login register auth

# Step 2: Move main/ contents to (main)/ and delete main/
mv main/* "(main)/"
rm -rf main

# Step 3: Verify the final structure
ls -la
```

**Or as a single command:**

```bash
cd /workspaces/Orderit/src/app && rm -rf login register auth && mv main/* "(main)/" && rm -rf main && echo "✓ Cleanup complete!" && ls -la
```

## Expected Final Structure

After running the commands, your `src/app/` directory should look like:

```
(auth)/              ← Login/Register route group
  layout.tsx
  login/
    page.tsx
  register/
    page.tsx

(main)/              ← Main app routes (previously "main/")
  layout.tsx
  buyer/
  checkout/
  marketplace/
  messages/
  page.tsx
  product/
  vendor/

api/                 ← API routes
  messages/
  notifications/
  payments/
  reviews/
  vendor/

buyer/               ← Standalone routes
checkout/
forgot-password/
globals.css
layout.tsx
marketplace/
page.tsx
vendor/
```

## Next Steps After Cleanup

1. **Run the development server:**
   ```bash
   npm run dev
   ```

2. **Verify it starts on port 3000 with no errors**

3. **Expected output:**
   ```
   ▲ Next.js 14.2.5
   - Local:        http://localhost:3000
   - Environments: .env.local
   ```

## Verification Checklist

After running the cleanup:

- [ ] No "login" or "register" folders at root of app/
- [ ] No "auth" folder at root of app/ (only in route group)
- [ ] No "main" folder at root of app/ (merged into (main)/)
- [ ] `src/app/(auth)/` route group exists
- [ ] `src/app/(main)/` route group exists with all merged content
- [ ] `npm run dev` starts successfully
- [ ] No 404 errors on `/login`, `/register`, `/auth` routes

## Notes

- The duplicate login/register files were re-exporting from the correct route group
- The auth/ folder duplicates the (auth)/ route group  
- The main/ folder contains all the actual business logic that should be in (main)/
- Route groups in Next.js use parentheses: `(auth)` and `(main)` don't appear in the URL path
