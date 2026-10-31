import { defineConfig } from 'vite';
import { resolve } from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import glsl from 'vite-plugin-glsl';
import path from 'path';
// @ts-ignore
import postcss from '@vituum/vite-plugin-postcss';

export default defineConfig({
    plugins: [
        postcss(),
        createSvgIconsPlugin({
            iconDirs: [`${resolve(__dirname, 'src/reall3d/assets/icons')}`],
            symbolId: 'svgicon-[name]',
        }),
        glsl({ include: ['**/*.glsl'] }),
    ],
    server: {
        port: 3100,
        open: true,
        fs: {
            strict: false,
        },
    },
    preview: {
        port: 4100,
    },
    base: './',
    publicDir: 'public',

    esbuild: {
        pure: ['console.log', 'console.debug'],
    },

    resolve: {
        alias: {
            '@reall3d/reall3dviewer': path.resolve(__dirname, './pkg'),
        },
    },
    build: {
        chunkSizeWarningLimit: 2048,
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    rapier: ['@dimforge/rapier3d-compat'],
                    threetile: ['@gotoeasy/three-tile'],
                },
                chunkFileNames: 'assets/chunk-[hash].js',
                entryFileNames: 'assets/entry-[hash].js',
                assetFileNames: 'assets/asset-[hash].[ext]',
            },
        },
    },
});
