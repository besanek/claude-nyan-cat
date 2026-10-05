export type NyanSize = 'big' | 'small'

declare module 'claude-code' {
  interface PluginState {
    'nyan-cat': { size: NyanSize; isOn: boolean }
  }
}
