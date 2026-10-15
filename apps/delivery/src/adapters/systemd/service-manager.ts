import type { CommandRunner } from '../../application/ports/command-runner';
import type { ServiceManager } from '../../application/ports/service-manager';

const LIMIT_MS = 60_000;

/** `systemctl` on the template unit `mes-courses@<env>`. */
export const createSystemdServiceManager = (
  runner: CommandRunner,
): ServiceManager => {
  const unit = (environment: string) => `mes-courses@${environment}`;
  const control = async (action: string, environment: string) => {
    const result = await runner.run('systemctl', [action, unit(environment)], {
      timeoutMs: LIMIT_MS,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `systemctl ${action} ${unit(environment)} failed: ${result.stderr.trim()}`,
      );
    }
  };
  return {
    start: (environment) => control('start', environment),
    stop: (environment) => control('stop', environment),
    restart: (environment) => control('restart', environment),
    async isActive(environment) {
      const result = await runner.run(
        'systemctl',
        ['is-active', '--quiet', unit(environment)],
        { timeoutMs: LIMIT_MS },
      );
      return result.exitCode === 0;
    },
  };
};
