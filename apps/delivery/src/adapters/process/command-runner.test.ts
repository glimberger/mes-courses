import { createCommandRunner } from './command-runner';

describe('command runner', () => {
  const runner = createCommandRunner();

  it('captures the output and the exit code', async () => {
    const result = await runner.run('node', [
      '-e',
      'console.log("out");console.error("err");process.exit(3)',
    ]);
    expect(result).toEqual({
      exitCode: 3,
      stdout: 'out\n',
      stderr: 'err\n',
      timedOut: false,
    });
  });

  it('passes arguments as they are, with no shell interpretation', async () => {
    const result = await runner.run('node', [
      '-e',
      'console.log(process.argv[1])',
      '$(echo hacked); ls',
    ]);
    expect(result.stdout).toBe('$(echo hacked); ls\n');
  });

  it('kills a command that exceeds its limit and says so', async () => {
    const result = await runner.run(
      'node',
      ['-e', 'setTimeout(()=>{},60000)'],
      {
        timeoutMs: 200,
      },
    );
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it('reports a program that does not exist', async () => {
    const result = await runner.run('definitely-not-a-program', []);
    expect(result.exitCode).not.toBe(0);
  });
});
