const productController = require('../../../src/controllers/productController');
const Product = require('../../../src/models/Product');

jest.mock('../../../src/models/Product');

describe('Product Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { params: {}, query: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('searchProducts', () => {
        it('should return empty array if no query param', async () => {
            req.query = {};
            await productController.searchProducts(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ products: [] });
        });

        it('should return matching products', async () => {
            req.query = { q: 'iPhone', limit: '5' };
            const mockProducts = [{ name: 'iPhone 15', price: 19990000 }];
            const chainMock = { select: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockProducts) };
            Product.find.mockReturnValue(chainMock);

            await productController.searchProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ products: mockProducts });
        });

        it('should escape regex special characters to prevent ReDoS', async () => {
            req.query = { q: '(iPhone+).*' };
            const chainMock = { select: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
            Product.find.mockReturnValue(chainMock);

            await productController.searchProducts(req, res);

            const call = Product.find.mock.calls[0][0];
            // Special chars must be escaped — raw regex metacharacters must NOT appear
            expect(call.name.$regex).toBe('\\(iPhone\\+\\)\\.\\*');
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getAllProducts', () => {
        it('should return all active products', async () => {
            req.query = {};
            const mockProducts = [{ name: 'iPad', price: 12000000 }];
            const chainMock = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockProducts)
            };
            Product.find.mockReturnValue(chainMock);

            await productController.getAllProducts(req, res);

            expect(Product.find).toHaveBeenCalledWith({ isActive: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockProducts);
        });

        it('should filter by category if provided', async () => {
            req.query = { category: 'iPhone' };
            const chainMock = {
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            };
            Product.find.mockReturnValue(chainMock);

            await productController.getAllProducts(req, res);

            expect(Product.find).toHaveBeenCalledWith({ isActive: true, category: 'iPhone' });
        });
    });

    describe('getProductById', () => {
        it('should return product if found and active', async () => {
            req.params.id = 'prod-123';
            const mockProduct = { _id: 'prod-123', name: 'MacBook', isActive: true };
            Product.findById.mockResolvedValue(mockProduct);

            await productController.getProductById(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(mockProduct);
        });

        it('should return 404 if product not found', async () => {
            req.params.id = 'missing-id';
            Product.findById.mockResolvedValue(null);

            await productController.getProductById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
        });

        it('should return 404 if product is inactive (soft deleted)', async () => {
            req.params.id = 'prod-inactive';
            Product.findById.mockResolvedValue({ _id: 'prod-inactive', name: 'Old Phone', isActive: false });

            await productController.getProductById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('createProduct', () => {
        it('should create product and calculate total stock from colors', async () => {
            req.body = {
                name: 'iPhone 15 Pro',
                price: 25990000,
                colors: [
                    { name: 'Black', hex: '#000', stock: 10 },
                    { name: 'White', hex: '#fff', stock: 5 }
                ]
            };
            const savedProduct = { ...req.body, stock: 15, _id: 'new-id' };
            const mockProductInstance = { save: jest.fn().mockResolvedValue(savedProduct), ...savedProduct };
            Product.mockImplementation(() => mockProductInstance);

            await productController.createProduct(req, res);

            expect(req.body.stock).toBe(15);
            expect(mockProductInstance.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should create product without colors', async () => {
            req.body = { name: 'AirPods', price: 3990000, stock: 50 };
            const mockProductInstance = { save: jest.fn().mockResolvedValue(req.body) };
            Product.mockImplementation(() => mockProductInstance);

            await productController.createProduct(req, res);

            expect(mockProductInstance.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('updateProduct', () => {
        it('should update product and recalculate stock from colors', async () => {
            req.params.id = 'prod-123';
            req.body = {
                colors: [
                    { name: 'Red', hex: '#f00', stock: 20 },
                    { name: 'Blue', hex: '#00f', stock: 30 }
                ]
            };
            const updatedProduct = { _id: 'prod-123', stock: 50 };
            Product.findByIdAndUpdate.mockResolvedValue(updatedProduct);

            await productController.updateProduct(req, res);

            expect(req.body.stock).toBe(50);
            expect(Product.findByIdAndUpdate).toHaveBeenCalledWith('prod-123', req.body, { new: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(updatedProduct);
        });
    });

    describe('updateStock', () => {
        it('should update stock with newStock value', async () => {
            req.params.id = 'prod-123';
            req.body = { newStock: 100 };
            const updatedProduct = { _id: 'prod-123', stock: 100 };
            Product.findByIdAndUpdate.mockResolvedValue(updatedProduct);

            await productController.updateStock(req, res);

            expect(Product.findByIdAndUpdate).toHaveBeenCalledWith('prod-123', { stock: 100 }, { new: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Stock updated successfully', product: updatedProduct });
        });

        it('should update stock with colors array and compute total', async () => {
            req.params.id = 'prod-456';
            req.body = {
                colors: [
                    { name: 'Black', hex: '#000', stock: 10 },
                    { name: 'White', hex: '#fff', stock: 15 }
                ]
            };
            const updatedProduct = { _id: 'prod-456', stock: 25 };
            Product.findByIdAndUpdate.mockResolvedValue(updatedProduct);

            await productController.updateStock(req, res);

            expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
                'prod-456',
                { colors: expect.any(Array), stock: 25 },
                { new: true }
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 for negative newStock', async () => {
            req.params.id = 'prod-123';
            req.body = { newStock: -5 };

            await productController.updateStock(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'newStock must be a non-negative integer' });
        });

        it('should return 400 for empty colors array', async () => {
            req.params.id = 'prod-123';
            req.body = { colors: [] };

            await productController.updateStock(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'colors must be a non-empty array' });
        });

        it('should return 400 for invalid color stock value', async () => {
            req.params.id = 'prod-123';
            req.body = { colors: [{ name: 'Black', hex: '#000', stock: -3 }] };

            await productController.updateStock(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if neither newStock nor colors provided', async () => {
            req.params.id = 'prod-123';
            req.body = {};

            await productController.updateStock(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: 'Must provide newStock or colors array' });
        });

        it('should return 404 if product not found', async () => {
            req.params.id = 'nonexistent';
            req.body = { newStock: 10 };
            Product.findByIdAndUpdate.mockResolvedValue(null);

            await productController.updateStock(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product not found' });
        });
    });

    describe('deleteProduct', () => {
        it('should soft-delete product by setting isActive=false', async () => {
            req.params.id = 'prod-123';
            Product.findByIdAndUpdate.mockResolvedValue({ _id: 'prod-123', isActive: false });

            await productController.deleteProduct(req, res);

            expect(Product.findByIdAndUpdate).toHaveBeenCalledWith('prod-123', { isActive: false }, { new: true });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Product deactivated successfully' });
        });

        it('should return 404 if product not found', async () => {
            req.params.id = 'missing';
            Product.findByIdAndUpdate.mockResolvedValue(null);

            await productController.deleteProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
