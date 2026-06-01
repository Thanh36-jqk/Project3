const { pushAudit, getAuditLogs } = require('../../../src/utils/auditLog');

// Reset internal state between tests by clearing the module cache
beforeEach(() => {
    jest.resetModules();
});

describe('auditLog utility', () => {
    let pushAudit, getAuditLogs;

    beforeEach(() => {
        ({ pushAudit, getAuditLogs } = require('../../../src/utils/auditLog'));
    });

    it('returns empty array initially', () => {
        expect(getAuditLogs()).toEqual([]);
    });

    it('pushAudit adds entry with timestamp and action', () => {
        pushAudit('updateOrderStatus', { orderId: '123', status: 'Confirmed' });
        const logs = getAuditLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0].action).toBe('updateOrderStatus');
        expect(logs[0].orderId).toBe('123');
        expect(logs[0].status).toBe('Confirmed');
        expect(logs[0].timestamp).toBeDefined();
    });

    it('getAuditLogs returns newest first', () => {
        pushAudit('actionA');
        pushAudit('actionB');
        const logs = getAuditLogs();
        expect(logs[0].action).toBe('actionB');
        expect(logs[1].action).toBe('actionA');
    });

    it('pushAudit works with no meta', () => {
        pushAudit('deleteReview');
        const logs = getAuditLogs();
        expect(logs[0].action).toBe('deleteReview');
    });

    it('enforces ring buffer cap of 100 entries', () => {
        for (let i = 0; i < 101; i++) pushAudit(`action${i}`);
        const logs = getAuditLogs();
        expect(logs).toHaveLength(100);
        // newest first — last pushed should be at index 0
        expect(logs[0].action).toBe('action100');
        // oldest pushed (action0) should have been evicted
        expect(logs.find(l => l.action === 'action0')).toBeUndefined();
    });
});
