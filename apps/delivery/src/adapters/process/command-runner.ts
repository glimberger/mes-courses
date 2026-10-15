import { spawn } from 'node:child_process';

import type {
  CommandResult,
  CommandRunner,
} from '../../application/ports/command-runner';

/** Runs a program with an argument array, never through a shell, under a time limit. */
export const createCommandRunner = (): CommandRunner => ({
  run: (command, args, options = {}) =>
    new Promise<CommandResult>((resolve) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      const timer =
        options.timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, options.timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ exitCode: 127, stdout, stderr: String(error), timedOut });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
      });
    }),
});
