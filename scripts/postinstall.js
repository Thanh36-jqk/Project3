// Postinstall: always generate Prisma client; only push schema when a real DB is configured.
// CI runs without DATABASE_URL (tests are fully mocked), Vercel/Render have it set.
const { execSync } = require('child_process');

execSync('npx prisma generate', { stdio: 'inherit' });

if (process.env.DATABASE_URL) {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
} else {
    console.log('DATABASE_URL not set — skipping prisma db push (CI/local without DB)');
}
