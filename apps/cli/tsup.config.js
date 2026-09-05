import { defineConfig } from 'tsup';
export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    clean: true,
    dts: false,
    noExternal: [
        '@preflight/ai-engine',
        '@preflight/classifier',
        '@preflight/config',
        '@preflight/core',
        '@preflight/deploy-engine',
        '@preflight/discovery',
        '@preflight/qa-engine',
        '@preflight/reporter',
        '@preflight/security'
    ]
});
//# sourceMappingURL=tsup.config.js.map