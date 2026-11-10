import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { UNKNOWN_APP_INFO } from '../../../application/ports/app-info';
import { AppInfoProvider } from '../app-info-context';
import { VersionRow } from './VersionRow';

describe('VersionRow', () => {
  it('shows the version, the build number and the environment', () => {
    render(
      <PaperProvider>
        <AppInfoProvider
          value={{ version: '2.1.0', build: 412, environment: 'staging' }}
        >
          <VersionRow />
        </AppInfoProvider>
      </PaperProvider>,
    );

    expect(screen.getByText('Version 2.1.0 (build 412)')).toBeOnTheScreen();
    expect(screen.getByText('Environnement : staging')).toBeOnTheScreen();
  });

  it('shows 0.0.0 and no build when the build tells nothing', () => {
    render(
      <PaperProvider>
        <VersionRow />
      </PaperProvider>,
    );

    expect(screen.getByText('Version 0.0.0')).toBeOnTheScreen();
    expect(screen.queryByText(/build/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/Environnement/)).not.toBeOnTheScreen();
    expect(UNKNOWN_APP_INFO.build).toBeNull();
  });
});
