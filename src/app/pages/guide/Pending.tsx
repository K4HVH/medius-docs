import { useLocation } from '@solidjs/router';
import { routeFor } from '../../routes';

// Stands in for the Guide pages until they are written.
export default function GuidePending() {
  const location = useLocation();
  return (
    <div id="page" data-search-target>
      <h1>{routeFor(location.pathname)?.title}</h1>
    </div>
  );
}
