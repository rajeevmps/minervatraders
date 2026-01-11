// Set timeout to 10 seconds for slower API calls or db interactions
jest.setTimeout(10000);

// Mock environment variables if needed
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

// You can add global mocks here
// jest.mock('../src/config/db', () => ({
//   supabase: { ...mockImplementation }
// }));
