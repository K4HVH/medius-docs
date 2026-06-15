import { type RouteSectionProps, useNavigate } from '@solidjs/router';
import { BsBook, BsHouseDoor } from 'solid-icons/bs';
import { GridBackground } from '../../../components/surfaces/GridBackground';
import { Titlebar } from '../../../components/navigation/Titlebar';
import { Button } from '../../../components/inputs/Button';
import { DashboardProvider } from './context';

const DashboardLayout = (props: RouteSectionProps) => {
  const navigate = useNavigate();

  return (
    <DashboardProvider>
      <GridBackground gridSize={10} />
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
              onClick={() => navigate('/')}
              aria-label="Home"
            />
          }
          right={
            <Button
              variant="subtle"
              size="compact"
              icon={BsBook}
              onClick={() => navigate('/native')}
              aria-label="Documentation"
            />
          }
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div class="container container--wide grid">{props.children}</div>
        </div>
      </div>
    </DashboardProvider>
  );
};

export default DashboardLayout;
