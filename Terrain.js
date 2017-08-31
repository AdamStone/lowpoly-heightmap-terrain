
let cross2d = (u, v) => {
  return u[0] * v[1] - u[1] * v[0]
}

class Gradient {
  constructor(stops, resolution) {
    this.stops = {}
    this.resolution = resolution
    stops.forEach(stop => {
      this.setStop.apply(this, stop)
    })
    this.colors = []
    for (let i = 0; i < resolution; i++) {
      this.colors[i] = this.makeColor(i/resolution)
    }
  }

  getColor(offset) {
    return this.colors[Math.floor(offset * this.resolution)]
  }

  setStop(offset, r, g, b) {
    this.stops[offset] = nj.array([r, g, b])
  }

  makeColor(offset) {
    let offsets = _.keys(this.stops).map(x => Number(x))
    let rgb
    if (offset in this.stops) {
      rgb = this.stops[offset]
    }
    else {
      let start = _.max(offsets.filter(x => x <= offset))
      let end = _.min(offsets.filter(x => x >= offset))
      let diff = this.stops[end].subtract(this.stops[start])
      let multiplier = (offset - start)/(end - start)
      rgb = this.stops[start].add(diff.multiply(multiplier))
    }
    rgb.dtype = 'uint8'
    return new THREE.Color(
      `rgb(${rgb.get(0)}, ${rgb.get(1)}, ${rgb.get(2)})`
    )
  }
}

let gradient = new Gradient([
  [0,    93,  71,  49 ],  // brown
  [0.25, 35,  75,  44 ],  // dark green
  [0.60, 114, 184, 72 ],  // green
  [0.70, 220, 232, 149],  // tan
  [1, 255, 255, 255]   // white
], 32)

class Chunk {
  constructor(LOD, width, depth, height, gridScale = 100, noiseScale = 0.05,
              octaves = 3, lacunarity = 2, persistence = 0.5,
              offsetX = 0, offsetZ = 0) {

    this.LOD = LOD
    this.width = width
    this.depth = depth
    this.height = height
    this.gridScale = gridScale
    this.octaves = octaves
    this.lacunarity = lacunarity
    this.persistence = persistence
    this.offsetX = offsetX
    this.offsetZ = offsetZ

    this.id = Math.floor(Math.random() * 10000).toString()

    let basis = noise.perlin2
//    let basis = (x, y) => 1.5 - Math.abs(noise.perlin2(x, y))
    this.generateHeightmap(basis, noiseScale, height * gridScale,
                          octaves, lacunarity, persistence)
    this.mesh = this.makeGeometry()
    this.mesh.name = this.id
  }

  generateHeightmap(basis, frequency, amplitude, octaves,
                    lacunarity, persistence) {
    this.heightmap = nj.zeros([this.width + 1, this.depth + 1]).tolist()
    let freqs = _.range(octaves).map(o => Math.pow(lacunarity, o))
    let amps = _.range(octaves).map(o => Math.pow(persistence, o))
    let amp, freq, total, offX, offZ, o, i, j
    // for each point
    for (i = 0; i < this.width + 1; i++) {
      for (j = 0; j < this.depth + 1; j++) {
        amp = amplitude
        freq = frequency
        total = 0
        offX = this.offsetX / this.gridScale
        offZ = this.offsetZ / this.gridScale
        for (o = 0; o < octaves; o++) {
          freq *= freqs[o]
          amp *= amps[o]
          total += basis((i + offX) * freq, (j + offZ) * freq) * amp
        }
        this.heightmap[j][i] = total
      }
    }
  }

  makeGeometry() {
    let geometry = new THREE.Geometry()
    let triangles
    let ymin = -12000
    let ymax = 12000
    let yrange = ymax - ymin
    let indices = []
    let colors = []
//    let material = new THREE.MeshNormalMaterial({
//      side: THREE.DoubleSide
//    })
    let material = new THREE.MeshLambertMaterial({
      vertexColors: THREE.VertexColors,
      shading: THREE.SmoothShading
    })

    // for each cell
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.depth; j++) {
        // resets arrays without creating new objects
        indices.length = 0
        colors.length = 0
        for (let di = i; di < i+2; di++) {
          for (let dj = j; dj < j+2; dj++) {
            let y = this.heightmap[dj][di]
            geometry.vertices.push(new THREE.Vector3(
              di * this.gridScale, y, dj * this.gridScale
            ))
            indices.push(geometry.vertices.length - 1)
            let color = gradient.getColor((y - ymin) / yrange)
            if (color == null || y < ymin || y > ymax) {
              setTimeout(() => {
                throw new Error(`y value ${y} outside color gradient range`)
              }, 100)
              color = gradient.colors[0]
            }
            colors.push(color)
          }
        }
  //          added in this order:
  //                  0---2  i ->
  //                  | \ |
  //                  1---3
  //
  //                  j

        let face1 = new THREE.Face3(
          indices[0], indices[1], indices[3]
        )
        face1.vertexColors.push(colors[0])
        face1.vertexColors.push(colors[1])
        face1.vertexColors.push(colors[3])
        geometry.faces.push(face1)

        let face2 = new THREE.Face3(
          indices[0], indices[3], indices[2]
        )
        face2.vertexColors.push(colors[0])
        face2.vertexColors.push(colors[3])
        face2.vertexColors.push(colors[2])
        geometry.faces.push(face2)
      }
    }

    // shift all the vectors so y axis is centered
    let dx = -this.width * this.gridScale / 2 + this.offsetX
    let dz = -this.depth * this.gridScale / 2 + this.offsetZ
    geometry.translate(dx, 0, dz)

    geometry.computeFaceNormals()
    let mesh = new THREE.Mesh(geometry, material)
    return mesh
  }

  getHeight(cx, cz) {
    // get the interpolated height

    // heightmap indexing always starts from 0, 0,
    // so inputs should be relative x and z from chunk corner

    // within the chunk, x and z are scaled by this.gridScale
    cx /= this.gridScale
    cz /= this.gridScale

    let x_ = Math.floor(cx)
    let z_ = Math.floor(cz)

    let dx = cx - x_
    let dz = cz - z_

    // origin in the top-left corner
    //
    //            00-10  x
    //            | \ |
    //            01-11
    //
    //            z

    let p = [dx, dz]

    let vDiag = [1, 1]

    let vEdge
    if (dx > dz) {
      // in the top-right triangle
      vEdge = [1, 0]
    }
    else {
      // in the bottom-left triangle
      vEdge = [0, 1]
    }

    // half the cross product is triangle area, total area is 1/2,
    // so the fraction of total area is xprod / 2 / 0.5 == xprod
    //
    //      00
    //   v  |\`
    //   E  | \ `   vDiag
    //   d  w11\ wD
    //   g  |  /p`. `
    //   e  | / w00 `.`
    //      D----------11

    let wD = Math.abs(cross2d(vDiag, p))
    let w11 = Math.abs(cross2d(vEdge, p))
    let w00 = 1 - w11 - wD

    let y11 = this.heightmap[z_ + 1][x_ + 1]
    let y00 = this.heightmap[z_][x_]
    let yD = this.heightmap[z_ + vEdge[1]][x_ + vEdge[0]]

    let result = y00 * w00 + y11 * w11 + yD * wD
    if (result != null && !isNaN(result)) {
      return result
    }
    return -2000
  }
}

