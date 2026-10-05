import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { NyanSize } from '../types'

// Two pixel rows per cell: '▀' paints the top pixel as foreground, the bottom as background.
const HALF_BLOCK = 0x2580
const MAX_COLUMNS = 72
const FRAME_MS = 90
const KEY = 'nyan'
const COMMAND = 'nyan'

const SKY = 0x0b2a5c
const FUR = 0x9a9a9a
const STAR = 0xffffff
const STAR_GLOW = 0x5f78a8
const RAINBOW = [0xff1a1a, 0xff9900, 0xffee00, 0x33ee11, 0x0099ff, 0x6633ff]

const PALETTE: Record<string, number> = {
  K: 0x111111, // outline, pupils, mouth
  T: 0xffcc99, // pop-tart crust
  P: 0xff99ff, // frosting
  D: 0xff3399, // sprinkles
  G: FUR,
  W: 0xffffff, // eye glint
  R: 0xff8fab, // cheeks
}

const size = atom({ plugin: 'nyan-cat', key: 'size' } as const, 'big')
const isOn = atom({ plugin: 'nyan-cat', key: 'isOn' } as const, true)

type Layer = { x: number; y: number; lines: string[] }

type Sprite = {
  pixelRows: number
  width: number
  bandHeight: number
  body: Layer[]
  legs: Layer[]
  tails: [number, number][][]
  stars: [number, number][]
}

const BIG_BODY: Layer = {
  x: 0,
  y: 0,
  lines: [
    '..KKKKKKKKKKKKKK..',
    '.KTTTTTTTTTTTTTTK.',
    'KTTTPPPPPPPPPPTTTK',
    'KTPPPPPPDPPDPPPPTK',
    'KTPPDPPPPPPPPPPPTK',
    'KTPPPPPPPPPPPDPPTK',
    'KTPPPPPDPPPPPPPPTK',
    'KTPPPPPPPPPPPPPPTK',
    'KTPDPPPPPPDPPPPPTK',
    'KTPPPPPDPPPPPPPPTK',
    'KTPPPPPPPPPPPDPPTK',
    'KTPPDPPPPPPPPPPPTK',
    'KTTTPPPPPPPPPPTTTK',
    '.KTTTTTTTTTTTTTTK.',
    '..KKKKKKKKKKKKKK..',
  ],
}

// Pointed ears, eyes with a glint, a nose between them, wide smile and blush at the edges.
const BIG_HEAD: Layer = {
  x: 9,
  y: 3,
  lines: [
    '.KK........KK.',
    '.KGK......KGK.',
    '.KGGK....KGGK.',
    '.KGGGKKKKGGGK.',
    'KGGGGGGGGGGGGK',
    'KGGGWKGGGWKGGK',
    'KGGGKKGKGKKGGK',
    'KRRGGGGGGGGRRK',
    'KRRGKGGKGGKRRK',
    'KGGGGKKKKKGGGK',
    '.KGGGGGGGGGGK.',
    '..KKKKKKKKKK..',
  ],
}

// Two poses, stepped each frame: back paws under the crust, front paws under the head.
const BIG_LEGS: Layer[] = [
  { x: 0, y: 15, lines: ['.KGK.KGK...KGK....KGK.', '.KK..KK....KK.....KK..'] },
  { x: 0, y: 15, lines: ['KGK.KGK...KGK....KGK..', 'KK..KK....KK.....KK...'] },
]

// Tail pixels left of the crust, as offsets from the cat's corner; it wags between two poses.
const BIG_TAILS: [number, number][][] = [
  [[-1, 7], [-2, 7], [-3, 6], [-4, 6], [-5, 5], [-1, 8], [-2, 8], [-3, 7], [-4, 7], [-5, 6]],
  [[-1, 8], [-2, 8], [-3, 9], [-4, 9], [-5, 10], [-1, 9], [-2, 9], [-3, 10], [-4, 10], [-5, 11]],
]

const BIG_STARS: [number, number][] = [
  [5, 1],
  [17, 15],
  [29, 5],
  [41, 13],
  [53, 2],
  [64, 10],
  [11, 8],
  [47, 16],
  [59, 6],
]

const BIG: Sprite = {
  pixelRows: 18,
  width: 23,
  bandHeight: 2,
  body: [BIG_BODY, BIG_HEAD],
  legs: BIG_LEGS,
  tails: BIG_TAILS,
  stars: BIG_STARS,
}

// The first, four-row cat: no outline, one pixel per rainbow band.
const SMALL: Sprite = {
  pixelRows: 8,
  width: 13,
  bandHeight: 1,
  body: [
    {
      x: 0,
      y: 0,
      lines: [
        'TTTTTTTTT....',
        'TPDPPPPPTG..G',
        'TPPPPDPPGGGGG',
        'TPPDPPPGGKGKG',
        'TPPPPPPGRGGGR',
        'TTTTTTTTGGGG.',
      ],
    },
  ],
  legs: [
    { x: 0, y: 6, lines: ['.G.G...G.G...'] },
    { x: 0, y: 6, lines: ['G.G...G.G....'] },
  ],
  tails: [
    [[-1, 3], [-2, 3], [-3, 2], [-4, 2]],
    [[-1, 4], [-2, 4], [-3, 5], [-4, 5]],
  ],
  stars: [[5, 0], [17, 7], [29, 2], [41, 6], [53, 1], [64, 5], [11, 4], [47, 3]],
}

