const prisma = require('../../../src/config/postgres');
const { saveMessage, getHistory } = require('../../../src/services/chatHistoryService');

jest.mock('../../../src/config/postgres', () => ({
    chatMessage: { create: jest.fn(), findMany: jest.fn() },
}));

describe('chatHistoryService', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('saveMessage', () => {
        it('persists a user message with sessionId, content, intent and confidence', async () => {
            prisma.chatMessage.create.mockResolvedValue({});

            await saveMessage({
                sessionId: 'sess-1',
                userId: null,
                role: 'user',
                content: 'bảo hành máy được bao lâu',
                intent: 'bao_hanh',
                confidence: 0.97,
            });

            expect(prisma.chatMessage.create).toHaveBeenCalledWith({
                data: {
                    sessionId: 'sess-1',
                    userId: null,
                    role: 'user',
                    content: 'bảo hành máy được bao lâu',
                    intent: 'bao_hanh',
                    confidence: 0.97,
                },
            });
        });

        it('persists a model reply without intent/confidence', async () => {
            prisma.chatMessage.create.mockResolvedValue({});

            await saveMessage({
                sessionId: 'sess-1',
                userId: 'user-abc',
                role: 'model',
                content: 'Bảo hành 12 tháng.',
            });

            expect(prisma.chatMessage.create).toHaveBeenCalledWith({
                data: {
                    sessionId: 'sess-1',
                    userId: 'user-abc',
                    role: 'model',
                    content: 'Bảo hành 12 tháng.',
                    intent: null,
                    confidence: null,
                },
            });
        });
    });

    describe('getHistory', () => {
        it('returns messages for a session ordered oldest first', async () => {
            const rows = [
                { role: 'user', content: 'xin chào', createdAt: new Date('2026-01-01T00:00:00Z') },
                { role: 'model', content: 'Chào bạn!', createdAt: new Date('2026-01-01T00:00:01Z') },
            ];
            prisma.chatMessage.findMany.mockResolvedValue(rows);

            const result = await getHistory('sess-1');

            expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
                where: { sessionId: 'sess-1' },
                orderBy: { createdAt: 'asc' },
            });
            expect(result).toEqual(rows);
        });
    });
});
