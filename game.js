const tau = Math.PI * 2
const arrayRemove = function (array, item) {
  let index
  while ((index = array.indexOf(item)) !== -1) {
    array.splice(index, 1)
  }
  return array
}
const game = {
  playerSockets: [],
  drag: 0.955,
  topSpeed: 1 / 80,
  shipRadius: 1 / 40,
  asteroidRadiusMin: 1 / 90,
  asteroidRadiusMax: 1 / 15,
  asteroidCount: 0,
  state: {
    ships: [],
    asteroids: []
  },
  connectWebSockets: (io) => {
    io.on('connection', function (socket) {
      game.addPlayer(socket)
      socket.force = 0
      socket.onTime = null
      socket.on('change', function (moveData) {
        game.controlChange(socket, moveData)
      })
      socket.on('release', function () {
        game.controlRelease(socket)
      })
      socket.on('disconnect', function () {
        game.removePlayer(socket)
      })
    })
    while (game.state.asteroids.length < 10) {
      game.state.asteroids.push(
        game.createAsteroid()
      )
    }
    setInterval(
      () => {
        const now = Date.now()
        game.tickPlayers(now)
        game.tickAsteroids(now)
        game.state.asteroids = game.state.asteroids.filter((asteroid) => { return !asteroid.expired })
        io.emit('state', game.state)
      },
      10
    )
  },
  tickPlayers: (now) => {
    game.playerSockets.forEach(socket => {
      let ship = socket.ship
      ship.x += ship.xVel
      ship.y += ship.yVel
      game.wrap(ship)

      if (socket.onTime !== null) {
        const timeDiff = now - socket.onTime
        const accelerationRampUp = Math.min(1, timeDiff / 1000)
        ship.xVel = Math.cos(ship.angle) * socket.force * accelerationRampUp * game.topSpeed
        ship.yVel = Math.sin(ship.angle) * socket.force * accelerationRampUp * game.topSpeed
      } else {
        ship.xVel *= game.drag
        ship.yVel *= game.drag
      }
    })
  },
  tickAsteroids: (now) => {
    game.state.ships.forEach(ship => {
      ship.hit = false
    })
    game.state.asteroids.forEach(asteroid => {
      asteroid.x += asteroid.xVel
      asteroid.y += asteroid.yVel
      asteroid.angle += asteroid.rotationSpeed
      game.wrap(asteroid)
      if (asteroid.invincible > 0) {
        asteroid.invincible --
      } else {
        game.state.ships.forEach(ship => {
          const hit = game.detectCollision(ship, asteroid)
          asteroid.hit = asteroid.hit || hit
          asteroid.expired = asteroid.expired || hit
          if (asteroid.hit && asteroid.radius / 2 >= game.asteroidRadiusMin) {
            game.splitAsteroid(asteroid)
          }
          ship.hit = ship.hit || hit
        })
      }
    })
  },
  wrap: (target) => {
    target.x = Math.abs(target.x) > 1 ? -1 * Math.sign(target.x) : target.x
    target.y = Math.abs(target.y) > 1 ? -1 * Math.sign(target.y) : target.y
  },
  detectCollision: (a, b) => {
    const diffX = a.x - b.x
    const diffY = a.y - b.y
    const distance = Math.sqrt((diffX * diffX) + (diffY * diffY))
    return distance < a.radius + b.radius
  },
  addPlayer: (socket) => {
    socket.ship = game.createShip(socket)
    game.playerSockets.push(socket)
    game.state.ships.push(socket.ship)
    game.reportPlayerCount(socket)
  },
  createShip: (socket) => {
    const radius = 0.5
    const angle = Math.random() * Math.PI * 2
    return {
      id: socket.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      xVel: 0,
      yVel: 0,
      angle: 0,
      radius: game.shipRadius,
      color: `hsla(${Math.random() * 360}, 100%, 50%, 1)`,
      hit: false
    }
  },
  createAsteroid: (
    x = (Math.random() - 0.5) * 2,
    y = (Math.random() - 0.5) * 2,
    radius = Math.max(game.asteroidRadiusMax * Math.random(), game.asteroidRadiusMin)
  ) => {
    const angle = Math.random() * tau
    const speed = Math.min((1 / 800), Math.random() * (1 / 600))
    return {
      id: game.asteroidCount++,
      x: x,
      y: y,
      xVel: Math.cos(angle) * speed,
      yVel: Math.sin(angle) * speed,
      rotationSpeed: speed * Math.sign(Math.random() - 0.5),
      radius: radius,
      angle: angle,
      hit: false,
      expired: false,
      invincible: 100
    }
  },
  splitAsteroid: (asteroid) => {
    const x = asteroid.x
    const y = asteroid.y
    const radius = asteroid.radius / 2
    game.state.asteroids.push(
      game.createAsteroid(x, y, radius),
      game.createAsteroid(x, y, radius)
    )
  },
  removePlayer: (socket) => {
    arrayRemove(game.playerSockets, socket)
    arrayRemove(game.state.ships, socket.ship)
    game.reportPlayerCount(socket)
  },
  controlChange: (socket, moveData) => {
    if (!socket.onTime) {
      socket.onTime = Date.now()
    }
    socket.force = Math.min(1, moveData.force)
    socket.ship.angle = moveData.angle !== undefined ? -moveData.angle : socket.ship.angle
  },
  controlRelease: (socket) => {
    socket.onTime = null
  },
  reportPlayerCount: (socket) => {
    console.log('Connected players:', game.playerSockets.length)
    socket.server.emit('players', game.playerSockets.length)
    socket.server.emit('state', game.state)
  }
}

module.exports = game