import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: combinePresetAndAppleSplashScreens(
    minimal2023Preset,
    // iOS shows these while a Home Screen app starts (it ignores the manifest's background colour).
    // One device per distinct screen size, iPhone SE to iPhone 17. The generator also writes landscape
    // images; only the portrait ones are kept and linked from index.html.
    {
      padding: 0.6,
      resizeOptions: { background: '#f8fafc', fit: 'contain' },
    },
    [
      'iPhone 17 Pro Max',
      'iPhone 17 Pro',
      'iPhone Air',
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 14 Plus',
      'iPhone 13 mini',
      'iPhone 11 Pro Max',
      'iPhone 11',
      'iPhone 8 Plus',
      'iPhone SE 4.7"',
    ],
  ),
  images: ['public/logo.svg'],
});
