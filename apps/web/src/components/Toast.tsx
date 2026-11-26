import { useAppContext } from '../context/AppContext';
import { Bell } from 'lucide-react';

export default function Toast() {
  const { toast } = useAppContext();
  
  if (!toast) return null;
  
  return (
    <div className="toast-container">
      <div className="toast">
        <Bell size={16} />
        {toast}
      </div>
    </div>
  );
}