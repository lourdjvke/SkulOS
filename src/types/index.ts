export type UserRole = "owner" | "staff" | "retired" | null;

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  name?: string;
  lastLogin?: number;
  lastDataLog?: number;
  totalLogsThisWeek?: number;
  subject?: string;
}

export interface School {
  id: string;
  name: string;
  address: string;
  type: string;
  ownerId: string;
  inviteCode: string;
}

export type FileType = "folder" | "table" | "text";

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  ownerId: string; // The staff member who owns it
  schoolId: string;
  tags?: string[];
  sharedWith?: string[];
  content?: any; // For text files (string) or table files (rows/cols)
  createdAt: number;
  updatedAt: number;
}

export interface TableContent {
  columns: { id: string; name: string }[];
  rows: Record<string, any>[];
}

export const TAG_COLORS = {
  sage: "#B2AC88",
  rose: "#E0B0FF", // Actually lavender, let's use better ones
  sky: "#87CEEB",
  amber: "#FFBF00",
  lavender: "#E6E6FA",
};

export const ACCENT_COLORS = [
  { name: "Sage", value: "#B2AC88" },
  { name: "Rose", value: "#F4C2C2" },
  { name: "Sky", value: "#87CEEB" },
  { name: "Amber", value: "#FFBF00" },
  { name: "Lavender", value: "#E6E6FA" },
];
