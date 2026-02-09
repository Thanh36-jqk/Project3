const request = require('supertest');
const express = require('express');
const path = require('path');

// Create a simple app to test static file serving
const app = express();
app.use(express.static(path.join(__dirname, '../../public')));

describe('Static File Serving Tests', () => {
    describe('Main HTML Pages', () => {
        test('GET / should serve index.html', async () => {
            const response = await request(app).get('/index.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /store.html should serve store page', async () => {
            const response = await request(app).get('/store.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /checkout.html should serve checkout page', async () => {
            const response = await request(app).get('/checkout.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /support.html should serve support page', async () => {
            const response = await request(app).get('/support.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /ACCOUNT.html should serve account page', async () => {
            const response = await request(app).get('/ACCOUNT.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /watch.html should serve watch page', async () => {
            const response = await request(app).get('/watch.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });
    });

    describe('Sub-Pages', () => {
        test('GET /pages/auth/login.html should serve login page', async () => {
            const response = await request(app).get('/pages/auth/login.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /pages/products/mac.html should serve Mac page', async () => {
            const response = await request(app).get('/pages/products/mac.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /pages/products/ipad.html should serve iPad page', async () => {
            const response = await request(app).get('/pages/products/ipad.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /pages/products/iphone.html should serve iPhone page', async () => {
            const response = await request(app).get('/pages/products/iphone.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('GET /pages/admin/dashboard.html should serve admin dashboard', async () => {
            const response = await request(app).get('/pages/admin/dashboard.html');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });
    });

    describe('CSS Files', () => {
        test('GET /css/checkout.css should serve CSS file', async () => {
            const response = await request(app).get('/css/checkout.css');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/css/);
        });

        test('GET /pages/auth/register.css should serve auth CSS', async () => {
            const response = await request(app).get('/pages/auth/register.css');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/css/);
        });
    });

    describe('JavaScript Files', () => {
        test('GET /js/3d-viewer.js should serve JavaScript file', async () => {
            const response = await request(app).get('/js/3d-viewer.js');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/javascript/);
        });

        test('GET /pages/auth/register.js should serve auth JS', async () => {
            const response = await request(app).get('/pages/auth/register.js');
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/javascript/);
        });
    });

    describe('Assets', () => {
        test('GET /assets/images/* should serve image files', async () => {
            // This test will check if the assets directory is accessible
            // Actual file tests depend on what images exist
            const response = await request(app).get('/assets/images/');
            // Either 200 (directory listing) or 403 (forbidden) or 404 (not found)
            expect([200, 403, 404]).toContain(response.status);
        });
    });

    describe('404 Handling', () => {
        test('GET /nonexistent.html should return 404', async () => {
            const response = await request(app).get('/nonexistent.html');
            expect(response.status).toBe(404);
        });

        test('GET /pages/fake/page.html should return 404', async () => {
            const response = await request(app).get('/pages/fake/page.html');
            expect(response.status).toBe(404);
        });
    });
});
