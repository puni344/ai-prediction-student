import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { api } from "../../services/api";

interface Department {
  id: number;
  name: string;
  code: string;
}

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string) => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
}

export const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
  value,
  onChange,
  error,
  disabled = false,
  required = true,
  hideLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get<{ departments: Department[] }>("/departments");
        if (res.data && res.data.departments) {
          setDepartments(res.data.departments);
        }
      } catch {
        // Fallback
      }
    };
    fetchDepartments();
  }, []);

  const selectedDept = departments.find(
    (d) => d.name.toLowerCase() === value?.toLowerCase() || d.code.toLowerCase() === value?.toLowerCase()
  );

  const filtered = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      {!hideLabel && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Academic Department {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between rounded-xl border bg-white/4 py-2.5 px-3.5 text-sm text-left transition-colors ${
          error
            ? "border-rose-500/50 focus:border-rose-500"
            : isOpen
            ? "border-indigo-500 ring-1 ring-indigo-500"
            : "border-white/10 hover:border-white/20"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={selectedDept ? "text-white font-medium truncate" : "text-slate-500"}>
          {selectedDept ? selectedDept.name : "Select your department"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {error && <p className="mt-1 text-xs text-rose-400 font-medium">{error}</p>}

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-white/12 bg-[#0e121b] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search departments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/8 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {filtered.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-500">No departments found.</p>
              ) : (
                filtered.map((d) => {
                  const isSelected = selectedDept?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onChange(d.name);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors text-left ${
                        isSelected
                          ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{d.name}</div>
                        <div className="text-[11px] text-slate-400">Code: {d.code}</div>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-400 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
