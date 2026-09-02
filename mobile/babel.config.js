module.exports = function configureBabel(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: false, worklets: false }]],
    plugins: ['@react-native/babel-plugin-codegen'],
  };
};
