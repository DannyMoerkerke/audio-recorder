const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    bundle: './src/index.js'
  },
  output: {
    path: __dirname,  // path.join(__dirname, 'dist'),
    filename: '[name].[fullhash].js'
  },
  module: {
    rules: []
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      chunks: ['bundle']
    })
  ]
};
