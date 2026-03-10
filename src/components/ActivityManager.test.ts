import { describe, it, expect } from 'vitest';
import { parseDayInput } from './ActivityManager';

describe('parseDayInput', () => {
  it('parses single numbers', () => {
    expect(parseDayInput('1')).toEqual([1]);
    expect(parseDayInput('15')).toEqual([15]);
    expect(parseDayInput('31')).toEqual([31]);
  });

  it('parses comma-separated numbers', () => {
    expect(parseDayInput('1, 15')).toEqual([1, 15]);
    expect(parseDayInput('5,10,20')).toEqual([5, 10, 20]);
  });

  it('sorts and deduplicates', () => {
    expect(parseDayInput('15, 1, 15')).toEqual([1, 15]);
    expect(parseDayInput('31, 1, 15')).toEqual([1, 15, 31]);
  });

  it('recognizes "first" keyword as 1', () => {
    expect(parseDayInput('first')).toEqual([1]);
    expect(parseDayInput('First')).toEqual([1]);
    expect(parseDayInput('FIRST')).toEqual([1]);
  });

  it('recognizes "last" keyword as -1', () => {
    expect(parseDayInput('last')).toEqual([-1]);
    expect(parseDayInput('Last')).toEqual([-1]);
  });

  it('mixes keywords and numbers', () => {
    expect(parseDayInput('first, 15, last')).toEqual([-1, 1, 15]);
    expect(parseDayInput('last, 1')).toEqual([-1, 1]);
  });

  it('expands numeric ranges', () => {
    expect(parseDayInput('10-15')).toEqual([10, 11, 12, 13, 14, 15]);
    expect(parseDayInput('1-3')).toEqual([1, 2, 3]);
  });

  it('expands range ending with "last"', () => {
    // 20-last → days 20–31 plus -1 sentinel for dynamic last day
    expect(parseDayInput('20-last')).toEqual([-1, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
  });

  it('expands range starting with "first"', () => {
    expect(parseDayInput('first-5')).toEqual([1, 2, 3, 4, 5]);
  });

  it('expands first-last to all days plus sentinel', () => {
    const result = parseDayInput('first-last')!;
    expect(result).toContain(-1);
    expect(result).toContain(1);
    expect(result).toContain(31);
    expect(result).toHaveLength(32); // 1-31 + -1
  });

  it('mixes ranges with numbers and keywords', () => {
    expect(parseDayInput('1, 10-12, last')).toEqual([-1, 1, 10, 11, 12]);
  });

  it('deduplicates range overlaps', () => {
    expect(parseDayInput('5, 3-7')).toEqual([3, 4, 5, 6, 7]);
  });

  it('deduplicates last keyword with last-range', () => {
    // "last" standalone and "28-last" both produce -1
    expect(parseDayInput('last, 28-last')).toEqual([-1, 28, 29, 30, 31]);
  });

  it('rejects invalid ranges', () => {
    expect(parseDayInput('15-10')).toBeUndefined();
    expect(parseDayInput('0-5')).toBeUndefined();
    expect(parseDayInput('30-35')).toBeUndefined();
    expect(parseDayInput('last-5')).toBeUndefined();
  });

  it('rejects out-of-range numbers', () => {
    expect(parseDayInput('0')).toBeUndefined();
    expect(parseDayInput('32')).toBeUndefined();
    expect(parseDayInput('-5')).toBeUndefined();
  });

  it('returns undefined for empty/invalid input', () => {
    expect(parseDayInput('')).toBeUndefined();
    expect(parseDayInput('abc')).toBeUndefined();
    expect(parseDayInput(', ,')).toBeUndefined();
  });

  it('ignores invalid tokens among valid ones', () => {
    expect(parseDayInput('1, abc, 15')).toEqual([1, 15]);
    expect(parseDayInput('first, xyz, 10-12')).toEqual([1, 10, 11, 12]);
  });
});
