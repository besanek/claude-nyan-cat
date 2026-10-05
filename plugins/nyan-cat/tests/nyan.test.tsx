import { expect, mock, test } from 'claude-code/testing'

const band = (isWorking: boolean) => ({
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking,
    maxRows: 12,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  } as never,
})

test('nyan cat flies over the prompt while Claude works', async $ => {
  const ui = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  expect(await ui.find({ key: 'nyan' })).toBeDefined()
  await ui.unmount()
})

test('the band stays empty while Claude is idle', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(false) })
  expect(await ui.find({ key: 'nyan' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('other surfaces get a text fallback', async $ => {
  const ui = await $.ui.mount({ plugin: 'nyan-cat', surface: 'desktop', ...band(true) })
  expect(await ui.find({ type: 'Text', text: /nyan/ })).toBeDefined()
  await ui.unmount()
})

const engineBand = (on: Parameters<Parameters<typeof test>[1]>[1]) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

test('/nyan off hides the cat and /nyan on brings it back', async ($, on) => {
  engineBand(on)
  mock.store(on)
  const off = await $.command.run({ command: 'nyan', args: 'off' })
  expect(off.text).toContain('off')

  const hidden = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  expect(await hidden.find({ key: 'nyan' })).toBeUndefined()
  await hidden.unmount()

  await $.command.run({ command: 'nyan', args: 'on' })
  const shown = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  expect(await shown.find({ key: 'nyan' })).toBeDefined()
  await shown.unmount()
})

test('/nyan small and big switch the band height', async ($, on) => {
  mock.store(on)
  await $.command.run({ command: 'nyan', args: 'small' })
  const small = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  expect((await small.find({ key: 'nyan' }))?.props).toMatchObject({ rows: 4 })
  await small.unmount()

  await $.command.run({ command: 'nyan', args: 'big' })
  const big = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  expect((await big.find({ key: 'nyan' }))?.props).toMatchObject({ rows: 9 })
  await big.unmount()
})

test('/nyan with nonsense prints usage', async $ => {
  const result = await $.command.run({ command: 'nyan', args: 'purr' })
  expect(result.text).toContain('Usage')
})

test('when the turn ends the cat flies off, then the band clears', async ($, on) => {
  engineBand(on)
  mock.store(on)
  const clock = mock.clock(on)
  on('session.start', ($, e) => e)
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  await ui.redraw(band(false).props)
  expect(await ui.find({ key: 'nyan' })).toBeDefined()

  await clock.advance(3000)
  expect(await ui.find({ key: 'nyan' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

const FROSTING = 0xff99ff

const colorsIn = (cells: string) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const words = new Uint32Array(bytes.buffer)
  return new Set(words.filter((_, i) => i % 3 !== 0))
}

test('a new turn starts with the cat still off screen to the left', async $ => {
  const ui = await $.ui.mount({ plugin: 'nyan-cat', surface: 'terminal', ...band(true) })
  const raster = await ui.find({ key: 'nyan' })
  expect(colorsIn(String(raster?.props.cells)).has(FROSTING)).toBe(false)
  await ui.unmount()
})
