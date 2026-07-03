const prisma = require('../config/postgres');

async function saveMessage({ sessionId, userId, role, content, intent, confidence }) {
    await prisma.chatMessage.create({
        data: {
            sessionId,
            userId: userId || null,
            role,
            content,
            intent: intent || null,
            confidence: confidence !== undefined ? confidence : null,
        },
    });
}

async function getHistory(sessionId) {
    return prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
    });
}

module.exports = { saveMessage, getHistory };
