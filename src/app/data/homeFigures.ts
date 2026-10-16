export interface HomeFigures {
  firmware?: string;
  devices?: number;
  boxes?: number;
  discord?: number;
}

// The text a figure's cell shows, the same in the server's fill and on the page.
export const figureText = (key: keyof HomeFigures, value: string | number): string =>
  typeof value === 'string' ? value : key === 'discord' ? `${value.toLocaleString('en-US')} members` : value.toLocaleString('en-US');
