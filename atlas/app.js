// HTML Atlas — 3D knowledge graph.
//
// Every surface in the archive is a plaque in space, held by the purpose it
// served. Edges are real: a link one page makes to another, the taxonomy that
// classifies it, the repo it lives in, the week it was made, or a strong overlap
// in vocabulary. Positions arrive pre-settled from the build; this file draws
// them, lights the neighbourhood you point at, and opens the surface you pick.

import * as THREE from './vendor/three.module.min.js'
import { OrbitControls } from './vendor/OrbitControls.js'

const DATA = JSON.parse(document.getElementById('graph-data').textContent)
const { nodes, links, meta } = DATA

const byId = new Map(nodes.map((node) => [node.id, node]))
const surfaces = nodes.filter((node) => node.kind === 'surface')

const KIND_COLOR = {
  group: 0xe0904a,
  sub: 0x9fb4c8,
  repo: 0x76c2a8,
  week: 0xc9a5d8,
  surface: 0xffffff,
}
const EDGE_COLOR = {
  taxonomy: [0.42, 0.36, 0.28],
  link: [0.66, 0.49, 0.26],
  affinity: [0.2, 0.28, 0.36],
  repo: [0.16, 0.3, 0.26],
  time: [0.28, 0.2, 0.34],
}
const LAYERS = { taxonomy: true, link: true, affinity: true, repo: false, time: false }

// ---------------------------------------------------------------- neighbours ---
const neighbours = new Map(nodes.map((node) => [node.id, new Set()]))
const incident = new Map(nodes.map((node) => [node.id, []]))
links.forEach((link, i) => {
  neighbours.get(link.source)?.add(link.target)
  neighbours.get(link.target)?.add(link.source)
  incident.get(link.source)?.push(i)
  incident.get(link.target)?.push(i)
})

// -------------------------------------------------------------- webgl or bust ---
// Without WebGL there is no graph, so say so plainly and hand the visitor the
// card index instead of a black rectangle.
const stage = document.getElementById('stage')

function noWebGL(reason) {
  // Every control here drives the graph, so none of them are left on screen
  // pretending to work. The brand, the about sheet and the grid link stay.
  for (const selector of ['.side', '.search-wrap', '#reset', '#spin', '#card']) {
    const element = document.querySelector(selector)
    const target = selector === '#spin' ? element?.closest('label') : element
    if (target) target.hidden = true
  }
  stage.innerHTML = `
    <div class="fallback">
      <h2>This view needs WebGL</h2>
      <p>Your browser could not open a WebGL context${reason ? ` (${reason})` : ''}, so the 3D graph cannot draw.</p>
      <p>The same ${meta.counts.surfaces} surfaces are listed, grouped and searchable in the card index.</p>
      <a class="open" href="atlas-grid.html">open the card index →</a>
    </div>`
  document.getElementById('loading')?.classList.add('done')
}

let probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
if (!probe) {
  noWebGL('no context')
  throw new Error('atlas: WebGL unavailable')
}
probe.getExtension('WEBGL_lose_context')?.loseContext()
probe = null

// ------------------------------------------------------------------- three.js ---
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)
scene.fog = new THREE.Fog(0x000000, 2800, 9000)

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 1, 24000)
camera.position.set(0, 300, 3150)

let renderer
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
} catch (error) {
  noWebGL(error.message?.slice(0, 80))
  throw error
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
stage.append(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.rotateSpeed = 0.55
controls.zoomSpeed = 0.9
controls.panSpeed = 0.6
controls.minDistance = 60
controls.maxDistance = 14000
controls.autoRotate = false
controls.autoRotateSpeed = 0.22

// ---------------------------------------------------------------------- edges ---
const edgeGeometry = new THREE.BufferGeometry()
const edgePositions = new Float32Array(links.length * 6)
const edgeColors = new Float32Array(links.length * 6)
links.forEach((link, i) => {
  const a = byId.get(link.source)
  const b = byId.get(link.target)
  if (!a || !b) return
  edgePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6)
  const color = EDGE_COLOR[link.kind] ?? [0.3, 0.3, 0.3]
  edgeColors.set([...color, ...color], i * 6)
})
edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3))
const edgeMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})
const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
scene.add(edgeLines)

