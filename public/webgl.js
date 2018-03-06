const socket = window.io.connect('//')
const appTargetElement = document.getElementById('appTarget')
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl')
let state = {}
let lastPixelScale
let lastBoundingRect
let animationFrameRequestId
let lastSceneState
const loop = (time) => {
  animationFrameRequestId = window.requestAnimationFrame(loop)
  const sceneState = JSON.stringify(state)
  const needsResize = detectNeedForResize()
  if (lastSceneState !== sceneState || needsResize) {
    drawScene()
    lastSceneState = sceneState
  }
}
const detectNeedForResize = () => {
  const pixelScale = window.devicePixelRatio || 1
  const boundingRect = canvas.parentNode.getBoundingClientRect()
  const needsResize = (
    !lastPixelScale ||
    lastPixelScale !== pixelScale ||
    !lastBoundingRect ||
    lastBoundingRect.width !== boundingRect.width ||
    lastBoundingRect.height !== boundingRect.height
  )
  if (needsResize) {
    resize(
      boundingRect.width * pixelScale,
      boundingRect.height * pixelScale
    )
    lastPixelScale = pixelScale
    lastBoundingRect = boundingRect
  }
  return needsResize
}
const resize = (width, height) => {
  console.log('resize:', {width, height})
  canvas.width = width
  canvas.height = height
}
const initResources = async () => {
  await Promise.all([
    initShaders(),
    initBuffers()
  ])
  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.enable(gl.DEPTH_TEST)
  loop(window.performance.now())
}
let shaderSourcesPromise
let shaderProgram
const initShaders = async () => {
  // const vertexShader = createShader(gl)
  const sourcesMap = {
    fragment: '/webgl-shader-fragment.glsl',
    vertex: '/webgl-shader-vertex.glsl'
  }
  const entries = Object.entries(sourcesMap)
  if (!shaderSourcesPromise) {
    shaderSourcesPromise = Promise.all(entries.map(([key, path]) => {
      return getAssetText(path)
    }))
  }
  const shaderSources = {}
  const shaders = {}
  const loadedShaders = await shaderSourcesPromise
  loadedShaders.forEach((result, index) => {
    const key = entries[index][0]
    const type = key.toLocaleUpperCase().includes('VERTEX') ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER
    shaderSources[key] = result
    shaders[key] = createShader(gl, result, type)
  })
  console.log('initShaders: Complete', {shaderSources, shaders})
  shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, shaders.vertex)
  gl.attachShader(shaderProgram, shaders.fragment)
  gl.linkProgram(shaderProgram)
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Could not initialise shaders')
  }
  gl.useProgram(shaderProgram)
  shaderProgram.a_vec3position = gl.getAttribLocation(shaderProgram, 'a_vec3position')
  gl.enableVertexAttribArray(shaderProgram.a_vec3position)
  shaderProgram.u_mat4transform = gl.getUniformLocation(shaderProgram, 'u_mat4transform')
  shaderProgram.u_mat4perspective = gl.getUniformLocation(shaderProgram, 'u_mat4perspective')
  shaderProgram.u_color = gl.getUniformLocation(shaderProgram, 'u_color')
}
const getAssetText = (path) => {
  let succeed, fail
  const promise = new Promise((resolve, reject) => {
    succeed = resolve
    fail = reject
  })
  const request = new XMLHttpRequest()
  request.open('GET', path, true)
  request.addEventListener('load', () => {
    succeed(request.responseText)
  })
  request.addEventListener('error', () => {
    fail(request.responseText)
  })
  request.send()
  return promise
}
const createShader = (gl, sourceCode, type) => {
  // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
  const shader = gl.createShader(type)
  gl.shaderSource(shader, sourceCode)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    throw new Error('Could not compile WebGL program. \n\n' + info)
  }
  return shader
}
let shapeBuffers = {}
const initBuffers = async () => {
  const boundingShape = [
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0
  ]
  const shipShape = [
    -0.5, 0, 0,
    -1, -1, 0,
    1, 0, 0,
    1, 0, 0,
    -1, 1, 0,
    -0.5, 0, 0
  ]
  shapeBuffers.boundingShape = makeBufferForVertList(boundingShape)
  shapeBuffers.shipShape = makeBufferForVertList(shipShape)
}
const makeBufferForVertList = (vertList) => {
  const elementsPerVert = 3
  const numVerts = vertList.length / elementsPerVert
  const buffer = gl.createBuffer()
  const positionArray = new Float32Array(vertList)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW)
  vertList.forEach((vertexComponent, i) => {
    positionArray[i] = vertexComponent
  })
  buffer.itemSize = elementsPerVert
  buffer.numItems = numVerts
  return buffer
}
const mat4boundingTransform = window.mat4.create()
const mat4perspectiveTransform = window.mat4.create()
const mat4perspective = window.mat4.create()
const mat4transform = window.mat4.create()
const drawScene = () => {
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  window.mat4.perspective(
    mat4perspective,
    Math.PI / 8,
    canvas.width / canvas.height,
    1000,
    0.1
  )
  window.mat4.fromTranslation(
    mat4perspectiveTransform,
    window.vec3.fromValues(0, 0, -10)
  )
  window.mat4.mul(mat4perspective, mat4perspective, mat4perspectiveTransform)
  gl.uniformMatrix4fv(shaderProgram.u_mat4perspective, false, mat4perspective)
  gl.uniformMatrix4fv(shaderProgram.u_mat4transform, false, mat4boundingTransform)
  gl.uniform3fv(shaderProgram.u_color, [0.75, 0.75, 0.75])
  bindShapeBuffer(shapeBuffers.boundingShape)
  gl.drawArrays(gl.LINE_LOOP, 0, shapeBuffers.boundingShape.numItems)
  if (state.ships && state.ships.length) {
    bindShapeBuffer(shapeBuffers.shipShape)
    state.ships.forEach((ship) => {
      window.mat4.identity(mat4transform)
      window.mat4.translate(
        mat4transform,
        mat4transform,
        window.vec3.fromValues(ship.x, -ship.y, 0)
      )
      window.mat4.rotateZ(
        mat4transform,
        mat4transform,
        -ship.angle
      )
      window.mat4.scale(
        mat4transform,
        mat4transform,
        window.vec3.fromValues(ship.radius, ship.radius, ship.radius)
      )
      gl.uniformMatrix4fv(shaderProgram.u_mat4transform, false, mat4transform)
      gl.uniform3fv(shaderProgram.u_color, hueToRgb(ship.hue))
      gl.drawArrays(gl.TRIANGLES, 0, shapeBuffers.shipShape.numItems)
    })
  }
}
const cachedHueMap = {}
const hueToRgb = (hue) => {
  const result = cachedHueMap[hue] || hsl2rgb([hue, 100, 50])
  cachedHueMap[hue] = result
  return result
}
const bindShapeBuffer = (shapeBuffer) => {
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer)
  gl.vertexAttribPointer(
    shaderProgram.a_vec3position,
    shapeBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  )
}

