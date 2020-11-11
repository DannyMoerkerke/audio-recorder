const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'audio-recorder': './src/audio-recorder.js'
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: []
  }
};
