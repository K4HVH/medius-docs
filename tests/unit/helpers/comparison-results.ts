// A small results file in format 2 that passes the check: the base the comparison tests break or render.
export const ref = (file: string, ptr: string, unit?: string) => (unit ? { file, ptr, unit } : { file, ptr });

export const GOOD = {
  format: 2,
  firmware: { stock: 'V4.094', medius: '3.4.6' },
  rig: 'Two boxes side by side, each fed by a USB device emulator',
  layers: { wire: 'USB packets on the bus, read with usbmon', evdev: "The kernel's input event times" },
  categories: [
    {
      id: 'injection',
      title: 'Injected motion',
      sections: [
        {
          id: 'move-latency',
          title: 'Move latency',
          about: 'One move, timed from the command to the report that completes it.',
          tables: [
            {
              kind: 'measure', label: 'Latency', key: 'Mouse', unit: 'ms', better: 'lower', layer: 'wire', n: '200 moves', hubs: 'both',
              commands: { stock: 'km.move', medius: 'MOVE' },
              rows: [
                {
                  id: 'move-rest-1', label: 'At rest, 1 count',
                  stock: { lo: 64.1, hi: 64.3, src: [ref('lat_stock_gl.json', '/cells/0/p50', 'us'), ref('lat_stock_via.json', '/cells/0/p50', 'us')] },
                  medius: { lo: 1.01, hi: 1.02, src: [ref('lat_medius.json', '/cells/0/p50', 'us'), ref('lat_medius_gl.json', '/cells/0/p50', 'us')] },
                },
                {
                  id: 'move-rest-50', label: 'At rest, 50 counts',
                  stock: { value: 64.2, src: [ref('lat_stock_gl.json', '/cells/2/p50', 'us')] },
                  medius: { value: 0.98, src: [ref('lat_medius.json', '/cells/2/p50', 'us')] },
                },
              ],
            },
            {
              kind: 'measure', label: 'Reports per move', key: 'Mouse', unit: 'reports',
              rows: [
                {
                  id: 'move-rest-reports', label: 'At rest, 50 counts',
                  stock: { value: 43, src: [ref('lat_stock_gl.json', '/cells/1/reports')] },
                  medius: { value: 1, src: [ref('lat_medius.json', '/cells/1/reports')] },
                },
              ],
            },
            {
              kind: 'measure', label: 'Moves delivered', key: 'Device', unit: 'tries', better: 'higher',
              rows: [
                {
                  id: 'move-cold', label: 'Fresh clone', note: 'Device never reports',
                  stock: { value: 0, of: 3, src: [ref('cold.json', '/stock/ok')] },
                  medius: { value: 3, of: 3, src: [ref('cold.json', '/medius/ok')] },
                },
              ],
            },
          ],
        },
        {
          id: 'malformed',
          title: 'Malformed input',
          about: 'Broken input, then a valid move.',
          tables: [
            {
              kind: 'outcome', label: 'Next move', key: 'Input', outcomes: ['Arrives', 'Lost'],
              rows: [
                {
                  id: 'cut-off', label: 'Command cut off',
                  stock: { is: 'Lost', src: [ref('bad_stock.json', '/cut/arrived')] },
                  medius: { is: 'Arrives', src: [ref('bad_medius.json', '/cut/arrived')] },
                },
              ],
            },
          ],
        },
        {
          id: 'exit',
          title: 'Program exit',
          about: 'A program holds a button, then closes the port.',
          tables: [
            {
              kind: 'outcome', label: 'Button after exit', key: 'Input', outcomes: ['Held', 'Released'], ranked: false,
              rows: [
                {
                  id: 'held-button', label: 'Button',
                  stock: { is: 'Held', src: [ref('exit.json', '/stock')] },
                  medius: { is: 'Released', src: [ref('exit.json', '/medius')] },
                },
              ],
            },
          ],
        },
        {
          id: 'commands',
          title: 'Motion commands',
          about: 'Commands for injected motion.',
          tables: [
            {
              kind: 'feature', label: 'Commands', key: 'Feature',
              rows: [
                { id: 'absolute-move', label: 'Absolute move', stock: 'km.moveto', medius: null },
                { id: 'relative-move', label: 'Relative move', stock: 'km.move', medius: 'MOVE' },
              ],
            },
          ],
        },
        {
          id: 'smoothing',
          title: 'Smoothing settings',
          about: 'Each setting alone.',
          tables: [
            {
              kind: 'settings', label: 'Latency', key: 'Setting', layer: 'wire',
              columns: [{ id: 'rest-1', label: '1 count, at rest', unit: 'ms', better: 'lower' }],
              rows: [
                {
                  id: 'stock-auto', box: 'stock', label: 'Interpolation AUTO', default: true,
                  values: { 'rest-1': { value: 64.2, src: [ref('shape_stock.json', '/auto/p50', 'us')] } },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  defects: [{ id: 'fresh-clone', box: 'stock', text: 'No injection until the device has reported.', rows: ['move-cold'] }],
  pending: [{ id: 'raw-move', category: 'injection', test: 'Stock RAW_MOVE', needs: 'A run on the stock box' }],
};