const baseEdgeColors = edgeColors.slice()

/** Per-edge visibility from the layer toggles, folded into colour. */
function applyEdgeLayers() {
  const attr = edgeGeometry.getAttribute('color')
  links.forEach((link, i) => {
    const on = LAYERS[link.kind] !== false
    for (let k = 0; k < 6; k += 1) {
      attr.array[i * 6 + k] = on ? baseEdgeColors[i * 6 + k] : 0
    }
  })
  attr.needsUpdate = true
}

// ---------------------------------------------------------------------- nodes ---
const CAPTION_LIMIT = 34
const textureCache = new Map()

function plaqueTexture(node, image) {
  const width = 256
  const height = image ? 200 : 96
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (image) {
    const frameH = 150
    ctx.fillStyle = '#0c0b09'
    ctx.fillRect(0, 0, width, frameH)
    ctx.drawImage(image, 2, 2, width - 4, frameH - 4)
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, width - 2, frameH - 2)
  } else {
    const radius = node.kind === 'group' ? 9 : node.kind === 'sub' ? 6 : 5
    ctx.beginPath()
    ctx.arc(width / 2, 30, radius, 0, Math.PI * 2)
    ctx.fillStyle = `#${new THREE.Color(KIND_COLOR[node.kind] ?? 0xffffff).getHexString()}`
    ctx.fill()
  }

  const label = node.label.length > CAPTION_LIMIT ? `${node.label.slice(0, CAPTION_LIMIT - 1)}…` : node.label
  ctx.font = node.kind === 'group' ? '600 17px ui-monospace, Menlo, monospace' : '400 15px ui-monospace, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.shadowColor = 'rgba(0,0,0,0.95)'
  ctx.shadowBlur = 5
  ctx.fillStyle = node.kind === 'surface' ? 'rgba(236,231,220,0.94)' : `#${new THREE.Color(KIND_COLOR[node.kind] ?? 0xffffff).getHexString()}`
  ctx.fillText(label, width / 2, image ? 156 : 46)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function spriteScale(node) {
  if (node.kind === 'group') return 230
  if (node.kind === 'sub') return 155
  if (node.kind === 'repo' || node.kind === 'week') return 185
  return 74 + Math.min(44, node.degree * 2.4)
}

const sprites = []
for (const node of nodes) {
  const texture = plaqueTexture(node, null)
  textureCache.set(node.id, texture)
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const sprite = new THREE.Sprite(material)
  const scale = spriteScale(node)
  const aspect = texture.image.height / texture.image.width
  sprite.scale.set(scale, scale * aspect, 1)
  sprite.position.set(node.x, node.y, node.z)
  sprite.userData.node = node
  sprite.renderOrder = node.kind === 'surface' ? 1 : 2
  scene.add(sprite)
  sprites.push(sprite)
  node.sprite = sprite
}

// Thumbnails stream in after first paint so the graph is usable immediately.
let thumbsLoadedCount = 0

