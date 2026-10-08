import { PageHeader } from '../shell/PageHeader';
import { DocSection } from '../shell/DocSection';
import { IndexRow } from '../shell/IndexRow';

const NotFound = () => (
  <>
    <PageHeader lead="No page at this address.">
      <span id="not-found" data-search-target />
    </PageHeader>
    <DocSection title="Pages">
      <IndexRow href="/guide" title="Install" tag="Flash a box from the browser" />
      <IndexRow href="/native" title="Native API" tag="The control protocol" />
      <IndexRow href="/library" title="Rust library" tag="The official client" />
      <IndexRow href="/dashboard" title="Dashboard" tag="Update and configure a box" />
      <IndexRow href="/" title="Home" />
    </DocSection>
  </>
);

export default NotFound;
