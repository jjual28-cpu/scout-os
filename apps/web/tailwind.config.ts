import scoutPreset from '@scout-os/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [scoutPreset],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
};

export default config;