const SPRITES: Record<NyanSize, Sprite> = { big: BIG, small: SMALL }

function frame(tick: number, columns: number, sprite: Sprite): string {
  const { pixelRows, bandHeight } = sprite
  const pixels = new Uint32Array(columns * pixelRows).fill(SKY)
  const put = (x: number, y: number, color: number) => {
    if (x >= 0 && x < columns && y >= 0 && y < pixelRows) pixels[y * columns + x] = color
  }

  // Stars drift at half the frame rate and now and then glint with a faint cross.
  for (const [sx, sy] of sprite.stars) {
    const x = (((sx - Math.floor(tick / 2)) % columns) + columns) % columns
    put(x, sy, STAR)
    if ((Math.floor(tick / 2) + sx) % 10 === 0) {
      put(x - 1, sy, STAR_GLOW)
      put(x + 1, sy, STAR_GLOW)
      put(x, sy - 1, STAR_GLOW)
      put(x, sy + 1, STAR_GLOW)
    }
  }

  const catX = Math.max(0, Math.floor(columns * 0.65) - sprite.width)
  const bob = tick % 4 < 2 ? 0 : 1

  for (let x = 0; x < catX; x++) {
    const wave = Math.floor((x + tick) / 4) % 2
    RAINBOW.forEach((color, i) => {
      for (let dy = 0; dy < bandHeight; dy++) put(x, 1 + i * bandHeight + dy + wave, color)
    })
  }

  const tail = sprite.tails[tick % 2] ?? []
  for (const [dx, dy] of tail) put(catX + dx, dy + bob, FUR)

  const layers = [sprite.legs[tick % 2], ...sprite.body]
  for (const layer of layers) {
    if (layer === undefined) continue
    layer.lines.forEach((line, dy) => {
      for (let dx = 0; dx < line.length; dx++) {
        const color = PALETTE[line.charAt(dx)]
        if (color !== undefined) put(catX + layer.x + dx, layer.y + dy + bob, color)
      }
    })
  }

  const rows = pixelRows / 2
  const cells = new Uint32Array(columns * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const at = (row * columns + x) * 3
      cells[at] = HALF_BLOCK
      cells[at + 1] = pixels[row * 2 * columns + x] ?? SKY
      cells[at + 2] = pixels[(row * 2 + 1) * columns + x] ?? SKY
    }
  }

  return new Uint8Array(cells.buffer).toBase64()
}

async function save($: EngineInterface, change: { size?: NyanSize; isOn?: boolean }) {
  const { size: nextSize, isOn: nextIsOn } = change
  if (nextSize !== undefined) {
    await update($, size, () => nextSize)
    await $.store.set('size', nextSize)
  }
  if (nextIsOn !== undefined) {
    await update($, isOn, () => nextIsOn)
    await $.store.set('isOn', nextIsOn)
  }
}

const USAGE = 'Použití: /nyan big | small | off | on (bez argumentu přepne zapnuto/vypnuto)'

export const register: Register = on => {
  let tick = 0
  let mounted: { requestId: string; columns: number; sprite: Sprite } | null = null

  on('session.start', async ($, e, next) => {
    const storedSize = await $.store.get('size')
    const storedOn = await $.store.get('isOn')
    if (storedSize === 'big' || storedSize === 'small') await update($, size, () => storedSize)
    if (typeof storedOn === 'boolean') await update($, isOn, () => storedOn)

    await $.command.register({
      name: COMMAND,
      description: 'Nyan Cat: změní velikost nebo ho vypne',
      argumentHint: 'big | small | off | on',
      immediate: true,
    })

    $.clock.every(FRAME_MS, () => {
      if (mounted === null) return
      tick += 1
      const { requestId, columns, sprite } = mounted
      void $.ui.blit({ requestId, key: KEY, cells: frame(tick, columns, sprite) })
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const wasOn = await read($, isOn)

    if (arg === 'big' || arg === 'small') {
      await save($, { size: arg, isOn: true })
      return { text: arg === 'big' ? 'velká kočka (9 řádků)' : 'malá kočka (4 řádky)' }
    }
    if (arg === 'off' || (arg === '' && wasOn)) {
      await save($, { isOn: false })
      return { text: 'vypnuto, zapneš přes /nyan on' }
    }
    if (arg === 'on' || arg === '') {
      await save($, { isOn: true })
      return { text: `zapnuto (${(await read($, size)) === 'big' ? 'velká' : 'malá'} kočka)` }
    }

    return { text: USAGE }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const sprite = SPRITES[await read($, size)]
    const rows = sprite.pixelRows / 2
    const isShown = (await read($, isOn)) && e.props.isWorking && !e.props.hasSurvey

    if (!isShown || e.props.maxRows < rows) {
      mounted = null
      return next(e)
    }

    if (e.surface !== 'terminal') {
      mounted = null
      const { Text } = $.ui.resolve(e)
      return <Text color="magenta">🌈🌈🌈 nyan nyan nyan 🐱</Text>
    }

    const columns = Math.min(MAX_COLUMNS, e.props.bodyColumns)
    const { Raster } = $.ui.resolve(e)
    mounted = { requestId: e.requestId, columns, sprite }

    return <Raster key={KEY} columns={columns} rows={rows} cells={frame(tick, columns, sprite)} />
  })
}
