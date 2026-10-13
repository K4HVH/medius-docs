import type { Component, JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Router, Route, type RouteSectionProps } from '@solidjs/router';
import { NotificationProvider } from '../components/feedback/Notification';
import RouteMeta from './RouteMeta';
import { useLeaveFade } from './shell/leave';
import { SiteNav } from './shell/SiteNav';
import { GridBackground } from '../components/surfaces/GridBackground';
import { useScrollPlace } from './shell/scrollPlace';
import { useNativeFlash } from './pages/dashboard/context';
import DocsLayout from './pages/DocsLayout';
import { NotFoundPage, PAGES, pageAt, pageLoaded, preloadPage } from './lazyPages';
import { BoxScope, DashboardProvider } from './pages/dashboard/context';

const RootLayout: Component<{ children?: JSX.Element }> = (props) => {
  const native = useNativeFlash();
  useScrollPlace();
  useLeaveFade(native.running, { loaded: pageLoaded, load: preloadPage, whole: (href) => window.location.assign(href) });
  return (
    <>
      <RouteMeta />
      <GridBackground gridSize={10} />
      <SiteNav disabled={native.running()} />
      {props.children}
    </>
  );
};

// A page and the places on it (`/page/id`, routes.ts addressFor) are one route, so moving between them keeps
// the page mounted; an address the server answered with the 404 page shows that page.
const AtPage: Component<RouteSectionProps> = (props) => <Dynamic component={pageAt(props.location.pathname)} {...props} />;

const App: Component = () => {
  return (
      <NotificationProvider>
      <DashboardProvider>
        <Router root={RootLayout}>
        <Route path="/" component={PAGES['/']} />
        <Route path="/" component={DocsLayout}>
          <Route path="/guide/:place?" component={AtPage} />
          <Route path="/guide/compatibility/:place?" component={AtPage} />
          <Route path="/guide/options/:place?" component={AtPage} />
          <Route path="/guide/privacy/:place?" component={AtPage} />
          <Route path="/guide/help/:place?" component={AtPage} />
          <Route path="/native/:place?" component={AtPage} />
          <Route path="/native/quickstart/:place?" component={AtPage} />
          <Route path="/native/architecture/:place?" component={AtPage} />
          <Route path="/native/hardware/:place?" component={AtPage} />
          <Route path="/native/transport/:place?" component={AtPage} />
          <Route path="/native/connection/:place?" component={AtPage} />
          <Route path="/native/frame/:place?" component={AtPage} />
          <Route path="/native/injection/:place?" component={AtPage} />
          <Route path="/native/commands/inject/:place?" component={AtPage} />
          <Route path="/native/commands/move/:place?" component={AtPage} />
          <Route path="/native/commands/requests/:place?" component={AtPage} />
          <Route path="/native/commands/admin/:place?" component={AtPage} />
          <Route path="/native/commands/update/:place?" component={AtPage} />
          <Route path="/native/commands/led/:place?" component={AtPage} />
          <Route path="/native/commands/lock/:place?" component={AtPage} />
          <Route path="/native/commands/catch/:place?" component={AtPage} />
          <Route path="/native/commands/transform/:place?" component={AtPage} />
          <Route path="/native/commands/option/:place?" component={AtPage} />
          <Route path="/native/commands/clip/:place?" component={AtPage} />
          <Route path="/native/commands/raw/:place?" component={AtPage} />
          <Route path="/native/commands/transfer/:place?" component={AtPage} />
          <Route path="/native/commands/rewrite/:place?" component={AtPage} />
          <Route path="/native/commands/patch/:place?" component={AtPage} />
          <Route path="/native/commands/usage/:place?" component={AtPage} />
          <Route path="/native/flashing/:place?" component={AtPage} />
          <Route path="/native/troubleshooting/:place?" component={AtPage} />
          <Route path="/ai/:place?" component={AtPage} />
          <Route path="/library/:place?" component={AtPage} />
          <Route path="/library/connection/:place?" component={AtPage} />
          <Route path="/library/discovery/:place?" component={AtPage} />
          <Route path="/library/inject/:place?" component={AtPage} />
          <Route path="/library/move/:place?" component={AtPage} />
          <Route path="/library/requests/:place?" component={AtPage} />
          <Route path="/library/admin/:place?" component={AtPage} />
          <Route path="/library/update/:place?" component={AtPage} />
          <Route path="/library/led/:place?" component={AtPage} />
          <Route path="/library/lock/:place?" component={AtPage} />
          <Route path="/library/catch/:place?" component={AtPage} />
          <Route path="/library/transform/:place?" component={AtPage} />
          <Route path="/library/options/:place?" component={AtPage} />
          <Route path="/library/clip/:place?" component={AtPage} />
          <Route path="/library/lifecycle/:place?" component={AtPage} />
          <Route path="/library/diagnostics/:place?" component={AtPage} />
          <Route path="/library/features/async/:place?" component={AtPage} />
          <Route path="/library/features/mock/:place?" component={AtPage} />
          <Route path="/library/features/tracing/:place?" component={AtPage} />
          <Route path="/library/advanced/raw/:place?" component={AtPage} />
          <Route path="/library/advanced/transfer/:place?" component={AtPage} />
          <Route path="/library/advanced/rewrite/:place?" component={AtPage} />
          <Route path="/library/advanced/patch/:place?" component={AtPage} />
          <Route path="/library/guides/calls/:place?" component={AtPage} />
          <Route path="/library/guides/connection/:place?" component={AtPage} />
          <Route path="/library/guides/testing/:place?" component={AtPage} />
          <Route path="/library/types/:place?" component={AtPage} />
          <Route path="/library/types/enums/:place?" component={AtPage} />
          <Route path="/library/types/structs/:place?" component={AtPage} />
          <Route path="/library/types/frames/:place?" component={AtPage} />
          <Route path="/library/types/errors/:place?" component={AtPage} />
          <Route path="/bindings/:place?" component={AtPage} />
          <Route path="/bindings/c/:place?" component={AtPage} />
          <Route path="/bindings/c/quickstart/:place?" component={AtPage} />
          <Route path="/bindings/c/usage/:place?" component={AtPage} />
          <Route path="/bindings/c/streams/:place?" component={AtPage} />
          <Route path="/bindings/c/api/:place?" component={AtPage} />
          <Route path="/bindings/c/types/:place?" component={AtPage} />
          <Route path="/bindings/c/build/:place?" component={AtPage} />
          <Route path="/bindings/python/:place?" component={AtPage} />
          <Route path="/bindings/python/quickstart/:place?" component={AtPage} />
          <Route path="/bindings/python/usage/:place?" component={AtPage} />
          <Route path="/bindings/python/streams/:place?" component={AtPage} />
          <Route path="/bindings/python/api/:place?" component={AtPage} />
          <Route path="/bindings/python/types/:place?" component={AtPage} />
          <Route path="/bindings/python/build/:place?" component={AtPage} />
          <Route path="/" component={BoxScope}>
            <Route path="/dashboard/:place?" component={AtPage} />
            <Route path="/dashboard/control/:place?" component={AtPage} />
          </Route>
          <Route path="/dashboard/setup/:place?" component={AtPage} />
          <Route path="/dashboard/update/:place?" component={AtPage} />
          <Route path="/dashboard/flash/:place?" component={AtPage} />
          <Route path="/dashboard/changelog/:place?" component={AtPage} />
          <Route path="/dashboard/stats/:place?" component={AtPage} />
          <Route path="*" component={NotFoundPage} />
        </Route>
        </Router>
      </DashboardProvider>
      </NotificationProvider>
  );
};

export default App;
