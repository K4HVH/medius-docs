// The address this tab loaded, where the server answered with its 404 page (the prerender marks that
// page). An item's address the server knew nothing of keeps the 404 page in the app.
export const lostPath: string | null =
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-not-found') ? location.pathname : null;
