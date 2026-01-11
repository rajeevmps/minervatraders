const subscriptionService = require('../../src/modules/subscription/subscription.service');
const { supabase } = require('../../src/config/db');

// Mock Supabase
jest.mock('../../src/config/db', () => ({
    supabase: {
        from: jest.fn()
    }
}));

describe('Subscription Service', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('createSubscription should calculate correct end date for monthly plan', async () => {
        const userId = 'user_123';
        const planId = 'plan_monthly';
        const paymentId = 'pay_123';

        // Mock getting plan
        const mockPlan = { id: 'plan_monthly', duration: 'monthly' };

        // Mock Supabase Chain
        const mockInsert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: 'sub_1' }, error: null }) }) });
        const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) });

        supabase.from.mockImplementation((table) => {
            if (table === 'subscription_plans') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({ data: mockPlan, error: null })
                        })
                    })
                };
            }
            if (table === 'user_subscriptions') {
                return {
                    update: mockUpdate,
                    insert: mockInsert
                };
            }
        });

        const sub = await subscriptionService.createSubscription(userId, planId, paymentId);

        expect(sub.id).toBe('sub_1');
        // Check if insert was called with correct date logic (roughly)
        const insertCall = mockInsert.mock.calls[0][0][0];
        const now = new Date();
        const oneMonthLater = new Date(now.setMonth(now.getMonth() + 1));

        // Allow small time difference
        expect(new Date(insertCall.end_date).getMonth()).toBe(oneMonthLater.getMonth());
    });
});
