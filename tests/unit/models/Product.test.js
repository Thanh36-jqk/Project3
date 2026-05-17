const Product = require('../../../src/models/Product');

describe('Product Model Tests', () => {
    describe('Schema Validation', () => {
        test('should create product with valid data', () => {
            const productData = {
                name: 'iPhone 15 Pro',
                price: 25000000,
                description: 'Latest iPhone model',
                specifications: 'A17 Pro chip, 6.1-inch display',
                image_url: '/assets/images/iphone15.jpg',
                category: 'Phone',
                stock: 10
            };

            const product = new Product(productData);
            const error = product.validateSync();

            expect(error).toBeUndefined();
            expect(product.name).toBe('iPhone 15 Pro');
            expect(product.price).toBe(25000000);
        });

        test('should require name field', () => {
            const product = new Product({
                price: 25000000,
                category: 'Phone'
            });

            const error = product.validateSync();

            expect(error).toBeDefined();
            expect(error.errors.name).toBeDefined();
        });

        test('should require price field', () => {
            const product = new Product({
                name: 'iPhone 15',
                category: 'Phone'
            });

            const error = product.validateSync();

            expect(error).toBeDefined();
            expect(error.errors.price).toBeDefined();
        });

        test('should have default stock as 0', () => {
            const product = new Product({
                name: 'iPhone 15',
                price: 25000000,
                category: 'Phone'
            });

            expect(product.stock).toBe(0);
        });

        test('should accept all valid categories', () => {
            const categories = ['Phone', 'Tablet', 'Laptop', 'Watch', 'Headphone'];

            categories.forEach(category => {
                const product = new Product({
                    name: 'Test Product',
                    price: 10000000,
                    category: category
                });

                const error = product.validateSync();
                expect(error).toBeUndefined();
                expect(product.category).toBe(category);
            });
        });

        test('should store image URL correctly', () => {
            const product = new Product({
                name: 'MacBook Pro',
                price: 45000000,
                category: 'Laptop',
                image_url: '/assets/images/macbook.jpg'
            });

            expect(product.image_url).toBe('/assets/images/macbook.jpg');
        });
    });
});
