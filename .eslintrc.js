module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint/eslint-plugin", "unicorn"],
  extends: ["plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
  root: true,
  env: {
    node: true,
    jest: true
  },
  ignorePatterns: [".eslintrc.js"],
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "off",
    // Enforce naming conventions aligned with refactor
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "typeLike", format: ["PascalCase"] }, // classes, interfaces, types, enums
      { selector: "enumMember", format: ["UPPER_CASE"] }, // enum values
      { selector: "function", format: ["camelCase"] },
      { selector: "method", format: ["camelCase"], leadingUnderscore: "allow" },
      // Parameters: enforce camelCase only if no underscore to avoid legacy churn
      {
        selector: "parameter",
        format: ["camelCase"],
        leadingUnderscore: "allow",
        filter: { regex: "^[^_]*_[^_]*", match: false }
      },
      // Variables: allow PascalCase for schema builders & UPPER_CASE for consts; ignore ones with underscore
      {
        selector: "variable",
        format: ["camelCase", "PascalCase"],
        leadingUnderscore: "allow",
        filter: { regex: "^[^_]*_[^_]*", match: false }
      },
      {
        selector: "variable",
        modifiers: ["const"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        filter: { regex: "^[^_]*_[^_]*", match: false }
      }
    ],
    // Enforce kebab-case filenames (except extensions .ts)
    "unicorn/filename-case": [
      "error",
      {
        cases: { kebabCase: true },
        ignore: [
          "README",
          "CONTRIBUTING", // docs
          "nest-cli" // config
        ]
      }
    ]
  }
};
