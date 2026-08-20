const { readFileSync } = require('fs')
const { join } = require('path')
const express = require('express')
const app = express()
const helpers = require('./helpers.mjs')
const { DISPLAY_SERVER_PORT: port = 3030, DISPLAY_THEME: envTheme } = process.env

app.set('view engine', 'pug')

app.use(express.static('public'))

// Serve the generated greyscale PNGs from data/ (the Kindle polls display.png).
// They are mounted before the theme route and only these two files are exposed —
// the rest of data/ (incl. data.json) stays private.
const sendPng = file => (req, res) => res.sendFile(join(__dirname, 'data', file))
app.get('/display.png', sendPng('display.png'))
app.get('/screenshot.png', sendPng('screenshot.png'))

app.get('/{:theme}', (req, res) => {
  try {
    const data = JSON.parse(readFileSync('data/data.json', 'utf8'))
    const tmpl = helpers.getTheme(req.params.theme || envTheme)
    res.render(tmpl, { ...data, ...helpers })
  } catch (err) {
    console.error(err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(port, () => console.log(`Running at http://localhost:${port}`))
