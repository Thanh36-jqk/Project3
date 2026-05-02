const passwordController = require('../../../src/controllers/passwordController');
const prisma = require('../../../src/config/postgres');
const emailService = require('../../../src/services/emailService');
const rabbitmqService = require('../../../src/services/rabbitmqService');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Mock dependencies
jest.mock('bcrypt');
jest.mock('../../../src/config/postgres', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  }
}));
jest.mock('../../../src/services/emailService', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('../../../src/services/rabbitmqService', () => ({
  publishToQueue: jest.fn(),
}));

describe('Password Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    
    // Silence console logs during testing
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('forgotPassword', () => {
    it('should return success message even if user does not exist (prevents enumeration)', async () => {
      req.body = { email: 'nonexistent@example.com' };
      prisma.user.findUnique.mockResolvedValue(null);

      await passwordController.forgotPassword(req, res);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'nonexistent@example.com' } });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    });

    it('should generate token, update user, and publish to RabbitMQ if user exists', async () => {
      req.body = { email: 'user@example.com' };
      const mockUser = { id: 1, email: 'user@example.com', name: 'Test User' };
      
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      rabbitmqService.publishToQueue.mockResolvedValue(true); // RabbitMQ succeeds

      await passwordController.forgotPassword(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        }
      });
      expect(rabbitmqService.publishToQueue).toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should fallback to direct email if RabbitMQ fails or is unavailable', async () => {
      req.body = { email: 'user@example.com' };
      const mockUser = { id: 1, email: 'user@example.com', name: 'Test User' };
      
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      rabbitmqService.publishToQueue.mockResolvedValue(false); // RabbitMQ fails/unavailable
      emailService.sendEmail.mockResolvedValue(true); // Fallback succeeds

      await passwordController.forgotPassword(req, res);

      expect(rabbitmqService.publishToQueue).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should nullify tokens and return 500 error if both messaging and email fail', async () => {
      req.body = { email: 'user@example.com' };
      const mockUser = { id: 1, email: 'user@example.com', name: 'Test User' };
      
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      rabbitmqService.publishToQueue.mockRejectedValue(new Error('Queue Error')); // Email/queue throws error
      
      await passwordController.forgotPassword(req, res);

      // Verify that it tried to rollback the tokens
      expect(prisma.user.update).toHaveBeenLastCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error sending email. Please try again later.'
      });
    });
  });

  describe('resetPassword', () => {
    it('should return 400 if token is invalid or expired', async () => {
      req.body = { token: 'invalidToken', newPassword: 'newPassword123' };
      
      prisma.user.findFirst.mockResolvedValue(null);

      await passwordController.resetPassword(req, res);

      expect(prisma.user.findFirst).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired reset token' });
    });

    it('should reset password successfully if token is valid', async () => {
      req.body = { token: 'validToken', newPassword: 'newPassword123' };
      const mockUser = { id: 1, email: 'user@example.com' };
      
      prisma.user.findFirst.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashedNewPassword');

      await passwordController.resetPassword(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'hashedNewPassword',
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Password reset successful. You can now log in with your new password.'
      });
    });
  });
});
