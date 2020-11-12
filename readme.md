# audio-recorder
An audio recorder Web Component that records audio through the microphone of the user's device.

It provides a graphic frequency analyzer and waveform view of the recorded audio and uses the MediaDevices API, 
Web Audio API and the MediaRecorder API.

## Installation
```
npm i @dannymoerkerke/audio-recorder
```

## Usage
Add a `<script>` tag to your page:

```css
<script type="module" src="path/to/node_modules/@dannymoerkerke/src/audio-recorder.js"></script>
```

or import it:

```javascript
import './path/to/node_modules/@dannymoerkerke/src/audio-recorder.js';
```

You can also import the bundled version which is in `dist` for use with Webpack:

```javascript
import './path/to/node_modules/@dannymoerkerke/dist/audio-recorder.js';
```

and add the tag to your page:

```html
<audio-recorder></audio-recorder>
```

### Attributes
- `bars`: number of bars in frequency analyzer, default: 20
- `view`: `frequencies` or `waveform`, default: `frequencies`

### Styling
- `--width`: width of the recorder, default: 600px
- `--height`: height of the recorder, default: 300px
- `--border`: border of the recorder, default: none
- `--frequency-background-color`: background color of frequency analyzer, default: #ffffff
- `--frequency-bars-color`: background color of frequency bars, default: #ff0000
- `--waveform-background-color`: background color of waveform view, default: #ffffff
- `--waveform-color`: color of waveform, default: #ff0000
- `--waveform-progress-color`: color of waveform of part of file that has already played, default: #337ab7

In addition, mixins can be applied using the `::part` pseudo element.

Usage: 

```css
audio-recorder::part([selector]) {

   /** css rules **/

}

```

Available selectors:

- `::part(button)`: styles the buttons except the volume buttons
- `::part(volume-button)`: styles the volume buttons
- `::part(slider)`: styles the volume slider
- `::part(time)`: styles the elapsed and remaining time display

The buttons and slider are part of the `material-webcomponents` library ([https://dannymoerkerke.github.io/material-webcomponents/](https://dannymoerkerke.github.io/material-webcomponents/))

The Custom CSS properties exposed by these components can be used as part of the styling through `::part`.

For example, the `material-slider` component exposes the properties `--track-size`, `--track-color`, `--thumb-size` and 
`--thumb-color`.

These can be used in combination with `::part` to style the volume slider:

```css
audio-recorder::part(slider) {
  --track-color: #000000;
  --track-size: 3px;
  --thumb-color: #000000;
  --thumb-size: 10px;
}
```

### Demo
To run the demo, run `npm install` once and then `npm start` and view the demo on
[http://localhost:8080/](http://localhost:8080/)