async function loadThumbnails() {
  const queue = surfaces.filter((node) => node.thumb)
  const total = queue.length
  let done = 0
  const progress = document.getElementById('progress')
  const worker = async () => {
    while (queue.length) {
      const node = queue.shift()
      try {
        const image = new Image()
        image.decoding = 'async'
        await new Promise((resolve, reject) => {
          image.onload = resolve
          image.onerror = reject
          image.src = `atlas/thumbs/${node.thumb}`
        })
        const texture = plaqueTexture(node, image)
        node.sprite.material.map?.dispose()
        node.sprite.material.map = texture
        node.sprite.material.needsUpdate = true
        textureCache.set(node.id, texture)
        const scale = spriteScale(node)
        sizeSprite(node.sprite, scale, texture)
        thumbsLoadedCount += 1
      } catch {}
      done += 1
      if (progress) progress.style.width = `${Math.round((done / total) * 100)}%`
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  progress?.parentElement?.classList.add('done')
}

function sizeSprite(sprite, scale, texture) {
  const aspect = texture.image.height / texture.image.width
  sprite.scale.set(scale, scale * aspect, 1)
}

// ------------------------------------------------------------------ highlight ---
const state = { hover: null, selected: null, matches: null }

function dimFor(node) {
  const { hover, selected, matches } = state
  if (matches && !matches.has(node.id)) return 0.07
  const focus = selected ?? hover
  if (!focus) return 1
  if (node.id === focus) return 1
  return neighbours.get(focus)?.has(node.id) ? 0.95 : 0.09
}

function paint() {
  for (const sprite of sprites) {
    const node = sprite.userData.node
    const opacity = dimFor(node)
    sprite.material.opacity = opacity
    sprite.visible = opacity > 0.02
  }
  const focus = state.selected ?? state.hover
  edgeMaterial.opacity = focus ? 0.5 : state.matches ? 0.12 : 0.3
  const attr = edgeGeometry.getAttribute('color')
  links.forEach((link, i) => {
    const on = LAYERS[link.kind] !== false
    let gain = 1
    if (focus) gain = link.source === focus || link.target === focus ? 2.6 : 0.14
    else if (state.matches) gain = state.matches.has(link.source) && state.matches.has(link.target) ? 2 : 0.25
    for (let k = 0; k < 6; k += 1) {
      attr.array[i * 6 + k] = on ? baseEdgeColors[i * 6 + k] * gain : 0
    }
  })
  attr.needsUpdate = true
}

// -------------------------------------------------------------------- picking ---
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerInside = false

renderer.domElement.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  pointerInside = true
})
renderer.domElement.addEventListener('pointerleave', () => {
  pointerInside = false
  if (!state.selected) {
    state.hover = null
    paint()
    hideCard()
  }
})

function pick() {
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(sprites.filter((sprite) => sprite.visible), false)
  return hits.length ? hits[0].object.userData.node : null
}

renderer.domElement.addEventListener('click', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  const node = pick()
  if (!node) {
    state.selected = null
    paint()
    hideCard()
    return
  }
  state.selected = node.id
  controls.autoRotate = false
  showCard(node, true)
  paint()
  flyTo(node)
})

renderer.domElement.addEventListener('dblclick', () => {
  const node = pick()
  if (node?.kind === 'surface' && !meta.standalone) window.open(node.href, '_blank', 'noopener')
})

// ------------------------------------------------------------------- info card ---
const card = document.getElementById('card')

function showCard(node, pinned) {
  card.dataset.pinned = pinned ? 'true' : 'false'
  if (node.kind === 'surface') {
    card.innerHTML = `
      ${node.thumb ? `<img src="atlas/thumbs/${node.thumb}" alt="" width="640" height="400">` : ''}
      <h2>${escapeHtml(node.label)}</h2>
      ${node.summary ? `<p class="summary">${escapeHtml(node.summary)}</p>` : ''}
      <dl>
        <div><dt>purpose</dt><dd>${escapeHtml(node.group)} · ${escapeHtml(node.sub)}</dd></div>
        <div><dt>repo</dt><dd>${escapeHtml(node.repo)}</dd></div>
        <div><dt>made</dt><dd>${escapeHtml(node.date)}</dd></div>
        <div><dt>path</dt><dd class="mono">${escapeHtml(node.rel)}</dd></div>
        ${node.subject ? `<div><dt>commit</dt><dd>${escapeHtml(node.subject)}</dd></div>` : ''}
        <div><dt>edges</dt><dd>${node.degree}</dd></div>
      </dl>
      ${meta.standalone ? '' : `<a class="open" href="${escapeHtml(node.href)}" target="_blank" rel="noopener">open surface →</a>
      <p class="hint">double-click the node to open it too</p>`}`
  } else {
    // A group holds subgroups, which hold the surfaces; repos and weeks hold
    // surfaces directly. Walk one extra hop when the first one finds none.
    const hop = (id) => [...(neighbours.get(id) ?? [])].map((next) => byId.get(next)).filter(Boolean)
    const direct = hop(node.id).filter((child) => child.kind === 'surface')
    const kids = direct.length
      ? direct
      : [...new Map(hop(node.id).flatMap((child) => hop(child.id)).filter((child) => child.kind === 'surface').map((child) => [child.id, child])).values()]
    card.innerHTML = `
      <h2>${escapeHtml(node.label)}</h2>
      <p class="summary">${escapeHtml(kindLabel(node))} · ${kids.length} surface${kids.length === 1 ? '' : 's'}</p>
      <ul class="kids">${kids
        .slice(0, 22)
        .map((child) => `<li><button type="button" data-goto="${escapeHtml(child.id)}">${escapeHtml(child.label)}</button></li>`)
        .join('')}</ul>
      ${kids.length > 22 ? `<p class="hint">+${kids.length - 22} more</p>` : ''}`
  }
  card.hidden = false
}

