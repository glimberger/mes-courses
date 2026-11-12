import { exitCodeOf, parseAgentUpdateArgs, UsageError } from './agent-update';

describe('parseAgentUpdateArgs', () => {
  it('defaults to the latest release on agent-pi', () => {
    expect(parseAgentUpdateArgs([])).toEqual({
      version: undefined,
      dryRun: false,
      host: 'agent-pi',
    });
  });

  it('reads --version (with or without v), --dry-run and --host', () => {
    expect(
      parseAgentUpdateArgs([
        '--dry-run',
        '--version',
        'v2.3.0',
        '--host',
        'pi',
      ]),
    ).toEqual({ version: '2.3.0', dryRun: true, host: 'pi' });
    expect(parseAgentUpdateArgs(['--version', '2.3.0']).version).toBe('2.3.0');
  });

  it('takes the host from AGENT_UPDATE_HOST', () => {
    expect(parseAgentUpdateArgs([], { AGENT_UPDATE_HOST: 'pi2' }).host).toBe(
      'pi2',
    );
  });

  it.each([
    [['--version']],
    [['--version', 'latest']],
    [['--version', '2.3']],
    [['--host', '-oProxyCommand=x']],
    [['--bogus']],
    [['2.3.0']],
  ])('rejects %j', (argv) => {
    expect(() => parseAgentUpdateArgs(argv)).toThrow(UsageError);
  });

  it('exits 1 only for a stop', () => {
    const release = {
      tag: 'v1.0.0',
      agentVersion: '1.0.0',
      assetId: 1,
      assetName: 'a',
    };
    expect(exitCodeOf({ outcome: 'unchanged', release })).toBe(0);
    expect(exitCodeOf({ outcome: 'planned', release })).toBe(0);
    expect(exitCodeOf({ outcome: 'installed', release, previous: null })).toBe(
      0,
    );
    expect(
      exitCodeOf({ outcome: 'stopped', message: 'x', repointed: false }),
    ).toBe(1);
  });
});
