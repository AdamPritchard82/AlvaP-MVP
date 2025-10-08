# Railway Database Backup Configuration

## Automatic Backups Setup

Railway provides automatic daily backups for PostgreSQL databases. To enable:

1. **Go to your Railway project dashboard**
2. **Navigate to your PostgreSQL service**
3. **Click on "Settings" tab**
4. **Enable "Automatic Backups"**
5. **Set retention period** (recommended: 7-30 days)

## Environment Variables for File Storage

Add these environment variables to your Railway backend service:

### For Local Storage (default)
```
FILE_STORAGE=local
UPLOAD_DIR=/data
```

### For Cloudflare R2 Storage
```
FILE_STORAGE=r2
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=your-bucket-name
```

### For AWS S3 Storage
```
FILE_STORAGE=s3
AWS_ENDPOINT=https://s3.amazonaws.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

## Railway Volume Setup (Alternative to R2)

If you prefer Railway Volume over cloud storage:

1. **Add Railway Volume service** to your project
2. **Mount it to your backend service** at `/data`
3. **Set environment variable**: `UPLOAD_DIR=/data`
4. **Set environment variable**: `FILE_STORAGE=local`

## Database Indexes

The migration scripts will automatically add these performance indexes:

- **Email unique constraint**
- **GIN trigram indexes** for fuzzy text search on names, titles, employers
- **GIN indexes** for JSON fields (skills, tags)
- **Composite indexes** for common query patterns
- **Partial indexes** for filtered queries

## Migration Commands

Run these commands to apply database migrations:

```bash
# Apply all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migrate:make migration_name
```

## Performance Benefits

With these indexes, you'll see significant performance improvements for:

- **Candidate search** by name, title, or employer
- **Skills-based filtering**
- **Salary range queries**
- **Tag-based searches**
- **Email lookups** (unique constraint prevents duplicates)
