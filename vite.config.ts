import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import dts from 'vite-plugin-dts';
import { minify } from 'terser';

function minifyEsLibrary(): Plugin {
  return {
    name: 'minify-es-library',
    apply: 'build',
    enforce: 'post',
    async generateBundle(outputOptions, bundle) {
      if (outputOptions.format !== 'es') return;

      await Promise.all(
        Object.values(bundle).map(async (output) => {
          if (output.type !== 'chunk') return;

          const result = await minify(output.code, {
            module: true,
            compress: true,
            mangle: true,
            format: {
              comments: false,
            },
          });

          if (!result.code) {
            throw new Error('Terser did not return minified ESM code');
          }

          output.code = result.code;
        }),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      compilerOptions: {
        removeComments: false,
      },
    }),
    minifyEsLibrary(),
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false,
      },
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PrettyEventX',
      // the proper extensions will be added
      fileName: 'index',
    },
  },
})
