import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'open-coder';
export const CONFIG_FILE_NAME = 'config.json';

function appDirs(appName: string): { config: string; data: string } {
  const home = os.homedir();

  switch (process.platform) {
    case 'win32': {
      const localAppData =
        process.env.LOCALAPPDATA?.trim() || path.join(home, 'AppData', 'Local');
      const dir = path.join(path.normalize(localAppData), appName);
      return { config: dir, data: dir };
    }
    case 'darwin': {
      const dir = path.join(home, 'Library', 'Application Support', appName);
      return { config: dir, data: dir };
    }
    default: {
      const xdgConfig = process.env.XDG_CONFIG_HOME?.trim() || path.join(home, '.config');
      const xdgData =
        process.env.XDG_DATA_HOME?.trim() || path.join(home, '.local', 'share');
      return {
        config: path.join(xdgConfig, appName),
        data: path.join(xdgData, appName),
      };
    }
  }
}

export function userConfigDir(appName: string): string {
  return appDirs(appName).config;
}

export function userDataDir(appName: string): string {
  return appDirs(appName).data;
}

/**
 * The one config file that follows the user across projects. Secrets belong here
 * and nowhere else — a project's `.open-coder/config.json` is inside a repo and
 * will eventually get committed.
 */
export function userConfigFile(): string {
  return path.join(userConfigDir(APP_NAME), CONFIG_FILE_NAME);
}
