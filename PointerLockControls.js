
// based on the three.js example
// https://threejs.org/examples/misc_controls_pointerlock.html
class PointerLockControls {
  constructor(camera, terrain, height, speed) {
    this.enabled = false
    this.mass = 500
    this.speed = speed
    this.height = height
    this.terrain = terrain

    this.velocity = new THREE.Vector3()

    camera.rotation.set(0, 0, 0)

    this._pitchObject = new THREE.Object3D()
    this._pitchObject.add(camera)

    this._yawObject = new THREE.Object3D()
    this._yawObject.position.y = this.height
    this._yawObject.add(this._pitchObject)

    this.getObject = () => this._yawObject

    this.init()
  }

  init() {
    let pointerLockSupported = (
      'pointerLockElement' in document
      || 'mozPointerLockElement' in document
      || 'webkitPointerLockElement' in document
    )
    if (pointerLockSupported) {
      let p = localStorage.getItem('position')
      let rotation = localStorage.getItem('rotation')

      if (false && p && rotation) {
        p = JSON.parse(p)
        rotation = JSON.parse(rotation)
        this._yawObject.position.x = p[0]
        this._yawObject.position.y = p[1]
        this._yawObject.position.z = p[2]
        this._pitchObject.rotation.x = rotation[0]
        this._yawObject.rotation.y = rotation[1]
      }
      // setup event handlers for enabling/disabling pointerlock
      let element = document.body
      let plchange = (event) => {
        if (document.pointerLockElement === element
           || document.mozPointerLockElement === element
           || document.webkitPointerLockElement === element) {

          this.enabled = true
        }
        else {
          this.enabled = false
        }
      }
      let plerror = (error) => {
        console.warn(error)
      }
      let prefixes = ['', 'moz', 'webkit'].forEach((prefix) => {
        document.addEventListener(prefix + 'pointerlockchange', plchange, false)
        document.addEventListener(prefix + 'pointerlockerror', plerror, false)
        let rpl = prefix ? prefix + 'RequestPointerLock' : 'requestPointerlock'
        if (element[rpl]) {
          element.requestPointerLock = element[rpl]
        }
      })
      element.addEventListener('click', (event) => {
        if (!this.enabled) {
          element.requestPointerLock()
        }
      }, false)

      // setup event handlers for pitch and yaw changes when mouse moves
      const PI_2 = Math.PI / 2
      let onMouseMove = (event) => {
        if (this.enabled) {
          const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0

          const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0

          this._yawObject.rotation.y -= movementX * 0.002
          this._pitchObject.rotation.x -= movementY * 0.002

          this._pitchObject.rotation.x = Math.max(
            -PI_2, Math.min(PI_2, this._pitchObject.rotation.x)
          )
        }
      }

      document.addEventListener('mousemove', onMouseMove, false)

      // setup event handlers for keyboard controls
      let onKeyDown = (event) => {
        switch(event.keyCode) {

          case 38:  // up
          case 87:  // w
            this.moveForward = true
            break

          case 37:  // left
          case 65:  // a
            this.moveLeft = true
            break

          case 40:  // down
          case 83:  // s
            this.moveBackward = true
            break

          case 39:  // right
          case 68:  // d
            this.moveRight = true
            break

          case 32:  // space
            this.moveUp = true
            break
        }
      }
      let onKeyUp = (event) => {
        switch(event.keyCode) {

          case 38:  // up
          case 87:  // w
            this.moveForward = false
            break

          case 37:  // left
          case 65:  // a
            this.moveLeft = false
            break

          case 40:  // down
          case 83:  // s
            this.moveBackward = false
            break

          case 39:  // right
          case 68:  // d
            this.moveRight = false
            break

          case 32:  // space
            this.moveUp = false
        }
      }

      document.addEventListener('keydown', onKeyDown, false)
      document.addEventListener('keyup', onKeyUp, false)

      // this was never used in the example
      this.dispose = () => {
        document.removeEventListener('mousemove', onMouseMove, false)
        document.removeEventListener('keydown', onKeyDown, false)
        document.removeEventListener('keyup', onKeyUp, false)
      }

      this.update(1)
    }
    else {
      alert('PointerLock controls not supported')
    }
  }

  getDirection() {
    // assumes the camera itself is not rotated
    const direction = new THREE.Vector3(0, 0, -1)
    const rotation = new THREE.Euler(0, 0, 0, 'YXZ')
    return (v) => {
      rotation.set(this._pitchObject.rotation.x, this._yawObject.rotation.y, 0)
      v.copy(direction).applyEuler(rotation)
      return v
    }
  }

  update(dt) {
    let obj = this.getObject()
    let velocity = this.velocity
    if (this.enabled) {

      velocity.x -= velocity.x * 10 * dt
      velocity.z -= velocity.z * 10 * dt

      if (this.moveUp) {
        velocity.y += this.speed/2 * dt
      }
      else {
        velocity.y -= 9.8 * this.mass * dt
      }

      if (this.moveForward) velocity.z -= this.speed * dt
      if (this.moveBackward) velocity.z += this.speed * dt

      if (this.moveLeft) velocity.x -= this.speed * dt
      if (this.moveRight) velocity.x += this.speed * dt

      obj.translateX(velocity.x * dt)
      obj.translateY(velocity.y * dt)
      obj.translateZ(velocity.z * dt)
    }
    let atX = Math.floor(obj.position.x)
    let atZ = Math.floor(obj.position.z)
    let terrainY = this.terrain.getHeight(atX, atZ)
    if (obj.position.y < terrainY + this.height) {
      velocity.y = 0
      obj.position.y = terrainY + this.height
      localStorage.setItem(
        'position', JSON.stringify(
          [obj.position.x, obj.position.y, obj.position.z]
        )
      )
      localStorage.setItem(
        'rotation', JSON.stringify([
          this._pitchObject.rotation.x,
          this._yawObject.rotation.y
        ])
      )
    }
    return obj.position
  }
}
