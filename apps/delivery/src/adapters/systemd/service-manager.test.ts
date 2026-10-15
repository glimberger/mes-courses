import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { Recorder } from '../../application/testing/recorder';
import { createSystemdServiceManager } from './service-manager';

const setup = () => {
  const recorder = new Recorder();
  const runner = new ScriptedCommandRunner(recorder);
  return { recorder, runner, manager: createSystemdServiceManager(runner) };
};

describe('systemd service manager', () => {
  it.each(['start', 'stop', 'restart'] as const)(
    'runs systemctl %s on the instance of the environment',
    async (action) => {
      const { recorder, manager } = setup();
      await manager[action]('staging');
      expect(recorder.calls).toEqual([
        `CommandRunner.run systemctl ${action} mes-courses@staging`,
      ]);
    },
  );

  it('reports a failing systemctl', async () => {
    const { runner, manager } = setup();
    runner.results.push({ exitCode: 5, stderr: 'Unit not found' });
    await expect(manager.stop('production')).rejects.toThrow(/Unit not found/);
  });

  it('is active when is-active exits 0', async () => {
    const { recorder, runner, manager } = setup();
    await expect(manager.isActive('production')).resolves.toBe(true);
    runner.results.push({ exitCode: 3 });
    await expect(manager.isActive('production')).resolves.toBe(false);
    expect(recorder.calls[0]).toBe(
      'CommandRunner.run systemctl is-active --quiet mes-courses@production',
    );
  });
});
