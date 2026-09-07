import { describe, it, expect } from 'vitest';
import { createCliProgram } from '../index.js';
import { ExitCode, resolveExitCode } from '../utils/exit-codes.js';
import { ConfigurationError, PreflightError } from '@preflight/core';

describe('CLI Command Registration & Program Options', () => {
  it('should register all required commands', () => {
    const program = createCliProgram();
    const commandNames = program.commands.map(cmd => cmd.name());

    expect(commandNames).toContain('test');
    expect(commandNames).toContain('deploy');
    expect(commandNames).toContain('scan');
    expect(commandNames).toContain('doctor');
  });

  it('should map errors to exact exit codes', () => {
    expect(resolveExitCode(undefined)).toBe(ExitCode.SUCCESS);
    expect(resolveExitCode(new ConfigurationError('Invalid config'))).toBe(ExitCode.INVALID_USAGE);
    expect(resolveExitCode(new Error('Generic failure'))).toBe(ExitCode.SYSTEM_ERROR);
  });
});
