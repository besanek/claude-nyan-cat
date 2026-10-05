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
