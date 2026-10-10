import type { Component, JSX } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { NotificationProvider } from '../components/feedback/Notification';
import RouteMeta from './RouteMeta';
import { useLeaveFade } from './shell/leave';
import { useNativeFlash } from './pages/dashboard/context';
import DocsLayout from './pages/DocsLayout';
import { NotFoundPage, PAGES, pageLoaded, preloadPage } from './lazyPages';
import { BoxScope, DashboardProvider } from './pages/dashboard/context';

const RootLayout: Component<{ children?: JSX.Element }> = (props) => {
  const native = useNativeFlash();
  useLeaveFade(native.running, { loaded: pageLoaded, load: preloadPage, whole: (href) => window.location.assign(href) });
  return (
    <>
      <RouteMeta />
      {props.children}
    </>
  );
};

const App: Component = () => {
  return (
      <NotificationProvider>
      <DashboardProvider>
        <Router root={RootLayout}>
        <Route path="/" component={PAGES['/']} />
        <Route path="/" component={DocsLayout}>
          <Route path="/guide" component={PAGES['/guide']} />
          <Route path="/guide/compatibility" component={PAGES['/guide/compatibility']} />
          <Route path="/guide/help" component={PAGES['/guide/help']} />
          <Route path="/native" component={PAGES['/native']} />
          <Route path="/native/quickstart" component={PAGES['/native/quickstart']} />
          <Route path="/native/architecture" component={PAGES['/native/architecture']} />
          <Route path="/native/hardware" component={PAGES['/native/hardware']} />
          <Route path="/native/transport" component={PAGES['/native/transport']} />
          <Route path="/native/connection" component={PAGES['/native/connection']} />
          <Route path="/native/frame" component={PAGES['/native/frame']} />
          <Route path="/native/injection" component={PAGES['/native/injection']} />
          <Route path="/native/commands/inject" component={PAGES['/native/commands/inject']} />
          <Route path="/native/commands/move" component={PAGES['/native/commands/move']} />
          <Route path="/native/commands/requests" component={PAGES['/native/commands/requests']} />
          <Route path="/native/commands/admin" component={PAGES['/native/commands/admin']} />
          <Route path="/native/commands/update" component={PAGES['/native/commands/update']} />
          <Route path="/native/commands/led" component={PAGES['/native/commands/led']} />
          <Route path="/native/commands/lock" component={PAGES['/native/commands/lock']} />
          <Route path="/native/commands/catch" component={PAGES['/native/commands/catch']} />
          <Route path="/native/commands/transform" component={PAGES['/native/commands/transform']} />
          <Route path="/native/commands/option" component={PAGES['/native/commands/option']} />
          <Route path="/native/commands/clip" component={PAGES['/native/commands/clip']} />
          <Route path="/native/commands/raw" component={PAGES['/native/commands/raw']} />
          <Route path="/native/commands/transfer" component={PAGES['/native/commands/transfer']} />
          <Route path="/native/commands/rewrite" component={PAGES['/native/commands/rewrite']} />
          <Route path="/native/commands/patch" component={PAGES['/native/commands/patch']} />
          <Route path="/native/commands/usage" component={PAGES['/native/commands/usage']} />
          <Route path="/native/flashing" component={PAGES['/native/flashing']} />
          <Route path="/native/troubleshooting" component={PAGES['/native/troubleshooting']} />
          <Route path="/ai" component={PAGES['/ai']} />
          <Route path="/library" component={PAGES['/library']} />
          <Route path="/library/connection" component={PAGES['/library/connection']} />
          <Route path="/library/discovery" component={PAGES['/library/discovery']} />
          <Route path="/library/inject" component={PAGES['/library/inject']} />
          <Route path="/library/move" component={PAGES['/library/move']} />
          <Route path="/library/requests" component={PAGES['/library/requests']} />
          <Route path="/library/admin" component={PAGES['/library/admin']} />
          <Route path="/library/update" component={PAGES['/library/update']} />
          <Route path="/library/led" component={PAGES['/library/led']} />
          <Route path="/library/lock" component={PAGES['/library/lock']} />
          <Route path="/library/catch" component={PAGES['/library/catch']} />
          <Route path="/library/transform" component={PAGES['/library/transform']} />
          <Route path="/library/options" component={PAGES['/library/options']} />
          <Route path="/library/clip" component={PAGES['/library/clip']} />
          <Route path="/library/lifecycle" component={PAGES['/library/lifecycle']} />
          <Route path="/library/diagnostics" component={PAGES['/library/diagnostics']} />
          <Route path="/library/features/async" component={PAGES['/library/features/async']} />
          <Route path="/library/features/mock" component={PAGES['/library/features/mock']} />
          <Route path="/library/features/tracing" component={PAGES['/library/features/tracing']} />
          <Route path="/library/advanced/raw" component={PAGES['/library/advanced/raw']} />
          <Route path="/library/advanced/transfer" component={PAGES['/library/advanced/transfer']} />
          <Route path="/library/advanced/rewrite" component={PAGES['/library/advanced/rewrite']} />
          <Route path="/library/advanced/patch" component={PAGES['/library/advanced/patch']} />
          <Route path="/library/guides/calls" component={PAGES['/library/guides/calls']} />
          <Route path="/library/guides/connection" component={PAGES['/library/guides/connection']} />
          <Route path="/library/guides/testing" component={PAGES['/library/guides/testing']} />
          <Route path="/library/types" component={PAGES['/library/types']} />
          <Route path="/library/types/enums" component={PAGES['/library/types/enums']} />
          <Route path="/library/types/structs" component={PAGES['/library/types/structs']} />
          <Route path="/library/types/frames" component={PAGES['/library/types/frames']} />
          <Route path="/library/types/errors" component={PAGES['/library/types/errors']} />
          <Route path="/bindings" component={PAGES['/bindings']} />
          <Route path="/bindings/c" component={PAGES['/bindings/c']} />
          <Route path="/bindings/c/quickstart" component={PAGES['/bindings/c/quickstart']} />
          <Route path="/bindings/c/usage" component={PAGES['/bindings/c/usage']} />
          <Route path="/bindings/c/streams" component={PAGES['/bindings/c/streams']} />
          <Route path="/bindings/c/api" component={PAGES['/bindings/c/api']} />
          <Route path="/bindings/c/types" component={PAGES['/bindings/c/types']} />
          <Route path="/bindings/c/build" component={PAGES['/bindings/c/build']} />
          <Route path="/bindings/python" component={PAGES['/bindings/python']} />
          <Route path="/bindings/python/quickstart" component={PAGES['/bindings/python/quickstart']} />
          <Route path="/bindings/python/usage" component={PAGES['/bindings/python/usage']} />
          <Route path="/bindings/python/streams" component={PAGES['/bindings/python/streams']} />
          <Route path="/bindings/python/api" component={PAGES['/bindings/python/api']} />
          <Route path="/bindings/python/types" component={PAGES['/bindings/python/types']} />
          <Route path="/bindings/python/build" component={PAGES['/bindings/python/build']} />
          <Route path="/" component={BoxScope}>
            <Route path="/dashboard" component={PAGES['/dashboard']} />
            <Route path="/dashboard/control" component={PAGES['/dashboard/control']} />
          </Route>
          <Route path="/dashboard/setup" component={PAGES['/dashboard/setup']} />
          <Route path="/dashboard/update" component={PAGES['/dashboard/update']} />
          <Route path="/dashboard/changelog" component={PAGES['/dashboard/changelog']} />
          <Route path="/dashboard/stats" component={PAGES['/dashboard/stats']} />
          <Route path="*" component={NotFoundPage} />
        </Route>
        </Router>
      </DashboardProvider>
      </NotificationProvider>
  );
};

export default App;
