const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../../src/controllers/authController');
const prisma = require('../../../src/config/postgres');
const cartMergeService = require('../../../src/services/cartMergeService');
const emailService = require('../../../src/services/emailService');

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/postgres', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  }
}));
jest.mock('../../../src/services/cartMergeService', () => ({
  mergeGuestCart: jest.fn(),
}));
jest.mock('../../../src/services/emailService', () => ({
  sendEmail: jest.fn(),
}));

describe('Auth Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1',
      cookies: {},
      connection: { remoteAddress: '127.0.0.1' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      req.body = { email: 'test@example.com', password: 'password123', name: 'Test User' };
      
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword');
      prisma.user.create.mockResolvedValue({ id: 1, email: 'test@example.com', role: 'user' });

      await authController.register(req, res);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          password: 'hashedPassword',
          name: 'Test User',
          role: 'user',
          rank: 'Silver'
        })
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Registration successful' });
    });

    it('should return error if email already exists', async () => {
      req.body = { email: 'existing@example.com', password: 'password123' };
      
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email already exists' });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should initiate OTP flow for regular user login', async () => {
      req.body = { email: 'user@example.com', password: 'password123' };

      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: 'hashedPassword',
        role: 'user',
        name: 'Normal User'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockOtpToken');
      emailService.sendEmail.mockResolvedValue(true);

      await authController.login(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        requiresOtp: true,
        otpToken: 'mockOtpToken',
        maskedEmail: expect.stringContaining('***')
      }));
      // Refresh token should NOT be created yet (only after OTP verified)
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should login an admin successfully and return tokens', async () => {
      req.body = { email: 'admin@example.com', password: 'adminPassword' };
      
      const mockAdmin = {
        id: 2,
        email: 'admin@example.com',
        password: 'hashedAdminPassword',
        role: 'admin',
        name: 'Admin User'
      };

      prisma.user.findUnique.mockResolvedValue(mockAdmin);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockAdminAccessToken');
      prisma.refreshToken.create.mockResolvedValue({ id: 2 });

      await authController.login(req, res);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('adminPassword', 'hashedAdminPassword');
      expect(jwt.sign).toHaveBeenCalled(); // Generates token with admin role
      expect(res.status).toHaveBeenCalledWith(200);
      
      // The response includes the admin role
      expect(res.json).toHaveBeenCalledWith({
        id: 2,
        email: 'admin@example.com',
        role: 'admin',
        name: 'Admin User',
        accessToken: 'mockAdminAccessToken'
      });
    });

    it('should return error for invalid credentials', async () => {
      req.body = { email: 'wrong@example.com', password: 'wrongPassword' };
      
      prisma.user.findUnique.mockResolvedValue(null); // User not found

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
    });

    it('should return error for incorrect password', async () => {
      req.body = { email: 'user@example.com', password: 'wrongPassword' };
      
      const mockUser = {
        id: 1,
        email: 'user@example.com',
        password: 'hashedPassword',
        role: 'user'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false); // Password does not match

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
    });
    
    it('should return error if user uses Google Sign-In but tries password login', async () => {
      req.body = { email: 'googleuser@example.com', password: 'password123' };

      const mockUser = {
        id: 1,
        email: 'googleuser@example.com',
        role: 'user',
        password: null
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'This account uses Google Sign-In. Please log in with Google.' });
    });

    it('should return 500 if OTP email fails to send', async () => {
      req.body = { email: 'user@example.com', password: 'password123' };

      const mockUser = { id: 1, email: 'user@example.com', password: 'hashedPassword', role: 'user' };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockOtpToken');
      emailService.sendEmail.mockRejectedValue(new Error('SMTP error'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Failed to send verification code. Please try again later.' });
    });
  });

  describe('verifyLoginOtp', () => {
    const crypto = require('crypto');

    it('should verify OTP and issue tokens on success', async () => {
      const rawOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      req.body = { otpToken: 'valid-otp-token', otp: rawOtp };

      jwt.verify.mockReturnValue({ userId: 1, otpHash, purpose: 'login_otp' });

      const mockUser = {
        id: 1, email: 'user@example.com', role: 'user', name: 'Test',
        password: 'hashed', passwordResetToken: null, passwordResetExpires: null, emailVerificationToken: null
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('newAccessToken');
      prisma.refreshToken.create.mockResolvedValue({ id: 1 });

      await authController.verifyLoginOtp(req, res);

      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        accessToken: 'newAccessToken',
        email: 'user@example.com'
      }));
    });

    it('should return 401 if OTP is incorrect', async () => {
      req.body = { otpToken: 'valid-otp-token', otp: '000000' };
      const realHash = crypto.createHash('sha256').update('123456').digest('hex');
      jwt.verify.mockReturnValue({ userId: 1, otpHash: realHash, purpose: 'login_otp' });

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Incorrect verification code. Please try again.' });
    });

    it('should return 401 if OTP token is expired', async () => {
      req.body = { otpToken: 'expired-token', otp: '123456' };
      jwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Verification code has expired. Please log in again.' });
    });

    it('should return 400 if otpToken or otp is missing', async () => {
      req.body = { otp: '123456' };

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'otpToken and otp are required' });
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access token with valid refresh token', async () => {
      req.cookies = { refreshToken: 'valid-raw-token' };

      const storedToken = {
        id: 1,
        userId: 2,
        token: 'valid-raw-token',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60)
      };
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);

      const mockUser = { id: 2, email: 'user@example.com', role: 'user' };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('fresh-access-token');

      await authController.refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accessToken: 'fresh-access-token' });
    });

    it('should return 401 if no refresh token cookie', async () => {
      req.cookies = {};

      await authController.refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if refresh token is expired', async () => {
      req.cookies = { refreshToken: 'expired-token' };

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1, userId: 2, token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000)
      });
      prisma.refreshToken.delete.mockResolvedValue({});

      await authController.refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.refreshToken.delete).toHaveBeenCalled();
    });

    it('should return 403 if refresh token not found in DB', async () => {
      req.cookies = { refreshToken: 'unknown-token' };
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await authController.refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and clear cookie', async () => {
      req.cookies = { refreshToken: 'some-token' };
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await authController.logout(req, res);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'some-token' } });
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });

    it('should still clear cookie even without a refresh token cookie', async () => {
      req.cookies = {};

      await authController.logout(req, res);

      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getProfile', () => {
    it('should return user profile with orders', async () => {
      req.user = { id: 1 };

      const mockUser = { id: 1, name: 'Test', email: 'test@example.com', role: 'user', rank: 'Silver', points: 100 };
      const mockOrders = [{ id: 'ord-1', finalAmount: 500000, status: 'Confirmed' }];

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order = { findMany: jest.fn().mockResolvedValue(mockOrders) };

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ user: mockUser, orders: mockOrders });
    });

    it('should return 404 if user not found', async () => {
      req.user = { id: 999 };
      prisma.user.findUnique.mockResolvedValue(null);

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });
  });
});
