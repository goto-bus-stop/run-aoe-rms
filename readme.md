# run-aoe-rms

Run an Age of Empires 2 random map script, and get a recorded game file back.

## Install

You need:

 - Wine
   - DirectPlay (use winetricks)
   - Age of Empires 2 (remove the Sounds/ folder to make it faster)
 - `apt-get install xvfb xdotool imagemagick`

Then with npm do:

```bash
# Not published to npm atm! So install from github.
npm install --save goto-bus-stop/run-aoe-rms
```

## Usage

```js
const runRandomMapScript = require('run-aoe-rms')
const rmsSource = fs.readFileSync('/path/to/script.rms', 'utf8')

runRandomMapScript(rmsSource, {
  aocDir: '/path/to/wine/age2/folder'
}).then((recGame) => {
  // recGame is a Buffer containing the recorded game file.
  // It should take about 10 seconds to get here.
})
```
