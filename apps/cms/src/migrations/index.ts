import * as migration_20260825_081030_initial_editorial_cms from './20260825_081030_initial_editorial_cms';

export const migrations = [
  {
    up: migration_20260825_081030_initial_editorial_cms.up,
    down: migration_20260825_081030_initial_editorial_cms.down,
    name: '20260825_081030_initial_editorial_cms'
  },
];
