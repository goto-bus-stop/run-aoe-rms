const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { readFileSync } = require('fs')
const pify = require('pify')
const headlessCb = require('headless')
const delay = require('delay')
const mv = pify(require('mv'))
const fs = require('mz/fs')
const del = require('del')
const debug = require('debug')('run-aoe-rms')

const AOC_PATH = 'Age2_x1/age2_x1.exe'
const RMS_PATH = 'Random'
const RMS_BACKUP = '.run-aoe-rms-backup.Random'
const RECORDING_PATH = 'SaveGame/rec.mgz'

const headless = pify((...args) => {
  const cb = args.pop()
  headlessCb(...args, (err, xvfb, display) => {
    if (err) cb(err)
    else cb(null, { xvfb, display })
  })
})

module.exports = runRandomMapScript

/**
 * Run a random map script string, creating a short recorded game.
 *
 * @param {string} source Random map script.
 * @param {Object} options Options.
 *    - `options.aocDir` - Installation directory of Age of Empires 2
 *      (with UserPatch v1.4)
 * @return {Buffer} The recorded game file contents.
 */
async function runRandomMapScript (source, options = {}) {
  const { aocDir } = options

  // Create a virtual frame buffer that AoC can use to render to.
  const { xvfb, display } = await headless({
    display: {
      width: 800,
      height: 600,
      depth: 24
    }
  })

  // Set up an environment that will use the frame buffer as its main screen.
  const env = Object.assign({}, process.env, {
    DISPLAY: `:${display}.0`
  })

  // Start a new game in AoC to run its map generation code.

  await prepareRMSFolder()
  debug('prepared folder')

  const aoc = await spawnAoc()
  debug('assuming aoc is ready')

  await openSinglePlayerMenu()
  debug('opened single player menu')

  await openGameSetupScreen()
  debug('opened game setup screen')

  await selectRMSFile()
  debug('selected rms file')

  await startGame()
  debug('started game')

  debug('force-closing game')
  await forceExit(aoc)
  debug('closing xvfb')
  await forceExit(xvfb)

  await restoreRMSFolder()
  debug('restored folder')

  // Read the recorded game file.
  const recordedGamePath = path.join(aocDir, RECORDING_PATH)
  const rec = await fs.readFile(recordedGamePath)
  await del(recordedGamePath, { force: true })

  // Add the header length to the recorded game file.
  // AoC doesn't add this because we force-quit it.
  const headerLen = rec.indexOf(Buffer.from([ 0xF4, 0x01, 0x00, 0x00 ]))
  rec.writeInt32LE(headerLen, 0)

  return rec

  // Util to get the color of a pixel in the frame buffer.
  function getColor (x, y) {
    const tmpFile = '/tmp/color.txt'

    // Grab one pixel and save it as a `.txt`.
    spawnSync('import', [
      '-display', `:${display}`,
      '-window', 'root',
      '-crop', `1x1+${x}+${y}`,
      tmpFile
    ])

    // Extract the hex color value of the pixel.
    const match = readFileSync(tmpFile, 'utf8')
      .match(/#([0-9A-F]{2})..([0-9A-F]{2})..([0-9A-F]{2})../)
    if (!match) {
      return '#000000'
    }
    return `#${match.slice(1).join('')}`.toLowerCase()
  }

  // Util to click at a location in the frame buffer.
  function click (x, y, rightClick = false) {
    debug('click', x, y)
    spawnSync('xdotool', [
      'mousemove', x, y,
      'click', rightClick ? 2 : 1
    ], { env })
  }

  function forceExit (cp) {
    return new Promise((resolve) => {
      const wait = setTimeout(() => {
        cp.kill('SIGKILL')
      }, 2000)

      cp.on('exit', () => {
        clearTimeout(wait)
        resolve()
      })
      cp.kill('SIGTERM')
    })
  }

  async function prepareRMSFolder () {
    await del(path.join(aocDir, RMS_BACKUP), { force: true })
    await mv(path.join(aocDir, RMS_PATH), path.join(aocDir, RMS_BACKUP))

    await fs.mkdir(path.join(aocDir, RMS_PATH))
    await fs.writeFile(path.join(aocDir, RMS_PATH, 'Current.rms'), source)
  }

  async function restoreRMSFolder () {
    await del(path.join(aocDir, RMS_PATH), { force: true })
    await mv(path.join(aocDir, RMS_BACKUP), path.join(aocDir, RMS_PATH))
  }

  async function spawnAoc () {
    debug('spawn wine aoc')
    const cp = spawn('wine', [
      path.join(aocDir, AOC_PATH),
      'NODXCHECK',
      'FORCE800'
    ], { env, cwd: aocDir })

    cp.stdout.on('data', (line) => {
      debug('aoc stdout', line.toString('utf8'))
    })
    cp.stderr.on('data', (line) => {
      debug('aoc stderr', line.toString('utf8'))
    })

    while (!isReady()) {
      await delay(50)
    }

    return cp

    function isReady () {
      // Check if the "Learn to Play" text is present.
      return getColor(18, 23) === '#d7d1b0'
    }
  }

  async function openGameSetupScreen () {
    click(600, 170)
    while (!isOpen()) {
      await delay(50)
    }

    function isOpen () {
      // The "Start Game" button text
      return getColor(105, 563) === '#d7ca15'
    }
  }

  async function openSinglePlayerMenu () {
    click(370, 100)
    while (!isOpen()) {
      await delay(50)
    }

    function isOpen () {
      return getColor(561, 171) === '#d7d1b0'
    }
  }

  async function selectRMSFile () {
    // 50ms usually seems to be enough :eyes:

    click(770, 95) // Map Style
    await delay(50)
    click(640, 160) // → Custom
    await delay(50)
    click(770, 125) // Location
    await delay(50)
    click(630, 150) // Top entry
    await delay(50)
  }

  async function startGame () {
    click(120, 570)
    while (!isOpen()) {
      await delay(50)
    }

    function isOpen () {
      return getColor(18, 13) === '#ffeba0'
    }
  }
}
