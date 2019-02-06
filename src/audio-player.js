import '../node_modules/material-custom-elements/src/material-button.js';
import '../node_modules/material-custom-elements/src/material-slider.js';

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
          
          material-slider {
            --track-height: 1px;
            --thumb-size: 12px;
            
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
          #frequencies-container {
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0;
          }
          
          #equalizer-container {
            width: 200px;
            transform: rotate(-90deg);
          }
      </style>
      
      <input type="file" id="file-input">
      <material-button id="play" raised>
        <i class="material-icons" slot="left-icon">play_arrow</i>
      </material-button>
      
      <material-slider id="volume" value="100" max="100"></material-slider>
      
      <span id="elapsed-time"></span> / <span id="total-time"></span>
      
      <div id="container">
        <div id="waveform-container">
          <canvas id="waveform" width="400" height="400"></canvas>
        </div>
        
        <div id="progress-container">
          <canvas id="progress" width="400" height="400"></canvas>
        </div>
        
        <div id="frequencies-container">
          <canvas id="frequencies" width="400" height="400"></canvas>
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
    this.gainNode = this.context.createGain();
    this.output = this.context.destination;
    this.analyser = this.context.createAnalyser();
    this.downloadProgress = 0;
    this.downloadProgressComputable = false;
    this.processingProgress = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.secs = 0;
    this.pauseTime = 0;
    this.audioBuffers = [];

    this.maxChunkLength = 524000; //1024000 * 50;
    this.canvas = this.shadowRoot.querySelector('#waveform');
    this.canvasContext = this.canvas.getContext('2d');
    this.progressCanvas = this.shadowRoot.querySelector('#progress');
    this.progressCanvasContext = this.progressCanvas.getContext('2d');
    this.container = this.shadowRoot.querySelector('#container');
    this.frequencyCanvas = this.shadowRoot.querySelector('#frequencies');
    this.frequencyCanvasContext = this.frequencyCanvas.getContext('2d');
    this.waveformContainer = this.shadowRoot.querySelector('#waveform-container');
    this.progressContainer = this.shadowRoot.querySelector('#progress-container');
    this.frequenciesContainer = this.shadowRoot.querySelector('#frequencies-container');

    this.processingProgressBar = this.shadowRoot.querySelector('#processing-progress');
    this.processingPercentage = this.shadowRoot.querySelector('#processing-percentage');
    this.fileInput = this.shadowRoot.querySelector('#file-input');
    this.playButton = this.shadowRoot.querySelector('#play');
    this.playButtonIcon = this.playButton.querySelector('i');
    this.elapsedTime = this.shadowRoot.querySelector('#elapsed-time');
    this.totalTime = this.shadowRoot.querySelector('#total-time');
    this.volume = this.shadowRoot.querySelector('#volume');
    this.audio = this.shadowRoot.querySelector('audio');

    const filters = [
      {
        type: 'lowshelf',
        frequency: 64.0,
      },
      {
        type: 'peaking',
        frequency: 125.0,
        q: 0.5
      },
      {
        type: 'peaking',
        frequency: 500.0,
        q: 0.5
      },
      {
        type: 'peaking',
        frequency: 1000.0,
        q: 0.5
      },
      {
        type: 'peaking',
        frequency: 2000.0,
        q: 0.5
      },
      {
        type: 'peaking',
        frequency: 4000.0,
        q: 0.5
      },
      {
        type: 'peaking',
        frequency: 8000.0,
        q: 0.5
      },
      {
        type: 'highshelf',
        frequency: 16000.0
      }
    ];

    this.filters = filters.map(({type, frequency, q}) => {
      const filter = this.context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;

      if(q) {
        filter.Q.value = q;
      }

      filter.gain.value = 0.0;

      return filter;
    });

    this.equalizer = this.filters.reduce((destination, filter) => {
      destination.connect(filter);
      return filter;
    }, this.gainNode);

    this.createEqualizerHTML(this.filters);
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

    this.showTotalTime(0);
    this.showElapsedTime(0);

    this.container.addEventListener('click', this.handleWaveformClick.bind(this));
    this.fileInput.addEventListener('change', this.loadFile.bind(this));
    this.playButton.addEventListener('click', this.playPause.bind(this));
    this.volume.addEventListener('change', e => this.setVolume(e.detail.value / 100));
  }

  createEqualizerHTML(filters) {
    const fragment = document.createDocumentFragment();
    const div = document.createElement('div');
    div.id = 'equalizer-container';
    const eqContainer = fragment.appendChild(div);

    filters.forEach((filter, i) => {
      const html = `<material-slider min="-10" max="10" value="0" data-filter="${i}"></material-slider>`;
      eqContainer.insertAdjacentHTML('beforeend', html);
      const slider = eqContainer.lastChild;

      slider.addEventListener('change', (e) => {
        console.log(slider.dataset.filter);
        const gain = e.detail.value;
        const index = slider.dataset.filter;
        filters[index].gain.setValueAtTime(gain, this.context.currentTime);
      });

    });

    this.container.before(fragment);
  }

  setVolume(value) {
    this.gainNode.gain.setValueAtTime(value, this.context.currentTime);
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
    this.header = buffer.slice(0, 44);
    const audioBuffers = await this.getAudioBuffers(buffer);
    this.audioBuffers = audioBuffers;
    this.duration = audioBuffers.reduce((total, buffer) => total + buffer.duration, 0);
    console.log('audioBuffers', audioBuffers.length);
    const waveformData = this.getWaveformData(audioBuffers);
    this.renderWaveform(waveformData);
    this.showTotalTime(this.duration);
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
      // source.connect(this.context.destination);

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
        this.curSource.connect(this.gainNode);
        this.equalizer.connect(this.output);
        this.curSource.start(0, offset);
      }
      else {
        this.stopAudio();
      }
    };

    const [nodes, offset = this.pauseTime] = this.pauseTime > 0 ? this.getNodesAfterOffset(audioNodes, this.pauseTime) : [audioNodes];

    playSources(nodes, offset);
    // this.freq();
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
    this.progressContainer.style.width = 0;
    this.showElapsedTime(0);
  }

  formatTime(secs) {
    const minute = 60;
    const hour = 3600;

    const hrs = Math.floor(secs / hour);
    const min = Math.floor((secs % hour) / minute);
    const sec = Math.floor(secs) % minute;

    const hours = hrs < 10 ? `0${hrs}` : hrs;
    const minutes = min < 10 ? `0${min}` : min;
    const seconds = sec < 10 ? `0${sec}` : sec;
    return hours !== '00' ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
  }

  showElapsedTime(secs) {
    this.elapsedTime.innerHTML = this.formatTime(secs);
  }

  showTotalTime(secs) {
    this.totalTime.innerHTML = this.formatTime(secs);
  }

  freq() {
    this.analyser.fftSize = 256;
    const bufferLength = this.analyser.frequencyBinCount;

    const dataArray = new Float32Array(bufferLength);
    console.log(dataArray);
    this.frequencyCanvasContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    const draw = () => {
      // requestAnimationFrame(draw);
      console.log(dataArray);
      this.analyser.getFloatFrequencyData(dataArray);
      console.log(dataArray);
      this.frequencyCanvasContext.fillStyle = 'rgb(255, 255, 255)';
      this.frequencyCanvasContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

      const barWidth = (this.canvasWidth / bufferLength) * 2.5;
      let x = 0;

      // dataArray.map((_, i) => {
      //   const barHeight = (dataArray[i] + 140) * 2;
      //
      //   this.frequencyCanvasContext.fillStyle = `rgb(${Math.floor(barHeight + 100)},50,50)`;
      //   this.frequencyCanvasContext.fillRect(x, this.canvasHeight - barHeight / 2, barWidth, barHeight / 2);
      //
      //   x += barWidth + 1;
      // });

      // console.log(bufferLength);

      for(var i = 0; i < 10; i++) {
        let barHeight = (dataArray[i] + 140)*2;

        this.frequencyCanvasContext.fillStyle = '#ff0000'; //'rgb(' + Math.floor(barHeight+100) + ',50,50)';
        this.frequencyCanvasContext.fillRect(x,this.canvasHeight-barHeight/2,barWidth,barHeight/2);

        // console.log(x, this.canvasHeight - barHeight / 2, barWidth, barHeight / 2);
        // console.log(dataArray[i], barHeight);

        x += barWidth + 1;
      }
    };

    draw();
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
