const CopyPlugin = require("copy-webpack-plugin");
//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },

  externals: {
    vscode: 'commonjs vscode'
  },

  resolve: {
    extensions: ['.ts', '.js']
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      },
    ]
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/tesseract.js-core/tesseract-core.wasm'),
          to: path.resolve(__dirname, 'out/tesseract.js-core/tesseract-core.wasm'),
          noErrorOnMissing: true // Avoid build failure if file is missing
        },
        {
          from: path.resolve(__dirname, 'node_modules/tesseract.js/dist/worker.min.js'),
          to: path.resolve(__dirname, 'out/tesseract.js/worker.min.js'),
          noErrorOnMissing: true
        }
      ]
    })
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log'
  }
};

module.exports = [extensionConfig];
