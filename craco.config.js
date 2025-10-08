const path = require("path");
const webpack = require("webpack");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Remove source-map-loader to avoid warnings
      webpackConfig.module.rules = webpackConfig.module.rules.filter(
        (rule) => !rule.loader?.includes("source-map-loader")
      );
      // Add polyfills for Node.js modules
      webpackConfig.resolve.fallback = {
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        zlib: require.resolve("browserify-zlib"),
        url: require.resolve("url/"),
        buffer: require.resolve("buffer/"), // Added for Solana/Anchor
      };
      // Provide Buffer globally
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        })
      );
      // Add SVG support
      webpackConfig.module.rules.push({
        test: /\.svg$/,
        use: ["@svgr/webpack"],
      });
      // Remove problematic aliases
      webpackConfig.resolve.modules = ["node_modules"]; // Ensure node_modules resolution
      return webpackConfig;
    },
  },
};
