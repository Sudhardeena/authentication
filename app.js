const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

let db = null
const initializingDBAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, 'covid19IndiaPortal.db'),
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializingDBAndServer()

app.post('/login', async (req, res) => {
  const {username, password} = req.body
  const isUserPresentedQuery = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(isUserPresentedQuery)
  if (dbUser === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      res.send({jwtToken})
      // res.send(payload)
    } else {
      res.status(400)
      res.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authenticateToken, async (req, res) => {
  const query = `SELECT * FROM state;`
  const dbResponse = await db.all(query)
  res.send(
    dbResponse.map(each => {
      return {
        stateId: each.state_id,
        stateName: each.state_name,
        population: each.population,
      }
    }),
  )
})

app.get('/states/:stateId/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const query = `SELECT * FROM state
  WHERE state_id = ${stateId};`
  const dbResponse = await db.get(query)
  res.send({
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  })
})

app.post('/districts/', authenticateToken, async (req, res) => {
  const detail = req.body
  const {districtName, stateId, cases, cured, active, deaths} = detail
  const query = `INSERT INTO district (district_name,state_id,cases,cured,
  active,deaths)
   VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  const dbResponse = await db.run(query)
  res.send('District Successfully Added')
})

app.get('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const query = `SELECT * FROM district
  WHERE district_id = ${districtId};`
  const dbResponse = await db.get(query)
  res.send({
    districtId: dbResponse.district_id,
    districtName: dbResponse.district_name,
    stateId: dbResponse.state_id,
    cases: dbResponse.cases,
    cured: dbResponse.cured,
    active: dbResponse.active,
    deaths: dbResponse.deaths,
  })
})

app.delete('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const query = `DELETE FROM district
  WHERE district_id = ${districtId};`
  const dbResponse = await db.run(query)
  res.send('District Removed')
})

app.put('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const detail = req.body
  const {districtName, stateId, cases, cured, active, deaths} = detail
  const query = `UPDATE district SET district_name='${districtName}',state_id=${stateId},
  cases=${cases},cured=${cured},active=${active},deaths=${deaths}
  WHERE district_id = ${districtId};`
  const dbResponse = await db.run(query)
  res.send('District Details Updated')
})

app.get('/states/:stateId/stats/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const query = `
  SELECT SUM(cases) as totalCases, SUM(cured) as totalCured, SUM(active) as totalActive,
   SUM(deaths) as totalDeaths FROM district
  WHERE state_id = ${stateId}`
  const dbResponse = await db.get(query)
  res.send(dbResponse)
})

app.get(
  '/districts/:districtId/details/',
  authenticateToken,
  async (req, res) => {
    const {districtId} = req.params
    const query = `SELECT state_name FROM state
  WHERE state_id=(SELECT state_id FROM district WHERE district_id=${districtId});`
    const dbResponse = await db.get(query)
    res.send({
      stateName: dbResponse.state_name,
    })
  },
)

module.exports = app
