import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../index.js';

describe('Structured Logger', () => {
  it('should respect log level weights', () => {
    const logger = new Logger('silent');
    const spyLog = vi.spyOn(console, 'log');

    logger.info('Test info');
    expect(spyLog).not.toHaveBeenCalled();

    logger.setLevel('normal');
    logger.info('Normal info');
    expect(spyLog).toHaveBeenCalledWith('[INFO] Normal info');

    spyLog.mockRestore();
  });

  it('should redact sensitive credentials from log outputs', () => {
    const logger = new Logger('normal');
    const spyLog = vi.spyOn(console, 'log');

    logger.info('Connecting using key sk-1234567890abcdef1234567890abcdef');
    expect(spyLog).toHaveBeenCalledWith('[INFO] Connecting using key [REDACTED_SECRET]');

    spyLog.mockRestore();
  });
});
