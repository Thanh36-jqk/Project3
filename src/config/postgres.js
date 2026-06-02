const { PrismaClient } = require('@prisma/client');

// Singleton pattern — reuse the same client across warm Vercel invocations.
// connection_limit=1 prevents pool exhaustion in serverless (each Lambda
// spawns its own Prisma pool; 1 connection per instance is enough).
const buildUrl = () => {
    const url = process.env.DATABASE_URL || '';
    if (!url) return url;
    const params = [];
    if (!url.includes('connection_limit=')) params.push('connection_limit=1');
    if (!url.includes('pool_timeout=')) params.push('pool_timeout=20');
    if (!url.includes('sslmode=') && !url.includes('ssl=')) params.push('sslmode=require');
    if (!params.length) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${params.join('&')}`;
};

const prisma = globalThis._prisma ?? new PrismaClient({
    datasources: { db: { url: buildUrl() } }
});
globalThis._prisma = prisma;

module.exports = prisma;
