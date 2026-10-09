import { useLocation, useNavigate } from '@solidjs/router';
import { MOVED } from '../site';
import { IndexRow } from '../shell/IndexRow';

const NotFound = () => {
  // A link to a page that moved follows it, as the server does with a 301.
  const location = useLocation();
  const navigate = useNavigate();
  const moved = MOVED[location.pathname.replace(/\/$/, '').toLowerCase()];
  // An anchor on the old address carries over unless the new one names its own, as a 301 does.
  if (moved) queueMicrotask(() => navigate(moved.includes('#') ? moved : moved + location.hash, { replace: true }));
  return (
    <>
      <div class="lost" id="not-found" data-search-target>
        <h1 class="label caps">Page not found</h1>
        <span class="num" aria-hidden="true">
          <span>404</span>
        </span>
        <div class="req">
          <span>GET</span>
          <span>{location.pathname}</span>
          <span class="x">404</span>
        </div>
      </div>
      <nav class="index" aria-label="Pages">
        <IndexRow href="/dashboard/setup" title="Install" tag="Flash a box from the browser" />
        <IndexRow href="/dashboard" title="Dashboard" tag="Update and configure a box" />
        <IndexRow href="/native" title="Developers" tag="Rust, Python, C, C++" />
      </nav>
    </>
  );
};

export default NotFound;
