const request = require('supertest');
const app = require('../../src/app'); // Ensure app is exported without listening in a separate file if possible, or handle port conflicts
const { supabase } = require('../../src/config/db');

// Mock entire Razorpay Service to avoid real API calls
jest.mock('../../src/modules/payment/razorpay.service', () => ({
    createOrder: jest.fn().mockResolvedValue({ id: 'order_rzp_mock', amount: 5000, currency: 'INR' }),
    verifyPaymentSignature: jest.fn().mockReturnValue(true)
}));

// Mock Supabase Middleware for Auth
jest.mock('../../src/middlewares/auth.middleware', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'test_user_id', role: 'user' };
        next();
    },
    authorize: () => (req, res, next) => next()
}));

// Mock Supabase DB calls for Controller
jest.mock('../../src/config/db', () => ({
    supabase: {
        from: jest.fn()
    }
}));

describe('Payment API', () => {
    beforeAll(() => {
        // Setup Supabase mocks common for these tests
        const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'internal_order_1' }, error: null });
        const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

        const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { order_id: 'internal_order_1' }, error: null }) }) }) });

        require('../../src/config/db').supabase.from.mockImplementation((table) => {
            if (table === 'orders') return { insert: mockInsert, update: jest.fn().mockReturnValue({ eq: jest.fn() }) };
            if (table === 'payments') return { insert: mockInsert, update: mockUpdate };
            return { select: jest.fn() };
        });
    });

    test('POST /api/v1/payments/create-order should create valid order', async () => {
        const res = await request(app)
            .post('/api/v1/payments/create-order')
            .send({ amount: 5000 });

        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBe('order_rzp_mock');
        expect(res.body.internal_order_id).toBe('internal_order_1');
    });

    test('POST /api/v1/payments/verify should verify valid signature', async () => {
        const res = await request(app)
            .post('/api/v1/payments/verify')
            .send({
                orderId: 'order_rzp_mock',
                paymentId: 'pay_mock_123',
                signature: 'valid_signature'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Payment verified successfully');
    });
});
