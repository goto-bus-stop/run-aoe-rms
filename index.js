const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { readFileSync } = require('fs')
const pify = require('pify')
const headless = require('headless')
const delay = require('delay')
const mv = pify(require('mv'))
const fs = require('mz/fs')
const del = require('del')
const debug = require('debug')('run-aoe-rms')

const BASEDIR = '/home/user/.wine/drive_c/aoc-up/'
const AOC_PATH = 'Age2_x1/age2_x1.exe'
const RMS_PATH = 'Random'
const RMS_BACKUP = '.run-aoe-rms-backup.Random'
const VIRT_SCREEN = 0

const source = getSource()

async function main (xvfb, num) {
  const env = Object.assign({}, process.env, {
    DISPLAY: `:${num}.0`
  })

  await prepareRMSFolder()
  debug('prepared folder')

  const aoc = await spawnAoc()
  debug('assuming aoc is ready')
  takeScreenshot('/tmp/main-menu.png')

  await openSinglePlayerMenu()
  debug('opened single player menu')
  takeScreenshot('/tmp/single-player-menu.png')

  await openGameSetupScreen()
  debug('opened game setup screen')
  takeScreenshot('/tmp/game-setup-screen.png')

  await selectRMSFile()
  debug('selected rms file')
  takeScreenshot('/tmp/select-rms-file.png')

  await restoreRMSFolder()
  debug('restored folder')

  await startGame()
  debug('started game')

  await new Promise((resolve) => {
    aoc.on('close', resolve)
  })

  exit()

  async function prepareRMSFolder () {
    await del(path.join(BASEDIR, RMS_BACKUP), { force: true })
    await mv(path.join(BASEDIR, RMS_PATH), path.join(BASEDIR, RMS_BACKUP))

    await fs.mkdir(path.join(BASEDIR, RMS_PATH))
    await fs.writeFile(path.join(BASEDIR, RMS_PATH, 'Current.rms'), source)
  }

  async function restoreRMSFolder () {
    await del(path.join(BASEDIR, RMS_PATH), { force: true })
    await mv(path.join(BASEDIR, RMS_BACKUP), path.join(BASEDIR, RMS_PATH))
  }

  async function spawnAoc () {
    debug('spawn wine aoc')
    const cp = spawn('wine', [
      path.join(BASEDIR, AOC_PATH)
    ], {
      env,
      cwd: BASEDIR
    })

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

  function getColor (x, y) {
    const tmpFile = '/tmp/color.txt'

    // Grab one pixel and save it as a `.txt`.
    spawnSync('import', [
      '-display', `:${num}`,
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

  function takeScreenshot (saveAt = '/tmp/aoe.png') {
    debug('screenshot to', saveAt)
    spawnSync('import', [
      '-display', `:${num}`,
      '-window', 'root',
      saveAt
    ])
  }

  function click (x, y, rightClick = false) {
    debug('click', x, y)
    spawnSync('xdotool', [
      'mousemove', x, y,
      'click', rightClick ? 2 : 1
    ], { env })
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

  function exit () {
    xvfb.kill('SIGTERM')
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
  }
}

headless({
  display: {
    width: 800,
    height: 600,
    depth: 24
  }
}, (err, xvfb, num) => {
  main(xvfb, num).catch((err) => {
    console.error(err.stack)
  })
})

function getSource () {
  return readFileSync(path.join(__dirname, 'test.rms'), 'utf8')
}
