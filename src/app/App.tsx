import type { Component } from 'solid-js';
import { Router, Route, Navigate } from '@solidjs/router';
import { NotificationProvider } from '../components/feedback/Notification';
import Home from './pages/Home';
import DocsLayout from './pages/DocsLayout';
import NativeIntroduction from './pages/native/Introduction';
import NativeQuickstart from './pages/native/Quickstart';
import NativeArchitecture from './pages/native/Architecture';
import NativeHardware from './pages/native/Hardware';
import NativeTransport from './pages/native/Transport';
import NativeConnection from './pages/native/Connection';
import NativeFrame from './pages/native/Frame';
import NativeInjection from './pages/native/Injection';
import CmdInject from './pages/native/commands/Inject';
import CmdMove from './pages/native/commands/Move';
import CmdUsage from './pages/native/commands/Usage';
import CmdRequests from './pages/native/commands/Requests';
import CmdAdmin from './pages/native/commands/Admin';
import CmdLed from './pages/native/commands/Led';
import CmdLock from './pages/native/commands/Lock';
import CmdCatch from './pages/native/commands/Catch';
import CmdOption from './pages/native/commands/Option';
import NativeFlashing from './pages/native/Flashing';
import NativeTroubleshooting from './pages/native/Troubleshooting';
import LibIntroduction from './pages/library/Introduction';
import LibConnection from './pages/library/Connection';
import LibInject from './pages/library/Inject';
import LibMove from './pages/library/Move';
import LibRequests from './pages/library/Requests';
import LibAdmin from './pages/library/Admin';
import LibLed from './pages/library/Led';
import LibLock from './pages/library/Lock';
import LibCatch from './pages/library/Catch';
import LibOptions from './pages/library/Options';
import LibLifecycle from './pages/library/Lifecycle';
import LibDiagnostics from './pages/library/Diagnostics';
import FeatAsync from './pages/library/features/Async';
import FeatMock from './pages/library/features/Mock';
import FeatFlash from './pages/library/features/Flash';
import FeatTracing from './pages/library/features/Tracing';
import GuideCalls from './pages/library/GuideCalls';
import GuideConnection from './pages/library/GuideConnection';
import GuideTesting from './pages/library/GuideTesting';
import LibTypes from './pages/library/TypesAndErrors';
import LibTypesEnums from './pages/library/types/Enums';
import LibTypesStructs from './pages/library/types/Structs';
import LibTypesFrames from './pages/library/types/Frames';
import LibTypesErrors from './pages/library/types/Errors';
import BindingsOverview from './pages/bindings/Overview';
import CInstall from './pages/bindings/c/Install';
import CQuickstart from './pages/bindings/c/Quickstart';
import CUsage from './pages/bindings/c/Usage';
import CStreams from './pages/bindings/c/Streams';
import CApi from './pages/bindings/c/Api';
import CTypes from './pages/bindings/c/Types';
import CBuild from './pages/bindings/c/Build';
import PyInstall from './pages/bindings/python/Install';
import PyQuickstart from './pages/bindings/python/Quickstart';
import PyUsage from './pages/bindings/python/Usage';
import PyStreams from './pages/bindings/python/Streams';
import PyApi from './pages/bindings/python/Api';
import PyTypes from './pages/bindings/python/Types';
import PyBuild from './pages/bindings/python/Build';
import DashboardDevice from './pages/dashboard/Device';
import DashboardControl from './pages/dashboard/Control';
import DashboardUpdate from './pages/dashboard/Update';
import DashboardAdvanced from './pages/dashboard/Advanced';
import DashboardChangelog from './pages/dashboard/Changelog';
import { DashboardProvider } from './pages/dashboard/context';

