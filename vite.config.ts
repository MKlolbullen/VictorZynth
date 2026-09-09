import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function aetherWaveRuntimeAlias(): Plugin {
  return {
    name: 'aetherwave-runtime-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      const normalizedImporter = importer?.replace(/\\/g, '/');
      if (source === './audio/engine' && normalizedImporter?.endsWith('/src/App.tsx')) {
        return path.resolve(__dirname, 'src/audio/runtime.ts');
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const pluginBuild = mode === 'plugin';

  return {
    plugins: [aetherWaveRuntimeAlias(), react(), tailwindcss()],
    base: pluginBuild ? './' : '/',
    publicDir: pluginBuild ? false : 'public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: pluginBuild
      ? {
          outDir: 'plugin/WebUI/dist',
          emptyOutDir: true,
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          sourcemap: false,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              entryFileNames: 'assets/app.js',
              chunkFileNames: 'assets/chunk-[name].js',
              assetFileNames: (assetInfo) =>
                assetInfo.name?.endsWith('.css') ? 'assets/style.css' : 'assets/[name][extname]',
            },
          },
        }
      : undefined,
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
