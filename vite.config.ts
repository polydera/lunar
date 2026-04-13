import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ui from '@nuxt/ui/vite'
import { mcpWebSocket } from './mcp/vite-plugin'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    mcpWebSocket(),
    // vueDevTools(),
    ui({
      router: false,
      colorMode: false,
      autoImport: {
        imports: ['vue'],
        dirs: ['./src/composables/**', './src/components/**'],
      },
      ui: {
        colors: {
          primary: 'teal',
          secondary: 'orange',
          neutral: 'neutral',
        },
        button: {
          compoundVariants: [
            {
              color: 'neutral',
              variant: 'ghost',
              class: 'text-[var(--ln-selection-text)] hover:bg-[var(--ln-hover)] active:bg-[var(--ln-active)]',
            },
            {
              color: 'neutral',
              variant: 'solid',
              class: 'text-white bg-primary/30 hover:bg-primary/40 active:bg-primary/50',
            },
          ],
        },
        switch: {
          slots: {
            base: 'data-[state=unchecked]:bg-[var(--ui-border)]',
          },
        },
        slider: {
          slots: {
            root: 'w-full',
            track: 'bg-[var(--ln-accent-dim)]',
          },
        },
        select: {
          slots: {
            base: 'w-full ring-0! focus:ring-0! ring-transparent! focus:ring-transparent!',
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl',
            item: 'text-highlighted data-highlighted:not-data-disabled:before:bg-[var(--ln-selection)]',
          },
          variants: {
            variant: {
              outline:
                'bg-[var(--ln-muted)] ring-0! hover:bg-[var(--ln-hover)]',
            },
          },
        },
        selectMenu: {
          slots: {
            base: 'w-full ring-0! focus:ring-0! ring-transparent! focus:ring-transparent!',
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl',
            item: 'text-highlighted data-highlighted:not-data-disabled:before:bg-[var(--ln-selection)] items-center',
          },
          variants: {
            variant: {
              outline:
                'bg-[var(--ln-muted)] ring-0! hover:bg-[var(--ln-hover)]',
            },
          },
        },
        modal: {
          slots: {
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl divide-[var(--ln-panel-border)]',
          },
          variants: {
            fullscreen: {
              false: {
                content: 'ring-default/50',
              },
            },
          },
        },
        popover: {
          slots: {
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl ring-[var(--ln-panel-border)]',
          },
        },
        tooltip: {
          slots: {
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl text-highlighted ring-[var(--ln-panel-border)]',
          },
        },
        kbd: {
          compoundVariants: [
            {
              color: 'neutral',
              variant: 'outline',
              class: 'bg-neutral/20',
            },
          ],
        },
        tree: {
          variants: {
            selected: {
              true: {
                link: 'before:bg-[var(--ln-selection)]',
              },
            },
          },
          compoundVariants: [
            {
              color: 'primary',
              selected: true,
              class: {
                link: 'text-[var(--ln-selection-text)]',
              },
            },
            {
              selected: false,
              disabled: false,
              class: {
                link: ['hover:before:bg-[var(--ln-hover)]'],
              },
            },
          ],
        },
        commandPalette: {
          slots: {
            root: 'divide-[var(--ln-panel-border)]',
            // Category header — "Inspect" / "Cut" / "Style" — pops in teal.
            label: 'text-[var(--ln-accent)] uppercase tracking-wider font-bold',
            itemLabel: 'text-highlighted',
            itemLabelSuffix: 'text-default/70',
          },
          variants: {
            active: {
              false: {
                // Highlighted row uses the brand teal selection background
                // instead of the neutral hover tint — it's "where you are",
                // not just "what you're over".
                item: 'data-highlighted:not-data-disabled:before:bg-[var(--ln-selection)]',
                // Leading icons wear teal at 60% opacity, brighten to 100%
                // when the row is highlighted. Matches title bar / mode popup.
                itemLeadingIcon:
                  'text-[var(--ln-accent)] opacity-60 group-data-highlighted:not-group-data-disabled:opacity-100',
              },
            },
            virtualize: {
              false: {
                viewport: 'divide-[var(--ln-panel-border)]',
              },
            },
          },
        },
        dropdownMenu: {
          slots: {
            content: 'bg-[var(--ln-panel)] backdrop-blur-xl divide-[var(--ln-panel-border)]',
          },
          variants: {
            active: {
              false: {
                item: 'data-highlighted:before:bg-[var(--ln-hover)] data-[state=open]:before:bg-elevated/20',
                itemLeadingIcon: 'text-default/70',
              },
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['.'],
    },
  },
  optimizeDeps: {
    exclude: ['@polydera/trueform'],
    entries: [],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      exclude: [/trueform/],
    },
  },
  assetsInclude: ['**/*.wasm'],
})
