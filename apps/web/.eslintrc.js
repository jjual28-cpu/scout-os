/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@scout-os/config/eslint/next'],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
};
