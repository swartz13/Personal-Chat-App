module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required for animations to run in a separate thread.
    // With Reanimated 4, this plugin comes from the worklets package.
    plugins: ['react-native-worklets/plugin'],
  };
};
