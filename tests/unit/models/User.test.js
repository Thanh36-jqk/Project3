const mongoose = require('mongoose');
const User = require('../../src/models/User');

describe('User Model Tests', () => {
    describe('Schema Validation', () => {
        test('should create user with valid data', () => {
            const userData = {
                email: 'test@example.com',
                password: 'hashedpassword123',
                role: 'user',
                rank: 'Silver',
                points: 0,
                vouchers: [],
                wishlist: []
            };

            const user = new User(userData);
            const error = user.validateSync();

            expect(error).toBeUndefined();
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('user');
            expect(user.rank).toBe('Silver');
        });

        test('should require email field', () => {
            const user = new User({
                password: 'password123',
                role: 'user'
            });

            const error = user.validateSync();

            expect(error).toBeDefined();
            expect(error.errors.email).toBeDefined();
        });

        test('should require password field', () => {
            const user = new User({
                email: 'test@example.com',
                role: 'user'
            });

            const error = user.validateSync();

            expect(error).toBeDefined();
            expect(error.errors.password).toBeDefined();
        });

        test('should have default role as "user"', () => {
            const user = new User({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(user.role).toBe('user');
        });

        test('should have default rank as "Silver"', () => {
            const user = new User({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(user.rank).toBe('Silver');
        });

        test('should have default points as 0', () => {
            const user = new User({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(user.points).toBe(0);
        });

        test('should accept valid rank values', () => {
            const ranks = ['Silver', 'Gold', 'VIP'];

            ranks.forEach(rank => {
                const user = new User({
                    email: 'test@example.com',
                    password: 'password123',
                    rank: rank
                });

                const error = user.validateSync();
                expect(error).toBeUndefined();
                expect(user.rank).toBe(rank);
            });
        });

        test('should accept admin role', () => {
            const user = new User({
                email: 'admin@example.com',
                password: 'password123',
                role: 'admin'
            });

            const error = user.validateSync();
            expect(error).toBeUndefined();
            expect(user.role).toBe('admin');
        });

        test('should initialize wishlist as empty array', () => {
            const user = new User({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(Array.isArray(user.wishlist)).toBe(true);
            expect(user.wishlist.length).toBe(0);
        });

        test('should initialize vouchers as empty array', () => {
            const user = new User({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(Array.isArray(user.vouchers)).toBe(true);
            expect(user.vouchers.length).toBe(0);
        });
    });
});
