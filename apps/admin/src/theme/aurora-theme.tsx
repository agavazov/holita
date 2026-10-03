import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { CssBaseline, ThemeProvider, useColorScheme, useMediaQuery } from '@mui/material';
import { useLocation } from 'react-router';
import 'simplebar-react/dist/simplebar.min.css';
import './fonts.css';
import { createTheme } from './theme.js';
import { darkPalettes } from './palettes/index.js';
import { COLOR_GROUPS } from './primaryColorOverride.js';
import { AppearanceContext, appearanceStorageKey, readAppearance } from './preferences.js';
import type { ThemeMode } from './config.js';
import { localeFromPathname } from '../localization/locale.js';

function ThemeModeSync({ mode }: { mode: ThemeMode }) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
  return null;
}

export function AuroraTheme({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const locale = localeFromPathname(pathname) ?? 'bg';
  const [appearance, setAppearance] = useState(readAppearance);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = appearance.mode === 'system' ? systemDark : appearance.mode === 'dark';
  const theme = useMemo(
    () => createTheme(appearance.preset, appearance.primaryColor, locale),
    [appearance.preset, appearance.primaryColor, locale],
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-holita-preset', appearance.preset);
    try {
      localStorage.setItem(appearanceStorageKey, JSON.stringify(appearance));
    } catch {
      /* Preferences remain usable when browser storage is unavailable. */
    }
  }, [appearance]);
  return (
    <AppearanceContext
      value={{
        appearance,
        isDark,
        setPreset: (preset) => {
          setAppearance({
            preset,
            mode: preset in darkPalettes ? 'dark' : 'light',
            primaryColor: COLOR_GROUPS.find((group) => group.key === preset)?.main ?? null,
          });
        },
        setMode: (mode) => {
          setAppearance((current) => ({
            ...current,
            mode,
            preset: mode === 'dark' ? 'default-dark' : 'default-light',
            primaryColor: null,
          }));
        },
        setPrimaryColor: (primaryColor) => {
          setAppearance((current) => ({ ...current, primaryColor }));
        },
      }}
    >
      <ThemeProvider
        theme={theme}
        defaultMode={appearance.mode}
        modeStorageKey="holita-mode"
        colorSchemeStorageKey="holita-color-scheme"
        disableTransitionOnChange
        noSsr
      >
        <ThemeModeSync mode={appearance.mode} />
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppearanceContext>
  );
}
