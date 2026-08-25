"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; name: string; degreeLevel?: string | null };
type Level = "universities" | "colleges" | "departments" | "programs";

async function fetchLevel(level: Level, parentId?: string): Promise<Item[]> {
  const qs = new URLSearchParams({ level });
  if (parentId) qs.set("parentId", parentId);
  const res = await fetch(`/api/academic?${qs.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

/**
 * Optional cascading University → College → Department → Program picker.
 * The chosen program id is submitted via a hidden input named `programId`,
 * which links the uploaded document to its guideline set.
 */
export function AcademicSelector() {
  const [universities, setUniversities] = useState<Item[]>([]);
  const [colleges, setColleges] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [programs, setPrograms] = useState<Item[]>([]);

  const [universityId, setUniversityId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");

  useEffect(() => {
    fetchLevel("universities").then(setUniversities);
  }, []);

  const onUniversity = useCallback(async (id: string) => {
    setUniversityId(id);
    setCollegeId("");
    setDepartmentId("");
    setProgramId("");
    setColleges(id ? await fetchLevel("colleges", id) : []);
    setDepartments([]);
    setPrograms([]);
  }, []);

  const onCollege = useCallback(async (id: string) => {
    setCollegeId(id);
    setDepartmentId("");
    setProgramId("");
    setDepartments(id ? await fetchLevel("departments", id) : []);
    setPrograms([]);
  }, []);

  const onDepartment = useCallback(async (id: string) => {
    setDepartmentId(id);
    setProgramId("");
    setPrograms(id ? await fetchLevel("programs", id) : []);
  }, []);

  if (universities.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No universities configured yet — you can still upload without selecting
        a program.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="programId" value={programId} />
      <Select
        label="University"
        value={universityId}
        options={universities}
        onChange={onUniversity}
      />
      {universityId && (
        <Select
          label="College"
          value={collegeId}
          options={colleges}
          onChange={onCollege}
        />
      )}
      {collegeId && (
        <Select
          label="Department"
          value={departmentId}
          options={departments}
          onChange={onDepartment}
        />
      )}
      {departmentId && (
        <Select
          label="Program"
          value={programId}
          options={programs}
          onChange={setProgramId}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Item[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.degreeLevel ? ` (${o.degreeLevel})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
