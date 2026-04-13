import type { UISetup } from '@/types/ui'
import { button, row } from '@/types/ui'

const ioModule: UISetup['modules'][0] = {
  name: 'IO',
  value: 'io',
  icon: 'i-hugeicons:file-export',
  operations: [
    {
      name: 'Import',
      actions: [row([button({ id: 'io-open', icon: 'i-hugeicons:file-import', label: 'Open File' })])],
    },
    {
      name: 'Export',
      actions: [
        row([
          button({ id: 'io-export-stl', icon: 'i-hugeicons:file-export', label: 'Export STL' }),
          button({ id: 'io-export-obj', icon: 'i-hugeicons:file-export', label: 'Export OBJ' }),
        ]),
      ],
    },
  ],
  views: [],
  toolbar: [],
  properties: [],
}

export default ioModule
