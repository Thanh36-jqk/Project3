const request = require('supertest');
const express = require('express');

const controllerImpl = {
    getAddresses: (req, res) => res.status(200).json([]),
    createAddress: (req, res) => res.status(201).json({ id: 'addr-1' }),
    updateAddress: (req, res) => res.status(200).json({ id: req.params.id }),
    deleteAddress: (req, res) => res.status(200).json({ message: 'Address deleted' }),
    setDefaultAddress: (req, res) => res.status(200).json({ id: req.params.id, isDefault: true }),
};
const middlewareImpl = {
    verifyToken: (req, res, next) => { req.user = { id: 'user-1', role: 'user' }; next(); },
};

jest.mock('../../../src/controllers/addressController', () => ({
    getAddresses: (...a) => controllerImpl.getAddresses(...a),
    createAddress: (...a) => controllerImpl.createAddress(...a),
    updateAddress: (...a) => controllerImpl.updateAddress(...a),
    deleteAddress: (...a) => controllerImpl.deleteAddress(...a),
    setDefaultAddress: (...a) => controllerImpl.setDefaultAddress(...a),
}));
jest.mock('../../../src/middleware/auth', () => ({
    verifyToken: (...a) => middlewareImpl.verifyToken(...a),
    verifyAdmin: (req, res, next) => next(),
}));

const addressRoutes = require('../../../src/routes/addressRoutes');

describe('Address Routes Integration Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', addressRoutes);
    });

    beforeEach(() => {
        controllerImpl.getAddresses = (req, res) => res.status(200).json([]);
        controllerImpl.createAddress = (req, res) => res.status(201).json({ id: 'addr-1' });
        controllerImpl.updateAddress = (req, res) => res.status(200).json({ id: req.params.id });
        controllerImpl.deleteAddress = (req, res) => res.status(200).json({ message: 'Address deleted' });
        controllerImpl.setDefaultAddress = (req, res) => res.status(200).json({ id: req.params.id, isDefault: true });
        middlewareImpl.verifyToken = (req, res, next) => { req.user = { id: 'user-1' }; next(); };
    });

    describe('GET / — getAddresses', () => {
        test('should return 200 with list of addresses when authenticated', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        test('should return 401 when not authenticated', async () => {
            middlewareImpl.verifyToken = (req, res) => res.status(401).json({ message: 'Unauthorized' });
            const res = await request(app).get('/');
            expect(res.status).toBe(401);
        });
    });

    describe('POST / — createAddress', () => {
        test('should create a new address when authenticated', async () => {
            const res = await request(app)
                .post('/')
                .send({ fullName: 'Nguyen A', phone: '0901234567', address: '123 Main St' });
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
        });

        test('should return 400 for missing required fields', async () => {
            controllerImpl.createAddress = (req, res) =>
                res.status(400).json({ message: 'fullName, phone, and address are required' });
            const res = await request(app).post('/').send({ fullName: 'Only Name' });
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /:id — updateAddress', () => {
        test('should update address by id', async () => {
            const res = await request(app)
                .put('/addr-1')
                .send({ fullName: 'Updated Name' });
            expect(res.status).toBe(200);
        });

        test('should return 404 if address not found', async () => {
            controllerImpl.updateAddress = (req, res) =>
                res.status(404).json({ message: 'Address not found' });
            const res = await request(app).put('/nonexistent').send({});
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /:id — deleteAddress', () => {
        test('should delete address by id', async () => {
            const res = await request(app).delete('/addr-1');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message');
        });

        test('should return 404 if address not found', async () => {
            controllerImpl.deleteAddress = (req, res) =>
                res.status(404).json({ message: 'Address not found' });
            const res = await request(app).delete('/nonexistent');
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /:id/default — setDefaultAddress', () => {
        test('should set address as default', async () => {
            const res = await request(app).put('/addr-1/default');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('isDefault', true);
        });

        test('should return 404 if address not found', async () => {
            controllerImpl.setDefaultAddress = (req, res) =>
                res.status(404).json({ message: 'Address not found' });
            const res = await request(app).put('/nonexistent/default');
            expect(res.status).toBe(404);
        });
    });
});
