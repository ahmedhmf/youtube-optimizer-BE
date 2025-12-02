# Invitation System - Closed Beta Testing

This system restricts registration to users with valid invitation codes during the closed beta phase.

## Overview

- **Status**: Closed Beta (invitation-only registration)
- **Purpose**: Control access during early testing phase
- **Type**: Code-based invitations with optional email restrictions

## How It Works

### For End Users

1. **Receive Invitation Code**
   - Format: `BETA-XXXX-XXXX` (e.g., `BETA-A1B2-C3D4`)
   - Received via email, direct message, or other channel
   - May be restricted to a specific email address

2. **Validate Code** (Optional but recommended)
   ```bash
   curl -X POST https://your-api.com/invitations/validate \
     -H "Content-Type: application/json" \
     -d '{"code":"BETA-A1B2-C3D4","email":"user@example.com"}'
   ```

3. **Register with Code**
   ```bash
   curl -X POST https://your-api.com/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email":"user@example.com",
       "password":"SecurePass123!",
       "name":"John Doe",
       "invitationCode":"BETA-A1B2-C3D4"
     }'
   ```

### For Admins

1. **Generate Invitation Codes**
   ```bash
   curl -X POST https://your-api.com/invitations \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email":"specific-user@example.com",
       "maxUses":1,
       "expiresInDays":30,
       "metadata":{"source":"twitter","campaign":"launch"}
     }'
   ```

2. **View All Invitations**
   ```bash
   curl https://your-api.com/invitations \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Get Statistics**
   ```bash
   curl https://your-api.com/invitations/stats \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

4. **Delete/Revoke Invitation**
   ```bash
   curl -X DELETE https://your-api.com/invitations/INVITATION_ID \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## Database Schema

### Invitations Table

```sql
CREATE TABLE invitations (
  id uuid PRIMARY KEY,
  code text UNIQUE NOT NULL,              -- e.g., "BETA-A1B2-C3D4"
  email text,                             -- Optional: restrict to email
  max_uses integer NOT NULL DEFAULT 1,     -- How many times code can be used
  current_uses integer NOT NULL DEFAULT 0, -- Current usage count
  created_by uuid,                        -- Admin who created it
  expires_at timestamp,                   -- Optional expiration
  metadata jsonb,                         -- Additional data
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### Invitation Usage Table

```sql
CREATE TABLE invitation_usage (
  id uuid PRIMARY KEY,
  invitation_id uuid REFERENCES invitations(id),
  user_id uuid REFERENCES auth.users(id),
  used_at timestamp DEFAULT now()
);
```

## API Endpoints

### Public Endpoints

#### POST /invitations/validate
Validate an invitation code before registration.

**Request:**
```json
{
  "code": "BETA-A1B2-C3D4",
  "email": "user@example.com"  // Optional
}
```

**Response (Valid):**
```json
{
  "success": true,
  "message": "Invitation code is valid",
  "data": {
    "code": "BETA-A1B2-C3D4"
  }
}
```

**Response (Invalid):**
```json
{
  "success": false,
  "message": "Invitation code has expired",
  "data": null
}
```

### Admin Endpoints (Requires Authentication + Admin Role)

#### POST /invitations
Create a new invitation code.

**Request:**
```json
{
  "email": "specific-user@example.com",  // Optional: restrict to email
  "maxUses": 1,                          // Default: 1
  "expiresInDays": 30,                   // Optional
  "metadata": {                          // Optional
    "source": "twitter",
    "campaign": "launch",
    "referrer": "influencer-name"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation created successfully",
  "data": {
    "code": "BETA-A1B2-C3D4",
    "email": "specific-user@example.com",
    "maxUses": 1,
    "expiresAt": "2025-12-30T12:00:00.000Z"
  }
}
```

#### GET /invitations
List all invitation codes.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "BETA-A1B2-C3D4",
      "email": "user@example.com",
      "max_uses": 1,
      "current_uses": 1,
      "expires_at": "2025-12-30T12:00:00.000Z",
      "metadata": {"source": "twitter"},
      "created_at": "2025-11-30T12:00:00.000Z"
    }
  ]
}
```

#### GET /invitations/stats
Get invitation statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "active": 45,
    "expired": 10,
    "fullyUsed": 45,
    "totalUses": 55
  }
}
```

#### DELETE /invitations/:id
Revoke an invitation code.

**Response:**
```json
{
  "success": true,
  "message": "Invitation deleted successfully"
}
```

## Invitation Code Validation Rules

An invitation code is valid if ALL of the following are true:

1. ✅ Code exists in database
2. ✅ Not expired (if `expires_at` is set)
3. ✅ Has available uses (`current_uses < max_uses`)
4. ✅ Email matches (if invitation has specific email restriction)

## Use Cases

### 1. General Beta Access (No Email Restriction)
```json
{
  "maxUses": 100,
  "expiresInDays": 90,
  "metadata": {"campaign": "public-beta"}
}
```
- Creates one code that 100 people can use
- Anyone with the code can register
- Expires in 90 days

### 2. Targeted Invitation (Email-Restricted)
```json
{
  "email": "vip@example.com",
  "maxUses": 1,
  "metadata": {"source": "direct-outreach"}
}
```
- Only `vip@example.com` can use this code
- Single-use code
- Never expires (unless manually deleted)

### 3. Influencer Referral Codes
```json
{
  "maxUses": 50,
  "expiresInDays": 30,
  "metadata": {
    "influencer": "john_tech",
    "platform": "youtube",
    "video_url": "https://youtube.com/..."
  }
}
```
- Track which influencer brought users
- 50 people can use per code
- Expires in 30 days

