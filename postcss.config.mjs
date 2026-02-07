/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {}, // 注意：加上 @ 符号和 /postcss
    'autoprefixer': {},
  },
};

export default config;