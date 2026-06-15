import { type JSX } from 'solid-js';
import { type RouteSectionProps, useLocation, useNavigate } from '@solidjs/router';
import { BsBook, BsBoxArrowInDown, BsCpu, BsHouseDoor } from 'solid-icons/bs';
import { GridBackground } from '../../../components/surfaces/GridBackground';
import { Titlebar } from '../../../components/navigation/Titlebar';
import { Button } from '../../../components/inputs/Button';
import { Tabs, type TabOption } from '../../../components/navigation/Tabs';
import { DashboardProvider, useDashboard } from './context';

const dashTabs: TabOption[] = [
  { value: '/dashboard', label: 'Device', icon: BsCpu },
  { value: '/dashboard/flash', label: 'Flash', icon: BsBoxArrowInDown },
];

// Chrome lives inside the provider so it can lock navigation during a flash.
const DashboardChrome = (props: { children?: JSX.Element }) => {
  const dash = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const locked = () => dash.status() === 'flashing';

  return (
    <div class="content" style={{ display: 'flex', 'flex-direction': 'column', height: '100%', width: '100%' }}>
      <Titlebar
        title="Medius - Dashboard"
        subtitle="Device and firmware"
        sticky
        style={{ margin: 'var(--g-spacing-sm)', top: 'var(--g-spacing-sm)' }}
        left={
          <Button
            variant="subtle"
            size="compact"
            icon={BsHouseDoor}
            disabled={locked()}
            onClick={() => navigate('/')}
            aria-label="Home"
          />
        }
        right={
          <Button
            variant="subtle"
            size="compact"
            icon={BsBook}
            disabled={locked()}
            onClick={() => navigate('/native')}
            aria-label="Documentation"
          />
        }
      />
      <div style={{ padding: '0 var(--g-spacing-sm)' }}>
        <Tabs
          options={dashTabs}
          value={location.pathname}
          onChange={(v) => navigate(v)}
          variant="subtle"
          disabled={locked()}
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div class="container container--wide grid">{props.children}</div>
      </div>
    </div>
  );
};

const DashboardLayout = (props: RouteSectionProps) => {
  return (
    <DashboardProvider>
      <GridBackground gridSize={10} />
      <DashboardChrome>{props.children}</DashboardChrome>
    </DashboardProvider>
  );
};

export default DashboardLayout;
