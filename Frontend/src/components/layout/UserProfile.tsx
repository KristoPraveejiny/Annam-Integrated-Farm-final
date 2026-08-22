import { useState, useEffect } from 'react';
import { FiUser, FiChevronDown, FiLogOut } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../../utils/logout';

export default function UserProfile() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const handleLogout = async () => {
    await clearSession();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
        onClick={() => setOpen(!open)}
      >
        <FiUser className="text-emerald-200" />
        <span className="capitalize">{user.name || 'User'}</span>
        <FiChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              <FiLogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