canvas.addEventListener(
  'webglcontextcreationerror',
  (e) => {
    console.error(e)
    alert('Sorry, your browser is incapable of performing basic WebGL features\n' + e.statusMessage)
  },
  false
)
canvas.addEventListener(
  'webglcontextlost',
  (e) => {
    console.error(e)
    e.preventDefault()
    window.cancelAnimationFrame(animationFrameRequestId)
  },
  false
)
canvas.addEventListener(
  'webglcontextrestored',
  (e) => {
    console.log(e)
    initResources()
  },
  false
)
canvas.style = 'width: 100%; height: 100%;'
appTargetElement.appendChild(canvas)

initResources()

socket.on('state', function (data) {
  const lastStart = state.serverStart
  if (lastStart && lastStart !== data.serverStart) {
    socket.close()
    window.location.reload(true)
  }
  state = data
})

const hsl2rgb = function (hsl) {
  let h = hsl[0] / 360
  let s = hsl[1] / 100
  let l = hsl[2] / 100
  let t1
  let t2
  let t3
  let rgb
  let val

  if (s === 0) {
    val = l * 255
    return [val, val, val]
  }

  if (l < 0.5) {
    t2 = l * (1 + s)
  } else {
    t2 = l + s - l * s
  }

  t1 = 2 * l - t2

  rgb = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    t3 = h + 1 / 3 * -(i - 1)
    if (t3 < 0) {
      t3++
    }
    if (t3 > 1) {
      t3--
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3
    } else if (2 * t3 < 1) {
      val = t2
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6
    } else {
      val = t1
    }

    rgb[i] = val
  }

  return rgb
}