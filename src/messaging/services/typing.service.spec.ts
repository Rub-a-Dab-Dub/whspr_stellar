import { Test, TestingModule } from '@nestjs/testing';
import { TypingService } from './typing.service';

describe('TypingService', () => {
  let service: TypingService;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TypingService],
    }).compile();
    service = module.get(TypingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setTyping', () => {
    it('marks the user as typing', () => {
      service.setTyping('u1', 'c1', jest.fn());
      expect(service.isTyping('u1', 'c1')).toBe(true);
    });

    it('auto-clears after 3 s and fires onStop callback', () => {
      const onStop = jest.fn();
      service.setTyping('u1', 'c1', onStop);
      jest.advanceTimersByTime(3000);
      expect(service.isTyping('u1', 'c1')).toBe(false);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire before 3 s', () => {
      const onStop = jest.fn();
      service.setTyping('u1', 'c1', onStop);
      jest.advanceTimersByTime(2999);
      expect(service.isTyping('u1', 'c1')).toBe(true);
      expect(onStop).not.toHaveBeenCalled();
    });

    it('debounces: resets the 3 s window on each call', () => {
      const onStop = jest.fn();
      service.setTyping('u1', 'c1', onStop);
      jest.advanceTimersByTime(2000);

      // Refresh — timer resets
      service.setTyping('u1', 'c1', onStop);
      jest.advanceTimersByTime(2000); // 4 s total, but only 2 s since last refresh
      expect(service.isTyping('u1', 'c1')).toBe(true);
      expect(onStop).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1001); // now 3 s since last refresh
      expect(service.isTyping('u1', 'c1')).toBe(false);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('tracks multiple users in different conversations independently', () => {
      const stop1 = jest.fn();
      const stop2 = jest.fn();
      service.setTyping('u1', 'c1', stop1);
      service.setTyping('u2', 'c1', stop2);

      jest.advanceTimersByTime(3000);
      expect(stop1).toHaveBeenCalledTimes(1);
      expect(stop2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTyping', () => {
    it('immediately clears indicator and fires callback', () => {
      const onStop = jest.fn();
      service.setTyping('u1', 'c1', onStop);
      service.clearTyping('u1', 'c1');

      expect(service.isTyping('u1', 'c1')).toBe(false);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('does not fire the auto-stop after an explicit clear', () => {
      const onStop = jest.fn();
      service.setTyping('u1', 'c1', onStop);
      service.clearTyping('u1', 'c1');
      jest.advanceTimersByTime(5000); // timer already cancelled
      expect(onStop).toHaveBeenCalledTimes(1); // called only once (explicit)
    });

    it('is a no-op if the user is not typing', () => {
      expect(() => service.clearTyping('u1', 'c1')).not.toThrow();
    });
  });

  describe('clearAllForUser', () => {
    it('clears all conversations for the given user', () => {
      const s1 = jest.fn();
      const s2 = jest.fn();
      const s3 = jest.fn();
      service.setTyping('u1', 'c1', s1);
      service.setTyping('u1', 'c2', s2);
      service.setTyping('u2', 'c1', s3); // different user — must not be affected

      service.clearAllForUser('u1');

      expect(service.isTyping('u1', 'c1')).toBe(false);
      expect(service.isTyping('u1', 'c2')).toBe(false);
      expect(service.isTyping('u2', 'c1')).toBe(true); // untouched
      expect(s1).toHaveBeenCalled();
      expect(s2).toHaveBeenCalled();
      expect(s3).not.toHaveBeenCalled();
    });

    it('is a no-op when the user has no active typing indicators', () => {
      expect(() => service.clearAllForUser('ghost')).not.toThrow();
    });
  });

  describe('isTyping', () => {
    it('returns false for an unknown user/conversation pair', () => {
      expect(service.isTyping('nobody', 'nowhere')).toBe(false);
    });
  });
});
