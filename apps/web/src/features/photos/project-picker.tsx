"use client";

import { useRouter } from "next/navigation";

export function ProjectPicker({
  projectId,
  projects,
}: {
  projectId: string;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <select
      value={projectId}
      className="w-full rounded-xl border border-zinc-200 px-3"
      onChange={(event) => {
        router.push(`/photos/upload?projectId=${event.target.value}`);
      }}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}
