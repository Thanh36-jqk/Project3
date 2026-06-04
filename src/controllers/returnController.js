const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALID_REASONS = [
  'Defective / damaged product',
  'Wrong item received',
  'Item not as described',
  'Changed my mind',
  'Other',
];

/**
 * POST /api/orders/:id/return
 * Submit a return request for a delivered/completed order.
 */
exports.createReturnRequest = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { reason, description } = req.body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: `Invalid reason. Choose from: ${VALID_REASONS.join(', ')}` });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { returnRequest: true },
    });

    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (!['Delivered', 'Completed'].includes(order.status)) {
      return res.status(400).json({ message: 'Returns are only available for delivered orders.' });
    }

    if (order.userId && req.user?.id && order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    if (order.returnRequest) {
      return res.status(409).json({ message: 'A return request already exists for this order.', returnRequest: order.returnRequest });
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId,
        userId: req.user?.id || null,
        reason,
        description: description || null,
      },
    });

    res.status(201).json({ message: 'Return request submitted.', returnRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/orders/:id/return
 * Get the return request for a specific order.
 */
exports.getOrderReturnRequest = async (req, res) => {
  try {
    const returnRequest = await prisma.returnRequest.findUnique({
      where: { orderId: req.params.id },
    });
    if (!returnRequest) return res.status(404).json({ message: 'No return request found.' });
    res.status(200).json(returnRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/returns
 * Admin: list all return requests with order and user info.
 */
exports.getReturnRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const returns = await prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            recipientName: true,
            finalAmount: true,
            paymentMethod: true,
            createdAt: true,
            items: { select: { name: true, qty: true, price: true } },
          },
        },
        user: { select: { email: true, name: true } },
      },
    });

    res.status(200).json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/admin/returns/:id/status
 * Admin: approve or reject a return request.
 */
exports.updateReturnStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }

    const returnRequest = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
    if (!returnRequest) return res.status(404).json({ message: 'Return request not found.' });

    if (returnRequest.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending requests can be updated.' });
    }

    const updated = await prisma.returnRequest.update({
      where: { id: req.params.id },
      data: { status, adminNote: adminNote || null },
    });

    res.status(200).json({ message: `Return request ${status.toLowerCase()}.`, returnRequest: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