### 4. Time-Limited Event Access
```json
{
  "maxUses": 1000,
  "expiresInDays": 7,
  "metadata": {"event": "product-hunt-launch"}
}
```
- Product Hunt launch week
- 1000 registrations allowed
- Expires after 7 days

## Admin Dashboard Integration

### Frontend Display

```typescript
interface Invitation {
  id: string;
  code: string;
  email: string | null;
  maxUses: number;
  currentUses: number;
  expiresAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  status: 'active' | 'expired' | 'fully-used';
}

// Calculate status
function getInvitationStatus(inv: Invitation): string {
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    return 'expired';
  }
  if (inv.currentUses >= inv.maxUses) {
    return 'fully-used';
  }
  return 'active';
}
```

### Recommended UI Features

1. **Invitation List Table**
   - Code, Email (if restricted), Uses (current/max), Status, Expires
   - Actions: Copy code, Delete, View usage details

2. **Create Invitation Modal**
   - Email (optional)
   - Max uses (default: 1)
   - Expiration (optional)
   - Metadata/Notes

3. **Statistics Dashboard**
   - Total invitations
   - Active vs Expired vs Fully Used
   - Total registrations from invitations
   - Conversion rate by source/campaign

4. **Bulk Actions**
   - Generate multiple codes at once
   - Export invitation list to CSV
   - Bulk delete expired codes

## Testing Locally

### 1. Apply Migration

```bash
npm run db:push
```

### 2. Create Admin User

Use Supabase dashboard or SQL:
```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### 3. Login as Admin

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

Save the `accessToken` from response.

### 4. Create Invitation

```bash
curl -X POST http://localhost:3000/invitations \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxUses":1,"expiresInDays":30}'
```

Save the `code` from response.

### 5. Test Registration

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"testuser@example.com",
    "password":"TestPass123!",
    "name":"Test User",
    "invitationCode":"BETA-XXXX-XXXX"
  }'
```

### 6. Test Invalid Registration (Without Code)

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"testuser2@example.com",
    "password":"TestPass123!",
    "name":"Test User 2"
  }'
```

Should return 403 Forbidden.

## Transition to Open Registration

When ready to open registration to public:

### Option 1: Quick Disable (Environment Variable)
```env
# Add to .env
INVITATION_REQUIRED=false
```

Update `auth.service.ts`:
```typescript
async register(registerDto: RegisterDto): Promise<AuthResponse> {
  // Check environment variable
  const invitationRequired = process.env.INVITATION_REQUIRED !== 'false';
  
  if (invitationRequired && registerDto.invitationCode) {
    // Validate invitation
  }
  
  // Continue with registration...
}
```

### Option 2: Make invitationCode Optional
Update `register.dto.ts`:
```typescript
@IsOptional()  // Add this
@IsString()
invitationCode?: string;  // Make optional
```

Update validation logic to skip if not provided.

### Option 3: Remove Invitation System
1. Remove `invitationCode` from `RegisterDto`
2. Remove validation in `auth.service.ts`
3. Update API documentation
4. Keep database tables for historical records

## Security Considerations

1. **Rate Limiting**
   - Validate endpoint should be rate-limited
   - Prevents brute-force code guessing
   - Current: 10 requests per 15 minutes on auth endpoints

2. **Code Generation**
   - Uses cryptographically secure random bytes
   - Format prevents easy guessing: `BETA-XXXX-XXXX`
   - 8 random characters = 4.3 billion combinations

3. **Email Validation**
   - Email-restricted codes cannot be used by others
   - Validation is case-insensitive

4. **Expiration**
   - Expired codes are automatically invalid
   - No cleanup needed (keep for analytics)

5. **Admin-Only Management**
   - Only admins can create/view/delete invitations
   - Protected by JWT + role check

## Monitoring & Analytics

### Track These Metrics

1. **Invitation Performance**
   - Conversion rate by source (metadata.source)
   - Time from code creation to first use
   - Popular vs unused codes

2. **User Acquisition**
   - Registrations per day
   - Most effective campaigns
   - Referral sources

3. **Code Health**
   - Active vs expired ratio
   - Utilization rate (used / total max uses)
   - Average uses per code

### SQL Queries

```sql
-- Conversion rate by source
SELECT 
  i.metadata->>'source' as source,
  COUNT(DISTINCT iu.user_id) as registrations,
  i.max_uses,
  ROUND(COUNT(DISTINCT iu.user_id)::numeric / NULLIF(i.max_uses, 0) * 100, 2) as utilization_percent
FROM invitations i
LEFT JOIN invitation_usage iu ON i.id = iu.invitation_id
GROUP BY i.id, i.metadata->>'source', i.max_uses
ORDER BY registrations DESC;

-- Registration timeline
SELECT 
  DATE(iu.used_at) as date,
  COUNT(*) as registrations
FROM invitation_usage iu
GROUP BY DATE(iu.used_at)
ORDER BY date DESC;
```

## Troubleshooting

### Issue: "Invalid invitation code"
- **Check**: Does code exist in database?
- **Check**: Is code spelled correctly? (case-sensitive)
- **Check**: Has it expired?
- **Check**: Are all uses consumed?

### Issue: "Email mismatch"
- **Check**: Is invitation email-restricted?
- **Check**: Does registration email match exactly?

### Issue: "Cannot create invitation" (Admin)
- **Check**: Is user actually admin role in database?
- **Check**: Is JWT token valid and not expired?
- **Check**: Check logs for database errors

### Issue: Migration fails
- **Check**: Are invitations tables already created?
- **Solution**: Use `npx supabase migration repair`

## Support

For issues or questions:
- Check logs: `railway logs` or local console
- Review Supabase dashboard for database state
- Contact: [your-email@domain.com]

---

**Last Updated:** November 30, 2025  
**Status:** Active (Closed Beta)
