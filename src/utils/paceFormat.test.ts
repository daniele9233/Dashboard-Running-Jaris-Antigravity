import { describe, it, expect } from 'vitest';
import {
  parsePaceToSecs,
  secsToPaceStr,
  hmsToSecs,
  formatDuration,
  fmtPbTime,
} from './paceFormat';

describe('parsePaceToSecs', () => {
  it('parses mm:ss to seconds', () => {
    expect(parsePaceToSecs('5:42')).toBe(342);
    expect(parsePaceToSecs('4:00')).toBe(240);
    expect(parsePaceToSecs('0:30')).toBe(30);
  });

  it('returns 0 on bad input', () => {
    expect(parsePaceToSecs('')).toBe(0);
    expect(parsePaceToSecs('5')).toBe(0);
    expect(parsePaceToSecs('foo:bar')).toBe(0);
    expect(parsePaceToSecs('1:2:3')).toBe(0);
  });
});

describe('secsToPaceStr', () => {
  it('formats seconds to mm:ss with zero-pad', () => {
    expect(secsToPaceStr(342)).toBe('5:42');
    expect(secsToPaceStr(240)).toBe('4:00');
    expect(secsToPaceStr(65)).toBe('1:05');
  });

  it('rounds half-second correctly', () => {
    expect(secsToPaceStr(342.4)).toBe('5:42');
    expect(secsToPaceStr(342.6)).toBe('5:43');
  });

  it('returns "--" on non-positive', () => {
    expect(secsToPaceStr(0)).toBe('--');
    expect(secsToPaceStr(-1)).toBe('--');
  });

  it('round-trip parse → format', () => {
    expect(secsToPaceStr(parsePaceToSecs('4:30'))).toBe('4:30');
    expect(secsToPaceStr(parsePaceToSecs('6:08'))).toBe('6:08');
  });
});

describe('hmsToSecs', () => {
  it('parses h:mm:ss', () => {
    expect(hmsToSecs('1:25:42')).toBe(3600 + 25 * 60 + 42);
    expect(hmsToSecs('0:00:42')).toBe(42);
  });

  it('parses mm:ss', () => {
    expect(hmsToSecs('25:42')).toBe(25 * 60 + 42);
  });

  it('returns null on bad input', () => {
    expect(hmsToSecs('')).toBeNull();
    expect(hmsToSecs('foo')).toBeNull();
    expect(hmsToSecs('1:2:3:4')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats minutes to "Xh Ym"', () => {
    expect(formatDuration(75)).toBe('1h 15m');
    expect(formatDuration(120)).toBe('2h 0m');
  });

  it('drops "h" if zero hours', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(5)).toBe('5m');
  });
});

describe('fmtPbTime', () => {
  it('formats sub-hour as mm:ss', () => {
    expect(fmtPbTime(25.42)).toBe('25:25');
    expect(fmtPbTime(20)).toBe('20:00');
  });

  it('formats over-hour as h:mm:ss', () => {
    expect(fmtPbTime(83.75)).toBe('1:23:45');
    expect(fmtPbTime(60)).toBe('1:00:00');
  });
});