function kindLabel(node) {
  return { group: 'purpose group', sub: 'subgroup', repo: 'repository', week: 'working week' }[node.kind] ?? node.kind
}

function hideCard() {
  if (card.dataset.pinned === 'true') return
  card.hidden = true
}

card.addEventListener('click', (event) => {
  const target = event.target.closest('[data-goto]')
  if (!target) return
  const node = byId.get(target.dataset.goto)
  if (!node) return
  state.selected = node.id
  showCard(node, true)
  paint()
  flyTo(node)
})

// ---------------------------------------------------------------------- camera ---
let flight = null

function flyTo(node, distance) {
  const target = new THREE.Vector3(node.x, node.y, node.z)
  const gap = distance ?? (node.kind === 'surface' ? 340 : 900)
  const direction = camera.position.clone().sub(controls.target).normalize()
  flight = {
    fromTarget: controls.target.clone(),
    toTarget: target,
    fromPos: camera.position.clone(),
    toPos: target.clone().add(direction.multiplyScalar(gap)),
    start: performance.now(),
    duration: 900,
  }
}

function stepFlight(now) {
  if (!flight) return
  const t = Math.min(1, (now - flight.start) / flight.duration)
  const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease)
  camera.position.lerpVectors(flight.fromPos, flight.toPos, ease)
  if (t === 1) flight = null
}

function resetView() {
  state.selected = null
  state.hover = null
  card.dataset.pinned = 'false'
  hideCard()
  // Reset means reset: the query, the match set and the count go together.
  searchInput.value = ''
  runSearch()
  flight = {
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(0, 0, 0),
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(0, 300, 3150),
    start: performance.now(),
    duration: 900,
  }
}

// ---------------------------------------------------------------------- search ---
const searchInput = document.getElementById('q')
const searchCount = document.getElementById('search-count')
const haystack = new Map(
  nodes.map((node) => [
    node.id,
    `${node.label} ${node.summary ?? ''} ${node.rel ?? ''} ${node.repo ?? ''} ${node.group ?? ''} ${node.sub ?? ''} ${node.subject ?? ''} ${node.date ?? ''}`.toLowerCase(),
  ]),
)

function runSearch() {
  const query = searchInput.value.trim().toLowerCase()
  if (!query) {
    state.matches = null
    searchCount.textContent = `${surfaces.length} surfaces`
    paint()
    return
  }
  const words = query.split(/\s+/)
  const matches = new Set()
  for (const node of nodes) {
    const hay = haystack.get(node.id)
    if (words.every((word) => hay.includes(word))) matches.add(node.id)
  }
  // Keep the scaffolding of a match visible so hits stay readable in space.
  for (const id of [...matches]) {
    for (const near of neighbours.get(id) ?? []) {
      const node = byId.get(near)
      if (node && node.kind !== 'surface') matches.add(near)
    }
  }
  state.matches = matches
  const hitSurfaces = [...matches].map((id) => byId.get(id)).filter((node) => node?.kind === 'surface')
  searchCount.textContent = `${hitSurfaces.length} of ${surfaces.length}`
  paint()
  if (hitSurfaces.length) {
    const centre = hitSurfaces.reduce(
      (acc, node) => ({ x: acc.x + node.x / hitSurfaces.length, y: acc.y + node.y / hitSurfaces.length, z: acc.z + node.z / hitSurfaces.length }),
      { x: 0, y: 0, z: 0 },
    )
    const spread = Math.max(
      420,
      ...hitSurfaces.map((node) => Math.hypot(node.x - centre.x, node.y - centre.y, node.z - centre.z)),
    )
    flyTo(centre, spread * 2.1)
  }
}

