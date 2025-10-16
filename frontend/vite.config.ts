import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { angular } from '@angular-devkit/build-angular/plugins/experimental/vite';

const customConfig: UserConfig = {
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '::1',
      'enak.cz',
      'www.enak.cz',
      "0.0.0.0"
    ],
  },
};

export default defineConfig(async () => {
  const angularConfig = await angular();
  return mergeConfig(angularConfig, customConfig);
});
