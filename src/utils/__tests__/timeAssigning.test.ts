import { TimeAssigningUtils } from '../timeAssigning';

describe('TimeAssigningUtils', () => {
  describe('toTotalMinutes', () => {
    it('should convert hours and minutes to total minutes', () => {
      expect(TimeAssigningUtils.toTotalMinutes(1, 30)).toBe(90);
      expect(TimeAssigningUtils.toTotalMinutes(2, 0)).toBe(120);
      expect(TimeAssigningUtils.toTotalMinutes(0, 45)).toBe(45);
    });
  });

  describe('fromTotalMinutes', () => {
    it('should convert total minutes to hours and minutes', () => {
      const result1 = TimeAssigningUtils.fromTotalMinutes(90);
      expect(result1.hours).toBe(1);
      expect(result1.minutes).toBe(30);
      expect(result1.totalMinutes).toBe(90);

      const result2 = TimeAssigningUtils.fromTotalMinutes(120);
      expect(result2.hours).toBe(2);
      expect(result2.minutes).toBe(0);
      expect(result2.totalMinutes).toBe(120);
    });
  });

  describe('formatTimeInput', () => {
    it('should format time input correctly', () => {
      expect(TimeAssigningUtils.formatTimeInput(1, 30)).toBe('1h 30m');
      expect(TimeAssigningUtils.formatTimeInput(2, 0)).toBe('2h 0m');
      expect(TimeAssigningUtils.formatTimeInput(0, 45)).toBe('45m');
    });
  });

  describe('parseTimeString', () => {
    it('should parse time strings correctly', () => {
      const result1 = TimeAssigningUtils.parseTimeString('2h 30m');
      expect(result1.hours).toBe(2);
      expect(result1.minutes).toBe(30);
      expect(result1.totalMinutes).toBe(150);

      const result2 = TimeAssigningUtils.parseTimeString('90m');
      expect(result2.hours).toBe(1);
      expect(result2.minutes).toBe(30);
      expect(result2.totalMinutes).toBe(90);

      const result3 = TimeAssigningUtils.parseTimeString('1.5h');
      expect(result3.hours).toBe(1);
      expect(result3.minutes).toBe(30);
      expect(result3.totalMinutes).toBe(90);
    });
  });

  describe('validateTimeInput', () => {
    it('should validate time input correctly', () => {
      expect(TimeAssigningUtils.validateTimeInput(1, 30).isValid).toBe(true);
      expect(TimeAssigningUtils.validateTimeInput(0, 0).isValid).toBe(false);
      expect(TimeAssigningUtils.validateTimeInput(-1, 0).isValid).toBe(false);
      expect(TimeAssigningUtils.validateTimeInput(1, 60).isValid).toBe(false);
      expect(TimeAssigningUtils.validateTimeInput(25, 0).isValid).toBe(false);
    });
  });
});


























