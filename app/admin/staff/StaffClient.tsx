"use client";

import { useState } from "react";

type Staff = {
  id: number;
  googleEmail: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string | Date;
};

export default function StaffClient({ initialStaff }: { initialStaff: Staff[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("teacher");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_email: email, first_name: firstName, last_name: lastName, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setStaff((prev) => [...prev, data]);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("teacher");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(id: number, newRole: string) {
    await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role: newRole } : s)));
  }

  async function handleRemove(id: number) {
    if (!window.confirm("Remove this staff member?")) return;
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = staff.filter((s) =>
    `${s.firstName ?? ""} ${s.lastName ?? ""} ${s.googleEmail}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="card space-y-3">
        <h2 className="font-bold">Add Staff Member</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="input" placeholder="Google email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Adding..." : "Add Staff"}
        </button>
      </form>

      <div className="card">
        <input className="input mb-3" placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2">{s.firstName} {s.lastName}</td>
                <td className="py-2">{s.googleEmail}</td>
                <td className="py-2">
                  <select className="input py-1" value={s.role} onChange={(e) => handleRoleChange(s.id, e.target.value)}>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-2">
                  <button onClick={() => handleRemove(s.id)} className="text-red-600 font-medium">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
