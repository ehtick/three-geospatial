import type { Preview } from '@storybook/react-vite'
import { ConfigProvider, theme } from 'antd'
import { debounce } from 'lodash'
import { STORY_ARGS_UPDATED } from 'storybook/internal/core-events'
import { Preview as PreviewClass } from 'storybook/preview-api'
import { themes } from 'storybook/theming'

import { docs } from './theme'

import './style.css'

const DEBOUNCED = Symbol('DEBOUNCED')

const debouncedChannelEmit = debounce((channel, event, ...args) => {
  channel.emit(event, ...args)
}, 200)

// WORKAROUND: Prevent Storybook from replacing URL too frequently, which has
// a performance ramification and triggers security errors on Safari.
const onUpdateArgs = PreviewClass.prototype.onUpdateArgs
PreviewClass.prototype.onUpdateArgs = async function (...args) {
  if (this[DEBOUNCED] !== true) {
    const channel = this.channel
    this.channel = {
      emit: (event, ...args) => {
        if (event === STORY_ARGS_UPDATED) {
          debouncedChannelEmit(channel, event, ...args)
        } else {
          channel.emit(event, ...args)
        }
      }
    }
    this[DEBOUNCED] = true
  }
  await onUpdateArgs.apply(this, args)
}

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      disableSaveFromUI: true
    },
    docs: {
      theme: docs
    },
    options: {
      // WORKAROUND: Cannot annotate type in storySort():
      // {
      //   type: string  // e.g. 'docs' | 'story'
      //   id: string    // e.g. 'package-category--story-name'
      //   name: string  // e.g. 'Story Name'
      //   title: string // e.g. 'package/Category'
      //   tags: string[]
      // }
      storySort: (a, b) => {
        if (a.type !== b.type) {
          return a.type === 'docs' ? -1 : 1 // Bring docs first
        }
        const pathA = a.title.split('/')
        const pathB = b.title.split('/')
        const depthA = pathA.length + +(pathA[pathA.length - 1] !== a.name)
        const depthB = pathB.length + +(pathB[pathB.length - 1] !== b.name)
        if (depthA !== depthB) {
          return depthA - depthB // Bring shallow stories first
        }
        const orderA = +(
          a.tags.find(tag => tag.startsWith('order:'))?.split(':')[1] ?? 0
        )
        const orderB = +(
          b.tags.find(tag => tag.startsWith('order:'))?.split(':')[1] ?? 0
        )
        if (orderA !== orderB) {
          return orderA - orderB
        }
        return a.title.localeCompare(b.title, undefined, { numeric: true })
      }
    }
  },
  initialGlobals: {
    backgrounds: {
      value: 'dark'
    }
  },
  decorators: [
    Story => (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            fontFamily: `Inter, ${themes.normal.fontBase}`
          }
        }}
      >
        <Story />
      </ConfigProvider>
    )
  ]
}

export default preview
