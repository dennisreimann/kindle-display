const { readFileSync } = require('fs')
const express = require('express')
const app = express()
const { DISPLAY_SERVER_PORT: port } = process.env

const currency = code => {
  switch (code) {
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    default:
      return code
  }
}

app.set('view engine', 'pug')

app.use(express.static('public'))

app.get('/', (req, res) => {
  try {
    const data = JSON.parse(readFileSync('data.json', 'utf8'))
    res.render('index', { ...data, currency })
  } catch (err) {
    res.status(500).send('Could not open or parse data.json')
  }
})

app.listen(port, () => console.log(`Running at http://localhost:${port}`))
