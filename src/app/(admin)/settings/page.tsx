"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Manage application settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Settings page will be implemented here.</p>
      </CardContent>
    </Card>
  );
}