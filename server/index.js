const { readFileSync } = require('fs')
const express = require('express')
const app = express()
const helpers = require('./helpers')
const THEMES = ['quote', 'fees', 'lightning', 'stats']
const { DISPLAY_SERVER_PORT: port = 3030, DISPLAY_THEME: envTheme = THEMES[0] } = process.env

app.set('view engine', 'pug')

app.use(express.static('public'))

app.get('/:theme?', (req, res) => {
  try {
    const data = JSON.parse(readFileSync('data.json', 'utf8'))
    const theme = (req.params.theme || envTheme).toLowerCase()
    const tmpl = theme === 'random'
      ? THEMES[Math.floor(Math.random() * THEMES.length)]
      : THEMES.includes(theme) ? theme : THEMES[0]
    res.render(tmpl, { ...data, ...helpers })
  } catch (err) {
    res.status(500).send(err)
  }
})

app.listen(port, () => console.log(`Running at http://localhost:${port}`))
