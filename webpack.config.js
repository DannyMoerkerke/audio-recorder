const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    bundle: './build/index.js'
  },
  output: {
    path: __dirname,  // path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: []
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './build/index.html',
      filename: 'index.html',
      chunks: ['bundle']
    })
  ]
};
