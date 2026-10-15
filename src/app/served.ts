// The address this tab loaded, if the server answered it with the 404 page (the prerender marks that page).
// For an address inside a page that the server didn't know, the app keeps showing the 404 page.
export const lostPath: string | null =
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-not-found') ? location.pathname : null;
