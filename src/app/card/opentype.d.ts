// The package's ES module, imported by path: its main file is CommonJS, which Node can't take named
// imports from when it loads vite.config.ts.
declare module 'opentype.js/dist/opentype.mjs' {
  export * from 'opentype.js';
}
