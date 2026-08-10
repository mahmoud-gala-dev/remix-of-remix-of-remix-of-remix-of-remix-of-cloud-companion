import { InteractiveStatusEditor } from "@/components/common/InteractiveStatusEditor";

export type BugQuickStatusProps = {
  bugId: number;
  status: string;
  canEdit: boolean;
  className?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
};

/** Compact status changer so developers can update bug statuses directly from lists and detail views. */
export function BugQuickStatus({
  bugId,
  status,
  canEdit,
  className,
  size = "sm",
}: BugQuickStatusProps) {
  return (
    <InteractiveStatusEditor
      itemId={bugId}
      type="bug"
      currentStatus={status}
      canEdit={canEdit}
      size={size}
      className={className}
    />
  );
}
