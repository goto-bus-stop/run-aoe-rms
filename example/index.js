const path = require('path')
const { readFileSync, createWriteStream } = require('fs')
const { Buffer } = require('buffer')
const pify = require('pify')
const Canvas = require('canvas')
const { RecordedGame } = require('recage')
const runRandomMapScript = require('../src/index')
const terrainColors = require('./terrainColors.json')

const rmsPath = process.argv[2]
if (!rmsPath) {
  throw new Error('Supply a path to a random map script.')
}
const outputPath = process.argv[3]
if (!outputPath) {
  throw new Error('Supply a path for the minimap image.')
}

runRandomMapScript(
  readFileSync(rmsPath, 'utf8'),
  { aocDir: '/home/user/.wine/drive_c/aoc-up/' }
).then((recSource) => {
  const game = new RecordedGame(recSource)
  return pify(game.parseHeader.bind(game))()
}).then(({ map }) => {
  const tileSize = 3

  const canvas = new Canvas(tileSize * map.length, tileSize * map[0].length)
  const context = canvas.getContext('2d')

  map.forEach((row, y) => {
    row.forEach((tile, x) => {
      context.fillStyle = terrainColors[tile.terrain]
      context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
    })
  }, [])

  // Write to stdout, hopefully user has redirected it to a file!
  canvas.pngStream().pipe(createWriteStream(outputPath))
}).catch((err) => {
  console.error(err.stack)
})
