jest.mock('../../src/services/recoveryService', () => ({
  getRecoveryCase: jest.fn(async () => ({ id: 'c1' })),
}));
jest.mock('../../src/services/customerResponseService', () => ({
  recordCustomerResponse: jest.fn(async (caseId, message) => {
    if (caseId === 'missing') return null;
    return { caseId, intent: 'promise_to_pay', confidence: 0.95, promiseState: 'PROMISED', promisedAt: new Date().toISOString(), followUpRequired: true, followUpAt: new Date().toISOString(), nextStep: 'x' };
  }),
  settleDuePromises: jest.fn(async () => null),
  getPromiseInfo: jest.fn(async () => ({ promiseState: 'PROMISED', lastIntent: 'promise_to_pay' })),
}));
jest.mock('../../src/services/mlService', () => ({}), { virtual: false });
jest.mock('../../src/services/customerProfileService', () => ({}));
jest.mock('../../src/services/timingService', () => ({}));
jest.mock('../../src/services/incentiveService', () => ({}));
jest.mock('../../src/services/explanationService', () => ({}));
jest.mock('../../src/services/channelService', () => ({}));
jest.mock('../../src/services/messageService', () => ({}));
jest.mock('../../src/services/auditService', () => ({ getCaseAuditTrail: jest.fn(async () => []) }));
jest.mock('../../src/config/database', () => ({ query: jest.fn(async () => []) }));

const request = require('supertest');
const { app } = require('../../src/app');

describe('customer-response route wiring', () => {
  test('POST returns intent + promise state', async () => {
    const res = await request(app).post('/api/v1/cases/c1/customer-response').send({ message: 'I will pay tomorrow' });
    expect(res.status).toBe(200);
    expect(res.body.data.intent).toBe('promise_to_pay');
    expect(res.body.data.promiseState).toBe('PROMISED');
  });
  test('missing message 400, unknown case 404', async () => {
    expect((await request(app).post('/api/v1/cases/c1/customer-response').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/cases/missing/customer-response').send({ message: 'hi tomorrow pay' })).status).toBe(404);
  });
});
