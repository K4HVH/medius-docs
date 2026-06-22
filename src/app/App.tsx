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
import CmdMovement from './pages/native/commands/Movement';
import CmdButtons from './pages/native/commands/Buttons';
import CmdRequests from './pages/native/commands/Requests';
import CmdAdmin from './pages/native/commands/Admin';
import CmdLed from './pages/native/commands/Led';
import CmdLock from './pages/native/commands/Lock';
import NativeFlashing from './pages/native/Flashing';
import NativeTroubleshooting from './pages/native/Troubleshooting';
import LibIntroduction from './pages/library/Introduction';
import LibConnection from './pages/library/Connection';
import LibMovement from './pages/library/Movement';
import LibButtons from './pages/library/Buttons';
import LibRequests from './pages/library/Requests';
import LibAdmin from './pages/library/Admin';
import LibLed from './pages/library/Led';
import LibLock from './pages/library/Lock';
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
          <Route path="/native/commands/movement" component={CmdMovement} />
          <Route path="/native/commands/buttons" component={CmdButtons} />
          <Route path="/native/commands/requests" component={CmdRequests} />
          <Route path="/native/commands/admin" component={CmdAdmin} />
          <Route path="/native/commands/led" component={CmdLed} />
          <Route path="/native/commands/lock" component={CmdLock} />
          <Route path="/native/flashing" component={NativeFlashing} />
          <Route path="/native/troubleshooting" component={NativeTroubleshooting} />
          <Route path="/library" component={LibIntroduction} />
          <Route path="/library/connection" component={LibConnection} />
          <Route path="/library/movement" component={LibMovement} />
          <Route path="/library/buttons" component={LibButtons} />
          <Route path="/library/requests" component={LibRequests} />
          <Route path="/library/admin" component={LibAdmin} />
          <Route path="/library/led" component={LibLed} />
          <Route path="/library/lock" component={LibLock} />
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
