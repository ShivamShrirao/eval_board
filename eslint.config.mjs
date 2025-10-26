import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    ignores: ["node_modules/**", ".next/**", "dist/**"]
  }
];

export default config;
