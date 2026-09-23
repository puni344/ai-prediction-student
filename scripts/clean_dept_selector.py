with open("frontend/src/components/common/DepartmentSelector.tsx", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace(
    'import { DEPARTMENTS, DepartmentOption } from "../../constants/departments";',
    'import { DEPARTMENTS, DepartmentOption } from "../../constants/departments";\nimport { api } from "../../services/api";'
)

old_effect = """  useEffect(() => {
    import("../../services/api").then(({ api }) => {
      api.get<{ departments: Array<{ id: string; name: string }> }>("/departments")
        .then((res) => {
          if (res.data && Array.isArray(res.data.departments) && res.data.departments.length > 0) {
            setDeptList(res.data.departments.map(d => ({ id: d.id, name: d.name })));
          }
        })
        .catch(() => {
          // Fallback to static DEPARTMENTS
        });
    });
  }, []);"""

new_effect = """  useEffect(() => {
    api.get<{ departments: Array<{ id: string; name: string }> }>("/departments")
      .then((res) => {
        if (res.data && Array.isArray(res.data.departments) && res.data.departments.length > 0) {
          setDeptList(res.data.departments.map(d => ({ id: d.id, name: d.name })));
        }
      })
      .catch(() => {
        // Fallback to static DEPARTMENTS
      });
  }, []);"""

c = c.replace(old_effect, new_effect)

with open("frontend/src/components/common/DepartmentSelector.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("DepartmentSelector cleaned up.")