searchInput.addEventListener('input', runSearch)

// ---------------------------------------------------------------------- panels ---
const groupList = document.getElementById('groups')
groupList.innerHTML = meta.groups
  .map(
    (group) =>
      `<li><button type="button" data-goto="group:${escapeHtml(group.name)}"><i style="background:#${new THREE.Color(
        KIND_COLOR.group,
      ).getHexString()}"></i>${escapeHtml(group.name)}<b>${group.count}</b></button></li>`,
  )
  .join('')
groupList.addEventListener('click', (event) => {
  const target = event.target.closest('[data-goto]')
  if (!target) return
  const node = byId.get(target.dataset.goto)
  if (!node) return
  state.selected = node.id
  controls.autoRotate = false
  showCard(node, true)
  paint()
  flyTo(node)
})

for (const input of document.querySelectorAll('[data-layer]')) {
  input.checked = LAYERS[input.dataset.layer] !== false
  input.addEventListener('change', () => {
    LAYERS[input.dataset.layer] = input.checked
    applyEdgeLayers()
    paint()
  })
}

document.getElementById('reset').addEventListener('click', resetView)
const spinToggle = document.getElementById('spin')
spinToggle.checked = controls.autoRotate
spinToggle.addEventListener('change', () => {
  controls.autoRotate = spinToggle.checked
})

const about = document.getElementById('about-panel')
document.getElementById('about-toggle').addEventListener('click', () => {
  about.hidden = !about.hidden
})
about.addEventListener('click', (event) => {
  if (event.target.matches('[data-close]')) about.hidden = true
})

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== searchInput) {
    event.preventDefault()
    searchInput.focus()
    searchInput.select()
  }
  if (event.key === 'Escape') {
    if (document.activeElement === searchInput) {
      searchInput.blur()
      return
    }
    if (!about.hidden) {
      about.hidden = true
      return
    }
    resetView()
  }
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ------------------------------------------------------------------------ loop ---
let lastHover = null
function frame(now) {
  stepFlight(now)
  controls.update()

  if (pointerInside && !flight) {
    const node = pick()
    const id = node?.id ?? null
    if (id !== lastHover) {
      lastHover = id
      state.hover = id
      paint()
      if (node) showCard(node, card.dataset.pinned === 'true')
      else hideCard()
      renderer.domElement.style.cursor = node ? 'pointer' : 'grab'
    }
  }

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

applyEdgeLayers()
paint()
searchCount.textContent = `${surfaces.length} surfaces`
requestAnimationFrame(frame)
loadThumbnails()

// Expose a small handle so the page can be checked without guessing at internals.
window.atlas = {
  THREE,
  gpu: () => {
    const gl = renderer.getContext()
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  },
  scene,
  renderer,
  sprites,
  nodes,
  links,
  state,
  camera,
  controls,
  pickAt(x, y) {
    pointer.x = (x / window.innerWidth) * 2 - 1
    pointer.y = -(y / window.innerHeight) * 2 + 1
    return pick()
  },
  screenPos(id) {
    const node = byId.get(id)
    if (!node) return null
    const point = new THREE.Vector3(node.x, node.y, node.z).project(camera)
    return {
      x: Math.round((point.x * 0.5 + 0.5) * window.innerWidth),
      y: Math.round((-point.y * 0.5 + 0.5) * window.innerHeight),
    }
  },
  dimmed: () => sprites.filter((sprite) => sprite.material.opacity < 0.3).length,
  select(id) {
    const node = byId.get(id)
    if (!node) return null
    state.selected = id
    showCard(node, true)
    paint()
    flyTo(node)
    return node
  },
  thumbsLoaded: () => thumbsLoadedCount,
  reset: resetView,
}
