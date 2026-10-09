import { useLocation, useNavigate } from '@solidjs/router';
import { MOVED } from '../site';
import { PageHeader } from '../shell/PageHeader';
import { DocSection } from '../shell/DocSection';
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
      <PageHeader id="not-found" lead="No page at this address" />
      <DocSection title="Pages">
        <IndexRow href="/guide" title="Install" tag="Flash a box from the browser" />
        <IndexRow href="/native" title="Native API" tag="The control protocol" />
        <IndexRow href="/library" title="Rust library" tag="The official client" />
        <IndexRow href="/dashboard" title="Dashboard" tag="Update and configure a box" />
        <IndexRow href="/" title="Home" />
      </DocSection>
    </>
  );
};

export default NotFound;
