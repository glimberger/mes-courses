import { Recorder } from '../../application/testing/recorder';
import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { buildRuntime } from './runtime';

const REV = 'e'.repeat(40);

describe('buildRuntime', () => {
  it('builds nodejs_24 of the locked nixpkgs into the release', async () => {
    const recorder = new Recorder();
    await buildRuntime(new ScriptedCommandRunner(recorder), REV, '/r/runtime');
    expect(recorder.calls).toEqual([
      `CommandRunner.run nix build github:NixOS/nixpkgs/${REV}#nodejs_24 --out-link /r/runtime`,
    ]);
  });

  it('surfaces an exit code', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ exitCode: 1, stderr: 'no network' });
    await expect(buildRuntime(runner, REV, '/r/runtime')).rejects.toThrow(
      /no network/,
    );
  });

  it('reports a time limit', async () => {
    const runner = new ScriptedCommandRunner();
    runner.results.push({ exitCode: 1, timedOut: true });
    await expect(buildRuntime(runner, REV, '/r/runtime')).rejects.toThrow(
      /time limit/,
    );
  });
});
