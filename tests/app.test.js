const express = require('express');
const request = require('supertest');

const mockVerifyIdToken = jest.fn();
const mockQuery = jest.fn();

jest.mock('../src/config/firebaseAdmin', () => ({
  auth: {
    verifyIdToken: mockVerifyIdToken,
  },
}));

jest.mock('../src/config/database', () => ({
  query: mockQuery,
}));

const app = require('../src/app');
const requireRole = require('../src/middleware/roleMiddleware');

describe('Hellha API', () => {
  test('GET /api/health succeeds', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Hellha API is running',
    });
  });

  test('GET /api/users/me rejects a request without a token', async () => {
    const response = await request(app).get('/api/users/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  test('role middleware rejects an unauthorized role', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ role: 'user', is_active: true }],
    });

    const roleApp = express();
    roleApp.get(
      '/admin',
      (req, res, next) => {
        req.user = { uid: 'firebase-user' };
        next();
      },
      requireRole('admin'),
      (req, res) => res.status(200).json({ success: true })
    );

    const response = await request(roleApp).get('/admin');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      'Forbidden - Insufficient permissions'
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE firebase_uid = $1'),
      ['firebase-user']
    );
  });

  test('POST /api/users/sync uses verified Firebase data', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'firebase-user',
      name: 'Test User',
      email: 'test@example.com',
    });
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          firebase_uid: 'firebase-user',
          name: 'Test User',
          email: 'test@example.com',
          role: 'user',
          is_active: true,
        },
      ],
    });

    const response = await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer fake-firebase-token');

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('user');
    expect(mockVerifyIdToken).toHaveBeenCalledWith('fake-firebase-token');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['firebase-user', 'Test User', 'test@example.com']
    );
  });

  test('POST /api/users/sync rejects client-controlled role fields', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'firebase-user',
      email: 'test@example.com',
    });

    const response = await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer fake-firebase-token')
      .send({ role: 'admin', is_active: true });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Invalid request body - No fields are accepted'
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
