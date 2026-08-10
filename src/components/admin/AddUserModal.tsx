import React, { useState, useCallback } from "react";
import { UserPlus, Shield, Mail, User as UserIcon, Lock } from "lucide-react";
import type { CreateUserData, UserRole } from "@/types/user-management";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AddUserModalProps {
  onAddUser: (data: CreateUserData) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ onAddUser }) => {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("developer");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !email.trim()) {
        toast.error("Please fill in all required fields.");
        return;
      }

      try {
        setLoading(true);
        onAddUser({
          username: username.trim(),
          email: email.trim(),
          password: password || undefined,
          role,
        });

        toast.success(`User ${username} created successfully!`);
        setUsername("");
        setEmail("");
        setPassword("");
        setRole("developer");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create user.");
      } finally {
        setLoading(false);
      }
    },
    [username, email, password, role, onAddUser],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <UserPlus className="h-4 w-4" />
          Add New User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <UserPlus className="h-5 w-5 text-primary" />
              Create Admin / Team Account
            </DialogTitle>
            <DialogDescription>
              Enter the new user credentials and select their system role.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username" className="flex items-center gap-1.5 text-xs font-semibold">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Username
              </Label>
              <Input
                id="username"
                placeholder="e.g. ahmed_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-semibold">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="flex items-center gap-1.5 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Password (Optional)
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role" className="flex items-center gap-1.5 text-xs font-semibold">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Role & Permissions
              </Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="tester">Tester (QA)</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Save User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
