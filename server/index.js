const { readFileSync } = require('fs')
const express = require('express')
const app = express()
const port = 3030

app.set('view engine', 'pug')

app.use(express.static('public'))

app.get('/', (req, res) => {
  const data = JSON.parse(readFileSync('data.json', 'utf8'))

  res.render('index', data)
})

app.listen(port, () => console.log(`Running at http://localhost:${port}`))
