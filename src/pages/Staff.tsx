import { useStaffStore } from '../store/useStaffStore';
import { StaffList } from '../components/StaffManager/StaffList';
import { StaffForm } from '../components/StaffManager/StaffForm';

export function StaffPage() {
  const { staff, activeStaffId, addStaff, updateStaff, removeStaff, setActiveStaff } = useStaffStore();
  const editing = staff.find((m) => m.id === activeStaffId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-100">Işgärler</h2>
        <p className="text-xs text-neutral-500 -mt-2">
          Create logins for your staff and control which companies each one can access.
        </p>
        <StaffList
          staff={staff}
          activeId={activeStaffId}
          onSelect={setActiveStaff}
          onRemove={(id) => {
            removeStaff(id);
            if (activeStaffId === id) setActiveStaff(null);
          }}
        />
      </div>
      <div className="lg:col-span-2">
        <StaffForm
          editing={editing}
          onCreate={addStaff}
          onUpdate={updateStaff}
          onCancelEdit={() => setActiveStaff(null)}
        />
      </div>
    </div>
  );
}
