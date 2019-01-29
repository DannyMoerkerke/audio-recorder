export class AudioPlayer extends HTMLElement {

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();

    const shadowRoot = this.attachShadow({mode: 'open'});

    shadowRoot.innerHTML = `
            <style>
                
            </style>
            
            <div class="container">
              <div id="waveform-container">
                <canvas id="waveform"></canvas>
              </div>
              
              <div id="progress-container">
                <canvas id="progress"></canvas>
              </div>
              
              <div id="processing-progress"></div>
              <div id="processing-percentage"></div>
            </div>
            
            
        `;

    this.blobReady = false;
    this.audioReady = false;
    this.loading = false;
    this.processing = false;
    this.playing = false;
    this.ready = false;
    this.context = AudioContext;
    this.source = this.context.createBufferSource();
    this.downloadProgress = 0;
    this.downloadProgressComputable = false;
    this.processingProgress = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.secs = 0;
    this.pauseTime = 0;
    this.audioBuffers = [];

    this.timeDisplay = {
      hours: '00',
      seconds: '00',
      minutes: '00'
    };
    this.maxChunkLength = 1024000 * 50;
    this.canvas = this.shadowRoot.querySelector('#waveform');
    this.canvasContext = this.canvas.getContext('2d');
    this.progressCanvas = this.shadowRoot.querySelector('#progress');
    this.progressCanvasContext = this.progressCanvas.getContext('2d');
    this.waveformContainer = this.shadowRoot.querySelector('#waveform-container');
    this.progressContainer = this.shadowRoot.querySelector('#progress-container');

    this.processingProgressBar = this.shadowRoot.querySelector('#processing-progress');
    this.processingPercentage = this.shadowRoot.querySelector('#processing-percentage');
  }

  connectedCallback() {
    this.canvases = [
      {
        element: this.canvas,
        context: this.canvasContext,
        fillStyle: '#ffffff',
        strokeStyle: '#337AB7'
      },
      {
        element: this.progressCanvas,
        context: this.progressCanvasContext,
        fillStyle: '#ffffff',
        strokeStyle: '#ff0000'
      }
    ];

    this.canvasWidth = this.canvas.width;
    this.canvasHeight = this.canvas.height;
  }

  attributeChangedCallback(attr, oldVal, newVal) {

  }

  disconnectedCallback() {

  }

  stringToArrayBuffer(byteString) {
    return new Uint8Array(byteString.length).map((_, i) => byteString.codePointAt(i));
  }

  sliceAudio(buffer, start, end) {
    const chunk = start + end === buffer.byteLength ? buffer : buffer.slice(start, end);
    const blob = new Blob([new Uint8Array(this.header), new Uint8Array(chunk)]);
    const reader = new FileReader();

    reader.readAsArrayBuffer(blob);

    return new Promise((resolve, reject) => {
      reader.onloadend = e => {
        const buffer = e.target.result;

        this.context.decodeAudioData(buffer)
        .then(decodedBuffer => {
          ++this.processedBuffers;
          this.processingProgress = parseInt((this.processedBuffers / this.numBuffers) * 100, 10);

          this.processingProgressBar.value = this.processingProgress;
          this.processingPercentage.textContent = `${this.processingProgress}%`;

          if(this.processingProgress === 100) {
            this.processing = false;
            this.processedBuffers = 0;
          }
          return resolve(decodedBuffer);
        })
        .catch((err) => reject(err));
      };
    });
  }

  getWaveformData(buffers) {
    const dataArrays = buffers.map(buffer => buffer.getChannelData(0));
    const totalLength = dataArrays.reduce((total, data) => total + data.length, 0);

    let offset = 0;
    this.channelData = new Float32Array(totalLength);

    dataArrays.forEach(data => {
      this.channelData.set(data, offset);
      offset += data.length;
    });

    this.renderWaveform(this.channelData);

    // var totalLength = buffers.reduce(function(total, buffer) {
    //   var data = buffer.getChannelData(0);
    //   dataArrays.push(data);
    //
    //   return total + data.length;
    // }, 0);
    //
    // var offset = 0;
    // this.channelData = new Float32Array(totalLength);
    //
    // dataArrays.forEach(function(arr) {
    //   self.channelData.set(arr, offset);
    //   offset += arr.length;
    // });
    //
    // this.renderWaveform(this.channelData);
  }

  renderWaveform(channelData) {
    const drawLines = 2000;
    const totallength = channelData.length;
    const eachBlock = Math.floor(totallength / drawLines);
    const lineGap = (this.canvasWidth/drawLines);

    this.canvases.forEach(canvas => {
      canvas.context.save();
      canvas.context.fillStyle = canvas.fillStyle;
      canvas.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight );
      canvas.context.strokeStyle = canvas.strokeStyle;
      canvas.context.translate(0,this.canvasHeight / 2);
      canvas.context.lineWidth = 1;
      canvas.context.beginPath();

      for(let i=0; i <= drawLines; i++){
        const audioBuffKey = Math.floor(eachBlock * i);
        const x = i * lineGap;
        const y = channelData[audioBuffKey] * this.canvasHeight * 0.8;

        canvas.context.moveTo( x, y );
        canvas.context.lineTo( x, (y * -1) );
      }

      canvas.context.stroke();
      canvas.context.restore();
    });

    this.audioReady = true;
  }

  clearWaveform () {
    this.canvases.forEach(canvas => canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height));
  }

}

customElements.define('audio-player',  AudioPlayer);
