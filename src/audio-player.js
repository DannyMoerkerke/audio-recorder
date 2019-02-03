import '../node_modules/material-custom-elements/src/material-button.js';

export class AudioPlayer extends HTMLElement {

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();

    const shadowRoot = this.attachShadow({mode: 'open'});

    shadowRoot.innerHTML = `
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
      <style>
          :host {
            display: block;
            border: 1px solid #ff0000;
          }
          
          #container {
            position: relative;
            width: 400px;
            height: 400px;
          }
          
          #waveform-container {
            position: absolute;
            top: 0;
            left: 0;
          }
          
          #progress-container {
            position: absolute;
            top: 0;
            left: 0;
            overflow: hidden;
            width: 0;
            border-right: 1px solid #0000ff;
          }
      </style>
      
      <input type="file" id="file-input">
      <material-button id="play" raised>
        <i class="material-icons" slot="left-icon">play_arrow</i>
      </material-button>
      
      <div id="time"></div>
      <div id="container">
        <div id="waveform-container">
          <canvas id="waveform" width="400" height="400"></canvas>
        </div>
        
        <div id="progress-container">
          <canvas id="progress" width="400" height="400"></canvas>
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
    this.context = new AudioContext();
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
    this.container = this.shadowRoot.querySelector('#container');
    this.waveformContainer = this.shadowRoot.querySelector('#waveform-container');
    this.progressContainer = this.shadowRoot.querySelector('#progress-container');

    this.processingProgressBar = this.shadowRoot.querySelector('#processing-progress');
    this.processingPercentage = this.shadowRoot.querySelector('#processing-percentage');
    this.fileInput = this.shadowRoot.querySelector('#file-input');
    this.playButton = this.shadowRoot.querySelector('#play');
    this.playButtonIcon = this.playButton.querySelector('i');
    this.time = this.shadowRoot.querySelector('#time');
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

    this.container.addEventListener('click', this.handleWaveformClick.bind(this));
    this.fileInput.addEventListener('change', this.loadFile.bind(this));
    this.playButton.addEventListener('click', this.playPause.bind(this));
  }

  handleWaveformClick(e) {
    if(this.curSource) {
      this.playing = false;
      this.playButtonIcon.innerText = 'play_arrow';
      this.curSource.stop();
      cancelAnimationFrame(this.timerId);
    }

    this.progressContainer.style.width = `${e.offsetX}px`;
    this.pauseTime = (e.offsetX / this.canvasWidth) * this.duration;
    this.showElapsedTime(this.pauseTime);
  }

  attributeChangedCallback(attr, oldVal, newVal) {

  }

  disconnectedCallback() {

  }

  stringToArrayBuffer(byteString) {
    return new Uint8Array(byteString.length).map((_, i) => byteString.codePointAt(i));
  }

  getArrayBuffer(blob) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob);

    return new Promise((resolve, reject) => {
      reader.onloadend = e => resolve(e.target.result);
      reader.onerror = err => reject(err);
    });
  }

  async loadFile(e) {
    const file = e.target.files[0];
    const buffer = await this.getArrayBuffer(file);
    const audioBuffers = await this.getAudioBuffers(buffer);
    this.audioBuffers = audioBuffers;
    this.duration = audioBuffers.reduce((total, buffer) => total + buffer.duration, 0);

    const waveformData = this.getWaveformData(audioBuffers);
    this.renderWaveform(waveformData);
    this.showElapsedTime(0);
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

  async getAudioBuffers(buffer) {
    const bufferLength = buffer.byteLength;
    const chunkLength = bufferLength > this.maxChunkLength ? this.maxChunkLength : bufferLength;

    let start = 0;
    let end = start + chunkLength;
    const self = this;

    const slice = (buffer, start, end) => {
      async function* gen() {
        while(start < bufferLength) {
          const decodedBuffer = await self.sliceAudio(buffer, start, end);
          yield decodedBuffer;

          start += chunkLength;
          end = start + chunkLength > bufferLength ? bufferLength : start + chunkLength;
        }
      }

      return gen();
    };

    const audioBuffers = [];

    for await (const decodedBuffer of slice(buffer, start, end)) {
      audioBuffers.push(decodedBuffer);
    }

    return audioBuffers;
  }

  getAudioNodes(audioBuffers) {
    return audioBuffers.map(buffer => {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);

      return source;
    });
  }

  getNodesAfterOffset(nodes, offset) {
    let duration = 0;
    let skipped = 0;

    const remaining = nodes.filter(node => {
      duration += node.buffer.duration;
      skipped += duration < offset ? node.buffer.duration : 0;

      return duration > offset;
    });

    return [remaining, offset - skipped];
  }

  playAudio(audioBuffers) {
    const audioNodes = this.getAudioNodes(audioBuffers);

    this.startTime = this.context.currentTime;

    const playSources = (sources, offset = 0) => {
      if(sources.length) {
        const src = sources.shift();

        src.onended = (e) => {
          console.log('ended', e);
          this.playing ? playSources(sources) : null;
        };

        this.curSource = src;
        src.start(0, offset);
      }
      else {
        this.stopAudio();
      }
    };

    const [nodes, offset = this.pauseTime] = this.pauseTime > 0 ? this.getNodesAfterOffset(audioNodes, this.pauseTime) : [audioNodes];

    playSources(nodes, offset);
  }

  playPause() {
    const progress = () => {
      const diff = (this.context.currentTime - this.startTime) + this.pauseTime;
      this.showElapsedTime(diff);
      const progressWidth = ((diff / this.duration) * this.canvasWidth);
      this.progressContainer.style.width = progressWidth + 'px';

      this.timerId = requestAnimationFrame(progress);
    };

    if(this.playing) {
      this.playing = false;
      this.playButtonIcon.innerText = 'play_arrow';
      this.curSource.stop();
      cancelAnimationFrame(this.timerId);
      this.pauseTime = (this.context.currentTime - this.startTime) + this.pauseTime;
    }
    else {
      this.playing = true;
      this.playButtonIcon.innerText = 'pause';
      this.playAudio(this.audioBuffers);
      requestAnimationFrame(progress);
    }
  }

  stopAudio() {
    this.playing = false;
    this.playButtonIcon.innerText = 'play_arrow';
    this.curSource.stop();
    cancelAnimationFrame(this.timerId);

    this.pauseTime = 0;
    this.timeDisplay = {
      hours: '00',
      seconds: '00',
      minutes: '00'
    };

    this.progressContainer.style.width = 0;
    this.showElapsedTime(0);
  }

  showElapsedTime(secs) {
    const minute = 60;
    const hour = 3600;

    this.hours = Math.floor(secs / hour);
    this.minutes = Math.floor((secs % hour) / minute);
    this.seconds = Math.floor(secs) % minute;

    // store seconds in this.seconds to only update the display once per second
    if(secs !== this.secs) {
      this.secs = secs;
      this.timeDisplay.hours = this.hours < 10 ? `0${this.hours}` : this.hours;
      this.timeDisplay.seconds = this.seconds < 10 ? `0${this.seconds}` : this.seconds;
      this.timeDisplay.minutes = this.minutes < 10 ? `0${this.minutes}` : this.minutes;
    }
    const {hours, minutes, seconds} = this.timeDisplay;
    this.time.innerHTML = `${hours}:${minutes}:${seconds}`;
  }

  getWaveformData(buffers) {
    const dataArrays = buffers.map(buffer => buffer.getChannelData(0));
    const totalLength = dataArrays.reduce((total, data) => total + data.length, 0);

    let offset = 0;
    const channelData = new Float32Array(totalLength);

    dataArrays.forEach(data => {
      channelData.set(data, offset);
      offset += data.length;
    });

    return channelData;
  }

  renderWaveform(channelData) {
    const drawLines = 2000;
    const totallength = channelData.length;
    const eachBlock = Math.floor(totallength / drawLines);
    const lineGap = (this.canvasWidth / drawLines);

    this.canvases.forEach(canvas => {
      canvas.context.save();
      canvas.context.fillStyle = canvas.fillStyle;
      canvas.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      canvas.context.strokeStyle = canvas.strokeStyle;
      canvas.context.translate(0, this.canvasHeight / 2);
      canvas.context.lineWidth = 1;
      canvas.context.beginPath();

      for(let i = 0; i <= drawLines; i++) {
        const audioBuffKey = Math.floor(eachBlock * i);
        const x = i * lineGap;
        const y = channelData[audioBuffKey] * this.canvasHeight * 0.8;

        canvas.context.moveTo(x, y);
        canvas.context.lineTo(x, (y * -1));
      }

      canvas.context.stroke();
      canvas.context.restore();

      canvas.context.strokeStyle = canvas.strokeStyle;
      canvas.context.moveTo(0, this.canvasHeight / 2);
      canvas.context.lineTo(this.canvasWidth, this.canvasHeight / 2);
      canvas.context.stroke();
      canvas.context.restore();
    });

    this.audioReady = true;
  }

  clearWaveform() {
    this.canvases.forEach(canvas => canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height));
  }

}

customElements.define('audio-player', AudioPlayer);
