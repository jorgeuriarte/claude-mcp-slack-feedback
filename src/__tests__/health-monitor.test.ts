// Health Monitor tests removed - functionality no longer used
// All webhook handling is now done in Cloud Run
// Local health monitoring is not needed in the new architecture

describe('HealthMonitor (removed)', () => {
  it('is no longer used - webhooks handled by Cloud Run', () => {
    expect(true).toBe(true);
  });
});