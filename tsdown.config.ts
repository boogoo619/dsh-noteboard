/** dsh-noteboard dual-half build: Node (esm) host service + official client bundle. */

export default [
  {
    entry: ['src/index.mjs'],
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    outDir: 'lib',
    clean: true,
  },
  {
    name: 'dsh-noteboard/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: { alwaysBundle: ['lucide-react', 'markdown-it', '@floating-ui/dom', '@floating-ui/core', '@floating-ui/utils', 'argparse', 'entities', 'linkify-it', 'mdurl', 'punycode.js', 'uc.micro'] },
    external: [/@deepseek-ai\/dsh-client-/, /^react($|\/)/, /^react-dom($|\/)/],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-noteboard", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