class Terrain {
  constructor(LODMap, chunkWidth, chunkDepth, chunkHeight, gridScale,
               noiseScale, octaves, lacunarity, persistence) {

    this.LODMap = LODMap
    this.chunkWidth = chunkWidth
    this.chunkDepth = chunkDepth
    this.chunkHeight = chunkHeight
    this.gridScale = gridScale
    this.noiseScale = noiseScale
    this.octaves = octaves
    this.lacunarity = lacunarity
    this.persistence = persistence

    this.chunks = {}
    this.pendingChunks = {}
  }

  getHeight(x, z) {
    // find the chunk it belongs to
    let wx = this.chunkWidth * this.gridScale  // width of one chunk
    let wz = this.chunkDepth * this.gridScale  // depth of one chunk

    let ci = Math.floor((x + wx/2)/wx)     // x index offset from center chunk
    let cj = Math.floor((z + wz/2)/wz)     // z index offset from center chunk

    let cx = x - wx * (ci - 1/2)           // x position relative to chunk
    let cz = z - wz * (cj - 1/2)           // z position relative to chunk

    let chunk = this.chunks[[ci,cj].join('|')]
    if (chunk) {
      return chunk.getHeight(cx, cz)
    }
    return -2001
  }

  update(cameraPosition, scene) {

    let { x, z } = cameraPosition

    let wx = this.chunkWidth * this.gridScale
    let wz = this.chunkDepth * this.gridScale

    let ci = Math.floor((x + wx/2)/wx)     // x index offset from center of the map
    let cj = Math.floor((z + wz/2)/wz)     // z index offset from center of the map

    this.pendingChunk = false
    for (let i = 0; i < this.LODMap.length; i++) {  // x axis
      for (let j = 0; j < this.LODMap[0].length; j++) {    // z axis
        let LOD = this.LODMap[j][i]

        this.makeChunk(i + ci, j + cj, LOD, scene)
        if (i !== 0) {
          this.makeChunk(-i + ci, j + cj, LOD, scene)
        }
        if (j !== 0) {
          this.makeChunk(i + ci, -j + cj, LOD, scene)
        }
        if (i !== 0 && j !== 0) {
          this.makeChunk(-i + ci, -j + cj, LOD, scene)
        }
      }
    }
  }

  makeKey(i, j) {
    return [i,j].join('|')
  }

  makeChunk(i, j, targetLOD, scene) {
    let key = this.makeKey(i, j)
    let currentChunk = this.chunks[key]
    let pendingChunk = this.pendingChunks[key]
    if (targetLOD < 0) {
      // just need delete the current chunk
      if (currentChunk) {
//        console.log(`deleting chunk at ${i}, ${j}`)
        scene.remove(currentChunk.mesh)
      }
      delete this.chunks[key]
    }
    else if (currentChunk && currentChunk.LOD === targetLOD) {
      // no need to change anything
      return
    }
    else if (pendingChunk) {
      // chunk is in progress, no need to do anything
      return
    }
    else if (this.pendingChunk) {
      return
    }
    else {
      // need to make a new chunk
//      console.log(`queuing new chunk at ${i}, ${j}`)
      this.pendingChunks[key] = true
      this.pendingChunk = true

      setTimeout(() => {
        let scale = Math.pow(2, targetLOD)
        let w = this.chunkWidth / scale
        let d = this.chunkDepth / scale
        let h = this.chunkHeight / scale
        let gs = this.gridScale * scale
        let ns = this.noiseScale * scale
        // chunk position relative to center
        let offsetX = i * w * gs
        let offsetZ = j * d * gs

        let newChunk = new Chunk(
          targetLOD, w, d, h, gs, ns,
          this.octaves, this.lacunarity, this.persistence,
          offsetX, offsetZ
        )

//        console.log(`finished new chunk at ${i}, ${j}`)
        delete this.pendingChunks[key]

        if (currentChunk) {
//          console.log(`replacing old chunk at ${i}, ${j}`)
          scene.remove(currentChunk.mesh)
        }
        scene.add(newChunk.mesh)
        this.chunks[key] = newChunk
      }, 1)
    }
  }
}
