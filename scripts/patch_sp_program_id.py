with open("backend/models/profile.py", "r", encoding="utf-8") as f:
    c = f.read()

target = """    program: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    academic_year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)"""

replacement = """    program: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default=None)
    academic_year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)

    @property
    def program_id(self) -> Optional[str]:
        return self.program

    @program_id.setter
    def program_id(self, val: Optional[str]):
        self.program = val"""

if target in c:
    c = c.replace(target, replacement)
    with open("backend/models/profile.py", "w", encoding="utf-8") as f:
        f.write(c)
    print("Added program_id property alias to StudentProfile.")
else:
    print("Target pattern not found in backend/models/profile.py")
