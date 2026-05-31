const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@gmail.com';
    const password = 'za123456';
    const name = 'admin';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log('⚠️  Tài khoản admin@gmail.com đã tồn tại.');
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
        data: {
            email,
            name,
            password: hashedPassword,
            role: 'admin',
            isEmailVerified: true,
        },
    });

    console.log('✅ Tạo tài khoản admin thành công!');
    console.log(`   Email   : ${admin.email}`);
    console.log(`   Name    : ${admin.name}`);
    console.log(`   Role    : ${admin.role}`);
    console.log(`   ID      : ${admin.id}`);
}

main()
    .catch((e) => {
        console.error('❌ Lỗi:', e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
