
let WIDTH = 640
let HEIGHT = 480
let aspectRatio = WIDTH / HEIGHT

let scene, camera, renderer
let controls
let terrain

let prevTime = 0
let time = 0

let init = () => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(
    75,             // field of view
    aspectRatio,    // aspect ratio
    0.01,            // near clipping plane
    100000            // far clipping plane
  )

//  let light = new THREE.DirectionalLight(0xffddcc, 1)
//  let ambient = new THREE.AmbientLight(0xaaddff, 0.25)

  let light = new THREE.DirectionalLight(0xffffff, 1)
  let ambient = new THREE.AmbientLight(0xffffff, 0.25)

  light.position.set(500, 500, 500)
  scene.add(light)
  scene.add(ambient)

  let x = 64      // grid width
  let z = 64      // grid depth
  let y = 64      // grid height
  let scale = 200   // grid size
  let freq = 0.005 // noise frequency
  let octaves = 5
//  let lacunarity = 2.1042
  let lacunarity = 1.8715
  let persistence = 1/lacunarity

  let LODMap
  switch(2) {
    case 0:
      LODMap= [
        [0]
      ]
      break
    case 1:
      LODMap = [
        [0, 2],  // x
        [2, 2]

        // z
      ]
      break
    case 2:
      LODMap = [
        [ 0,  0,  1],
        [ 0,  0,  1],
        [ 1,  1,  1]
      ]
    case 3:
      LODMap = [
        [ 0,  0,  1, 2],
        [ 0,  0,  1, 2],
        [ 1,  1,  1, 2],
        [ 2,  2,  2, 2],
      ]
  }

  terrain = new Terrain(LODMap, x, z, y, scale, freq,
                        octaves, lacunarity, persistence)

  _.values(terrain.chunks).forEach(chunk => scene.add(chunk.mesh))

  let height = 150
  let speed = 60000
  controls = new PointerLockControls(camera, terrain, height, speed)
  scene.add(controls.getObject())

  renderer = new THREE.WebGLRenderer()
  renderer.setSize(WIDTH, HEIGHT)
  renderer.setClearColor(0x99ddff)

  document
    .getElementById('canvas-container')
    .appendChild(renderer.domElement)
}

let render = () => {
  requestAnimationFrame(render)

  time += 1/60 * 1000
  let dt = (time - prevTime) / 1000

  let cameraPosition = controls.update(dt)
  terrain.update(cameraPosition, scene)

  prevTime = time

  renderer.render(scene, camera)
}

init()
render()
