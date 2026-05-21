const addressController = require('../../../src/controllers/addressController');
const prisma = require('../../../src/config/postgres');

jest.mock('../../../src/config/postgres', () => ({
    address: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
    }
}));

describe('Address Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: 'user-1' }, params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('getAddresses', () => {
        it('should return all addresses for the user', async () => {
            const mockAddresses = [
                { id: 'addr-1', fullName: 'Nguyen Van A', isDefault: true },
                { id: 'addr-2', fullName: 'Nguyen Van B', isDefault: false },
            ];
            prisma.address.findMany.mockResolvedValue(mockAddresses);

            await addressController.getAddresses(req, res);

            expect(prisma.address.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                orderBy: [{ isDefault: 'desc' }, { id: 'asc' }]
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockAddresses);
        });
    });

    describe('createAddress', () => {
        it('should create a new address successfully', async () => {
            req.body = { label: 'Home', fullName: 'Nguyen Van A', phone: '0123456789', address: '123 Main St' };
            const newAddress = { id: 'addr-new', ...req.body, userId: 'user-1' };
            prisma.address.create.mockResolvedValue(newAddress);

            await addressController.createAddress(req, res);

            expect(prisma.address.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ userId: 'user-1', fullName: 'Nguyen Van A' })
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(newAddress);
        });

        it('should return 400 if required fields are missing', async () => {
            req.body = { fullName: 'Nguyen Van A' };

            await addressController.createAddress(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'fullName, phone, and address are required' });
        });

        it('should unset other defaults when creating a new default address', async () => {
            req.body = { fullName: 'Nguyen Van A', phone: '0901234567', address: '456 Side St', isDefault: true };
            prisma.address.updateMany.mockResolvedValue({ count: 2 });
            prisma.address.create.mockResolvedValue({ id: 'addr-new', isDefault: true });

            await addressController.createAddress(req, res);

            expect(prisma.address.updateMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                data: { isDefault: false }
            });
            expect(prisma.address.create).toHaveBeenCalled();
        });
    });

    describe('updateAddress', () => {
        it('should update an existing address', async () => {
            req.params.id = 'addr-1';
            req.body = { fullName: 'Updated Name', phone: '0987654321' };
            const existing = { id: 'addr-1', userId: 'user-1' };
            const updated = { ...existing, ...req.body };

            prisma.address.findFirst.mockResolvedValue(existing);
            prisma.address.update.mockResolvedValue(updated);

            await addressController.updateAddress(req, res);

            expect(prisma.address.update).toHaveBeenCalledWith({
                where: { id: 'addr-1' },
                data: expect.objectContaining({ fullName: 'Updated Name', phone: '0987654321' })
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(updated);
        });

        it('should return 404 if address does not belong to user', async () => {
            req.params.id = 'addr-other';
            prisma.address.findFirst.mockResolvedValue(null);

            await addressController.updateAddress(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Address not found' });
        });
    });

    describe('deleteAddress', () => {
        it('should delete an address that belongs to the user', async () => {
            req.params.id = 'addr-1';
            prisma.address.findFirst.mockResolvedValue({ id: 'addr-1', userId: 'user-1' });
            prisma.address.delete.mockResolvedValue({});

            await addressController.deleteAddress(req, res);

            expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Address deleted' });
        });

        it('should return 404 if address not found or belongs to another user', async () => {
            req.params.id = 'addr-other';
            prisma.address.findFirst.mockResolvedValue(null);

            await addressController.deleteAddress(req, res);

            expect(prisma.address.delete).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('setDefaultAddress', () => {
        it('should set an address as default and unset others', async () => {
            req.params.id = 'addr-1';
            const existing = { id: 'addr-1', userId: 'user-1' };
            const updated = { ...existing, isDefault: true };

            prisma.address.findFirst.mockResolvedValue(existing);
            prisma.address.updateMany.mockResolvedValue({ count: 2 });
            prisma.address.update.mockResolvedValue(updated);

            await addressController.setDefaultAddress(req, res);

            expect(prisma.address.updateMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                data: { isDefault: false }
            });
            expect(prisma.address.update).toHaveBeenCalledWith({
                where: { id: 'addr-1' },
                data: { isDefault: true }
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(updated);
        });

        it('should return 404 if address not found', async () => {
            req.params.id = 'addr-missing';
            prisma.address.findFirst.mockResolvedValue(null);

            await addressController.setDefaultAddress(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