const App: Component = () => {
  return (
    <NotificationProvider>
      <DashboardProvider>
        <Router>
        <Route path="/" component={Home} />
        <Route path="/" component={DocsLayout}>
          <Route path="/native" component={NativeIntroduction} />
          <Route path="/native/quickstart" component={NativeQuickstart} />
          <Route path="/native/architecture" component={NativeArchitecture} />
          <Route path="/native/hardware" component={NativeHardware} />
          <Route path="/native/transport" component={NativeTransport} />
          <Route path="/native/connection" component={NativeConnection} />
          <Route path="/native/frame" component={NativeFrame} />
          <Route path="/native/injection" component={NativeInjection} />
          <Route path="/native/commands/inject" component={CmdInject} />
          <Route path="/native/commands/move" component={CmdMove} />
          <Route path="/native/commands/requests" component={CmdRequests} />
          <Route path="/native/commands/admin" component={CmdAdmin} />
          <Route path="/native/commands/led" component={CmdLed} />
          <Route path="/native/commands/lock" component={CmdLock} />
          <Route path="/native/commands/catch" component={CmdCatch} />
          <Route path="/native/commands/option" component={CmdOption} />
          <Route path="/native/commands/usage" component={CmdUsage} />
          <Route path="/native/flashing" component={NativeFlashing} />
          <Route path="/native/troubleshooting" component={NativeTroubleshooting} />
          <Route path="/library" component={LibIntroduction} />
          <Route path="/library/connection" component={LibConnection} />
          <Route path="/library/inject" component={LibInject} />
          <Route path="/library/move" component={LibMove} />
          <Route path="/library/requests" component={LibRequests} />
          <Route path="/library/admin" component={LibAdmin} />
          <Route path="/library/led" component={LibLed} />
          <Route path="/library/lock" component={LibLock} />
          <Route path="/library/catch" component={LibCatch} />
          <Route path="/library/options" component={LibOptions} />
          <Route path="/library/lifecycle" component={LibLifecycle} />
          <Route path="/library/diagnostics" component={LibDiagnostics} />
          <Route path="/library/features/async" component={FeatAsync} />
          <Route path="/library/features/mock" component={FeatMock} />
          <Route path="/library/features/flash" component={FeatFlash} />
          <Route path="/library/features/tracing" component={FeatTracing} />
          <Route path="/library/guides/calls" component={GuideCalls} />
          <Route path="/library/guides/connection" component={GuideConnection} />
          <Route path="/library/guides/testing" component={GuideTesting} />
          <Route path="/library/types" component={LibTypes} />
          <Route path="/library/types/enums" component={LibTypesEnums} />
          <Route path="/library/types/structs" component={LibTypesStructs} />
          <Route path="/library/types/frames" component={LibTypesFrames} />
          <Route path="/library/types/errors" component={LibTypesErrors} />
          <Route path="/bindings" component={BindingsOverview} />
          <Route path="/bindings/c" component={CInstall} />
          <Route path="/bindings/c/quickstart" component={CQuickstart} />
          <Route path="/bindings/c/usage" component={CUsage} />
          <Route path="/bindings/c/streams" component={CStreams} />
          <Route path="/bindings/c/api" component={CApi} />
          <Route path="/bindings/c/types" component={CTypes} />
          <Route path="/bindings/c/build" component={CBuild} />
          <Route path="/bindings/python" component={PyInstall} />
          <Route path="/bindings/python/quickstart" component={PyQuickstart} />
          <Route path="/bindings/python/usage" component={PyUsage} />
          <Route path="/bindings/python/streams" component={PyStreams} />
          <Route path="/bindings/python/api" component={PyApi} />
          <Route path="/bindings/python/types" component={PyTypes} />
          <Route path="/bindings/python/build" component={PyBuild} />
          <Route path="/dashboard" component={DashboardDevice} />
          <Route path="/dashboard/control" component={DashboardControl} />
          <Route path="/dashboard/update" component={DashboardUpdate} />
          <Route path="/dashboard/advanced" component={DashboardAdvanced} />
          <Route path="/dashboard/changelog" component={DashboardChangelog} />
        </Route>
        <Route path="*" component={() => <Navigate href="/" />} />
        </Router>
      </DashboardProvider>
    </NotificationProvider>
  );
};

export default App;
