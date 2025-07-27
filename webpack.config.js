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
    extensions: ['.ts', '.js', '.wasm']
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/tesseract.js-core'),
          to: path.resolve(__dirname, 'out/tesseract.js-core')
        },
        {
          from: path.resolve(__dirname, 'node_modules/tesseract.js/dist'),
          to: path.resolve(__dirname, 'out/tesseract.js')
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
