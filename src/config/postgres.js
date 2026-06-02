const { PrismaClient } = require('@prisma/client');

// Singleton pattern — reuse the same client across warm Vercel invocations.
// connection_limit=1 prevents pool exhaustion in serverless (each Lambda
// spawns its own Prisma pool; 1 connection per instance is enough).
const buildUrl = () => {
    const url = process.env.DATABASE_URL || '';
    if (!url || url.includes('connection_limit=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}connection_limit=1&pool_timeout=20`;
};

const prisma = globalThis._prisma ?? new PrismaClient({
    datasources: { db: { url: buildUrl() } }
});
globalThis._prisma = prisma;

module.exports = prisma;
