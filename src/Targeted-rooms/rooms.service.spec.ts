describe('RoomsService - Timed Rooms', () => {
  it('should create timed room with correct expiry', async () => {
    const room = await service.createTimedRoom('user-123', {
      name: 'Test Room',
      durationMinutes: 30,
    });
    
    expect(room.expiryTimestamp).toBeDefined();
    expect(room.durationMinutes).toBe(30);
  });
});