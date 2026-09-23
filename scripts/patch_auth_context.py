with open("frontend/src/context/AuthContext.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_rf = """    try {
      const userData = await authService.getMe();
      setUser(userData);
      setRole(userData.role as UserRole);
    }"""

new_rf = """    try {
      const userData = await authService.getMe();
      const normRole = userData.role ? (userData.role.toLowerCase() as UserRole) : null;
      setUser({ ...userData, role: normRole || (userData.role as UserRole) });
      setRole(normRole);
    }"""

old_login = """  const login = async (newToken: string, userRole: UserRole) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("role", userRole);
    setToken(newToken);
    setRole(userRole);
    await refreshUser();
  };"""

new_login = """  const login = async (newToken: string, userRole: UserRole) => {
    const normRole = userRole ? (userRole.toLowerCase() as UserRole) : userRole;
    localStorage.setItem("token", newToken);
    localStorage.setItem("role", normRole);
    setToken(newToken);
    setRole(normRole);
    await refreshUser();
  };"""

if old_rf in c and old_login in c:
    c = c.replace(old_rf, new_rf).replace(old_login, new_login)
    with open("frontend/src/context/AuthContext.tsx", "w", encoding="utf-8") as f:
        f.write(c)
    print("AuthContext.tsx role normalization patched successfully.")
else:
    print("Patterns not found in AuthContext.tsx")
