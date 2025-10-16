import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import { angular } from '@angular-devkit/build-angular/plugins/experimental/vite';

const customConfig: UserConfig = {
  server: {
    // Allow any host (handy for tunnelled / custom domains in debug setups)
    allowedHosts: true,
  },
};

export default defineConfig(async () => {
  const angularConfig = await angular();
  return mergeConfig(angularConfig, customConfig);
});
