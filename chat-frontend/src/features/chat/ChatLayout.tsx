import { Outlet } from 'react-router-dom';
import SurveyGate from '../survey/SurveyGate';

export default function ChatLayout() {
  return (
    <SurveyGate>
      <Outlet />
    </SurveyGate>
  );
}
