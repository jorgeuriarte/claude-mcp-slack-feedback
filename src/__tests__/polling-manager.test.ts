// Polling Manager tests removed - functionality replaced by Cloud Run polling
// The old PollingManager class is no longer used
// All polling is now handled by PollingStrategy with CloudPollingClient

describe('PollingManager (removed)', () => {
  it('is no longer used - replaced by Cloud Run polling', () => {
    expect(true).toBe(true);
  });
});