// Non-authoritative connection config only (PROD-004).
// Prisma is not the schema source of truth: the canonical schema is raw SQL in
// migrations/000_baseline.sql + migrations/001..003_*.sql. See PROD-004-NOTES.md.
// Prisma 7 config file at project root
export const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/investigation';
