const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../../src/controllers/authController');
const prisma = require('../../../src/config/postgres');
const cartMergeService = require('../../../src/services/cartMergeService');

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
    deleteMany: jest.fn(),
  }
}));
jest.mock('../../../src/services/cartMergeService', () => ({
  mergeGuestCart: jest.fn(),
}));

describe('Auth Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
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
    it('should login a user successfully and return tokens', async () => {
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
      jwt.sign.mockReturnValue('mockAccessToken');
      prisma.refreshToken.create.mockResolvedValue({ id: 1 });

      await authController.login(req, res);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(jwt.sign).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', expect.any(String), expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      
      // Ensure password is not in the response
      expect(res.json).toHaveBeenCalledWith({
        id: 1,
        email: 'user@example.com',
        role: 'user',
        name: 'Normal User',
        accessToken: 'mockAccessToken'
      });
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
        password: null // Google users don't have a password
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'This account uses Google Sign-In. Please log in with Google.' });
    });
  });
});
