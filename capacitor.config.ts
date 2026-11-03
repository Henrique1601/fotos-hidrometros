import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fotoshidrometros.app',
  appName: 'Fotos Hidrômetros',
  webDir: 'dist',
  backgroundColor: '#071822',
  server: {
    androidScheme: 'https'
  }
};

export default config;
