const returnController = require('../src/controllers/returnController');

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    returnRequest: {
      findUnique: jest.fn(),
      create:     jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
    },
    order: { findUnique: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const DELIVERED_ORDER = {
  id: 'order-1', userId: 'user-1',
  status: 'Delivered', returnRequest: null,
};

describe('returnController', () => {

  beforeEach(() => jest.clearAllMocks());

  // --- createReturnRequest ---
  describe('createReturnRequest', () => {
    it('returns 400 for invalid reason', async () => {
      const req = { params: { id: 'o1' }, body: { reason: 'Bad reason' }, user: { id: 'u1' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      const req = { params: { id: 'o1' }, body: { reason: 'Other' }, user: { id: 'u1' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 if order not delivered', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...DELIVERED_ORDER, status: 'Pending' });
      const req = { params: { id: 'o1' }, body: { reason: 'Other' }, user: { id: 'user-1' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 409 if return request already exists', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...DELIVERED_ORDER, returnRequest: { id: 'ret-1', status: 'Pending' },
      });
      const req = { params: { id: 'o1' }, body: { reason: 'Other' }, user: { id: 'user-1' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates return request successfully', async () => {
      prisma.order.findUnique.mockResolvedValue(DELIVERED_ORDER);
      prisma.returnRequest.create.mockResolvedValue({ id: 'ret-1', status: 'Pending' });
      const req = { params: { id: 'o1' }, body: { reason: 'Other', description: 'details' }, user: { id: 'user-1' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 403 for wrong user', async () => {
      prisma.order.findUnique.mockResolvedValue(DELIVERED_ORDER);
      const req = { params: { id: 'o1' }, body: { reason: 'Other' }, user: { id: 'wrong-user' } };
      const res = mockRes();
      await returnController.createReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // --- getOrderReturnRequest ---
  describe('getOrderReturnRequest', () => {
    it('returns 404 when not found', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue(null);
      const req = { params: { id: 'o1' } };
      const res = mockRes();
      await returnController.getOrderReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns return request', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ id: 'ret-1' });
      const req = { params: { id: 'o1' } };
      const res = mockRes();
      await returnController.getOrderReturnRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // --- getReturnRequests ---
  describe('getReturnRequests', () => {
    it('returns list', async () => {
      prisma.returnRequest.findMany.mockResolvedValue([{ id: 'ret-1' }]);
      const req = { query: {} };
      const res = mockRes();
      await returnController.getReturnRequests(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('filters by status', async () => {
      prisma.returnRequest.findMany.mockResolvedValue([]);
      const req = { query: { status: 'Pending' } };
      const res = mockRes();
      await returnController.getReturnRequests(req, res);
      expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: 'Pending' },
      }));
    });
  });

  // --- updateReturnStatus ---
  describe('updateReturnStatus', () => {
    it('returns 400 for invalid status', async () => {
      const req = { params: { id: 'ret-1' }, body: { status: 'Unknown' } };
      const res = mockRes();
      await returnController.updateReturnStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when not found', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue(null);
      const req = { params: { id: 'ret-1' }, body: { status: 'Approved' } };
      const res = mockRes();
      await returnController.updateReturnStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 if not pending', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ id: 'ret-1', status: 'Approved' });
      const req = { params: { id: 'ret-1' }, body: { status: 'Rejected' } };
      const res = mockRes();
      await returnController.updateReturnStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('approves successfully', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ id: 'ret-1', status: 'Pending' });
      prisma.returnRequest.update.mockResolvedValue({ id: 'ret-1', status: 'Approved' });
      const req = { params: { id: 'ret-1' }, body: { status: 'Approved', adminNote: 'OK' } };
      const res = mockRes();
      await returnController.updateReturnStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

});
