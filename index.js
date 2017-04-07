const path = require('path')
const { readFileSync } = require('fs')
const runRandomMapScript = require('./src/index')

runRandomMapScript(
  readFileSync(path.join(__dirname, 'test.rms'), 'utf8')
).catch((err) => {
  console.error(err.stack)
})
