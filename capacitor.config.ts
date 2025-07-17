import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d49481e4d3544fd8a0b22169f41f8606',
  appName: 'today-somethingco',
  webDir: 'dist',
  server: {
    url: 'https://d49481e4-d354-4fd8-a0b2-2169f41f8606.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'light',
      backgroundColor: '#000000'
    }
  }
};

export default config;