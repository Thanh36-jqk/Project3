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
    update: jest.fn(),
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
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/emailTemplates', () => ({
  buildVerificationEmail: jest.fn().mockReturnValue('<html>verify</html>'),
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
      redirect: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      req.body = { email: 'test@example.com', password: 'password123', name: 'Test User' };
      
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword');
      prisma.user.create.mockResolvedValue({ id: 1, email: 'test@example.com', name: 'Test User', role: 'user' });
      prisma.user.update.mockResolvedValue({});
      jwt.sign.mockReturnValue('mock-verification-jwt');

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
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ emailVerificationToken: expect.any(String) })
      }));
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.',
        requiresEmailVerification: true
      });
    });

    it('should return error if email already exists', async () => {
      req.body = { email: 'existing@example.com', password: 'password123' };

      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email already exists' });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should merge guest cart after registering if guestCart is provided', async () => {
      req.body = {
        email: 'new@example.com', password: 'pass123', name: 'New User',
        guestCart: [{ productId: 'p1', quantity: 2 }]
      };
      prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({ id: 99, email: 'new@example.com', name: '', role: 'user' });
      prisma.user.update.mockResolvedValue({});
      jwt.sign.mockReturnValue('verify-jwt');
      cartMergeService.mergeGuestCart.mockResolvedValue({});

      await authController.register(req, res);

      expect(cartMergeService.mergeGuestCart).toHaveBeenCalledWith(99, req.body.guestCart);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 500 on unexpected error during registration', async () => {
      req.body = { email: 'err@example.com', password: 'pass' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB down'));

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
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

    it('should return 500 on unexpected server error during login', async () => {
      req.body = { email: 'user@example.com', password: 'pass' };
      prisma.user.findUnique.mockRejectedValue(new Error('DB crash'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
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

    it('should return 401 if token purpose is not login_otp', async () => {
      req.body = { otpToken: 'wrong-purpose-token', otp: '123456' };
      jwt.verify.mockReturnValue({ userId: 1, otpHash: 'hash', purpose: 'password_reset' });

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token purpose' });
    });

    it('should return 404 if user not found after valid OTP', async () => {
      const rawOtp = '654321';
      const otpHash = require('crypto').createHash('sha256').update(rawOtp).digest('hex');
      req.body = { otpToken: 'valid-token', otp: rawOtp };
      jwt.verify.mockReturnValue({ userId: 999, otpHash, purpose: 'login_otp' });
      prisma.user.findUnique.mockResolvedValue(null);

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should merge guest cart after OTP login if guestCart is provided', async () => {
      const rawOtp = '112233';
      const otpHash = require('crypto').createHash('sha256').update(rawOtp).digest('hex');
      req.body = {
        otpToken: 'valid-token', otp: rawOtp,
        guestCart: [{ productId: 'p1', quantity: 1 }]
      };
      jwt.verify.mockReturnValue({ userId: 1, otpHash, purpose: 'login_otp' });

      const mockUser = {
        id: 1, email: 'user@example.com', role: 'user', name: 'Test',
        password: 'h', passwordResetToken: null, passwordResetExpires: null, emailVerificationToken: null
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('token');
      prisma.refreshToken.create.mockResolvedValue({ id: 1 });
      cartMergeService.mergeGuestCart.mockResolvedValue({});

      await authController.verifyLoginOtp(req, res);

      expect(cartMergeService.mergeGuestCart).toHaveBeenCalledWith(1, req.body.guestCart);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 on unexpected error in verifyLoginOtp', async () => {
      const rawOtp = '999888';
      const correctHash = require('crypto').createHash('sha256').update(rawOtp).digest('hex');
      req.body = { otpToken: 'tok', otp: rawOtp };
      jwt.verify.mockReturnValue({ userId: 1, otpHash: correctHash, purpose: 'login_otp' });
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await authController.verifyLoginOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
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

    it('should return 403 and delete token if user was deleted after token was issued', async () => {
      req.cookies = { refreshToken: 'orphan-token' };

      const storedToken = {
        id: 5, userId: 99, token: 'orphan-token',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60)
      };
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.refreshToken.delete.mockResolvedValue({});

      await authController.refreshAccessToken(req, res);

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    it('should return 500 on unexpected error in refreshAccessToken', async () => {
      req.cookies = { refreshToken: 'valid-token' };
      prisma.refreshToken.findUnique.mockRejectedValue(new Error('DB error'));

      await authController.refreshAccessToken(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
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

    it('should return 500 on DB error in getProfile', async () => {
      req.user = { id: 1 };
      prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully and redirect with verified=true', async () => {
      req.query = { token: 'valid-jwt' };
      jwt.verify.mockReturnValue({ userId: 'user-1', token: 'raw-token', purpose: 'email_verification' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isEmailVerified: false,
        emailVerificationToken: 'raw-token'
      });
      prisma.user.update.mockResolvedValue({});

      await authController.verifyEmail(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isEmailVerified: true, emailVerificationToken: null }
      });
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('verified=true'));
    });

    it('should redirect with token_expired if JWT is invalid', async () => {
      req.query = { token: 'expired-jwt' };
      jwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await authController.verifyEmail(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('token_expired'));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should redirect with verified=already if email already verified', async () => {
      req.query = { token: 'valid-jwt' };
      jwt.verify.mockReturnValue({ userId: 'user-1', token: 'raw-token', purpose: 'email_verification' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isEmailVerified: true,
        emailVerificationToken: null
      });

      await authController.verifyEmail(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('already'));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should redirect with invalid_token if token nonce does not match', async () => {
      req.query = { token: 'tampered-jwt' };
      jwt.verify.mockReturnValue({ userId: 'user-1', token: 'wrong-nonce', purpose: 'email_verification' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isEmailVerified: false,
        emailVerificationToken: 'correct-nonce'
      });

      await authController.verifyEmail(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('invalid_token'));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should redirect with invalid_token if no token query param', async () => {
      req.query = {};

      await authController.verifyEmail(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('invalid_token'));
    });
  });

  describe('resendVerification', () => {
    it('should send verification email and return success message', async () => {
      req.body = { email: 'unverified@example.com' };
      const mockUser = { id: 'u1', email: 'unverified@example.com', name: 'User', isEmailVerified: false };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});
      jwt.sign.mockReturnValue('new-verify-jwt');

      await authController.resendVerification(req, res);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('should return success even when email does not exist (prevent enumeration)', async () => {
      req.body = { email: 'nobody@example.com' };
      prisma.user.findUnique.mockResolvedValue(null);

      await authController.resendVerification(req, res);

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return success without sending email if already verified', async () => {
      req.body = { email: 'verified@example.com' };
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isEmailVerified: true });

      await authController.resendVerification(req, res);

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if email body is missing', async () => {
      req.body = {};

      await authController.resendVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('googleCallback', () => {
    it('should redirect with token in URL fragment (#), not query param (?)', async () => {
      req.user = { id: 'g-user', role: 'user' };
      jwt.sign.mockReturnValue('google-access-token');
      prisma.refreshToken.create.mockResolvedValue({});

      await authController.googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalled();
      const redirectUrl = res.redirect.mock.calls[0][0];
      expect(redirectUrl).not.toMatch(/\?token=/);
      expect(redirectUrl).toMatch(/#token=/);
    });

    it('should redirect to error page if DB fails during Google callback', async () => {
      req.user = { id: 'g-user', role: 'user' };
      jwt.sign.mockReturnValue('google-access-token');
      prisma.refreshToken.create.mockRejectedValue(new Error('DB error'));

      await authController.googleCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('oauth_failed'));
    });
  });
});
