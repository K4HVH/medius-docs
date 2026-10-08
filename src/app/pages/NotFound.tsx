import { A } from '@solidjs/router';
import { Card, CardHeader } from '../../components/surfaces/Card';
import '../../styles/docs.css';

const NotFound = () => (
  <div id="not-found" data-search-target>
    <Card>
      <CardHeader title="Page not found" subtitle="No page at this address" />
      <ul>
        <li><A href="/">Home</A></li>
        <li><A href="/native">Native API</A></li>
        <li><A href="/library">Rust Library</A></li>
        <li><A href="/bindings">Bindings</A></li>
        <li><A href="/dashboard/setup">Install Medius</A></li>
      </ul>
    </Card>
  </div>
);

export default NotFound;
